import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { kvGet, kvIncr, kvSet } from "./kv";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type User = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  /** "scrypt$<salt>$<hash>", absent for Google-only accounts. */
  hash?: string;
  google?: string;
  created: string;
  /** Section settings (same format as the "sec" cookie, see lib/prefs.ts). */
  prefs?: string;
};

/** What the browser keeps in the signed session cookie: enough for the header, no lookup. */
export type Session = { uid: string; name: string; login: string; exp: number };

export const SESSION_COOKIE = "sid";
const SESSION_DAYS = 30;

// ---------- Secret ----------
// AUTH_SECRET signs session cookies. Without it we derive one from the Redis token (also a
// secret, and stable across deploys); with neither (local runs) a random one is kept in .data/.
let cachedSecret = "";
function secret(): string {
  if (cachedSecret) return cachedSecret;
  const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (process.env.AUTH_SECRET) cachedSecret = process.env.AUTH_SECRET;
  else if (redisToken) cachedSecret = createHash("sha256").update("stark-auth|" + redisToken).digest("hex");
  else {
    const file = process.env.VERCEL ? "/tmp/stark-auth-secret" : path.join(process.cwd(), ".data", "auth-secret");
    try {
      cachedSecret = readFileSync(file, "utf8").trim();
    } catch {}
    if (!cachedSecret) {
      cachedSecret = randomBytes(32).toString("hex");
      try {
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, cachedSecret);
      } catch {}
    }
  }
  return cachedSecret;
}

// ---------- Login names: phone number or email ----------
export type Login = { kind: "email" | "phone"; value: string };

/** "0912 345 678", "+84912345678" → "0912345678"; emails are lower-cased. Null if neither. */
export function parseLogin(raw: string): Login | null {
  const s = raw.trim();
  if (s.includes("@")) {
    const e = s.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? { kind: "email", value: e } : null;
  }
  let p = s.replace(/[\s.\-()]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length === 11) p = "0" + p.slice(2);
  if (/^0\d{9}$/.test(p)) return { kind: "phone", value: p };
  if (/^\+\d{8,15}$/.test(p)) return { kind: "phone", value: p };
  return null;
}

const loginKey = (l: Login) => `login:${l.value}`;
const userKey = (id: string) => `user:${id}`;
const googleKey = (sub: string) => `google:${sub}`;

// ---------- Passwords ----------
async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${h.toString("base64url")}`;
}
async function checkPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = await scrypt(pw, Buffer.from(salt, "base64url"), want.length);
  return timingSafeEqual(got, want);
}

// ---------- Users ----------
export async function getUser(id: string): Promise<User | null> {
  const raw = await kvGet(userKey(id));
  return raw ? (JSON.parse(raw) as User) : null;
}
export async function saveUser(u: User) {
  await kvSet(userKey(u.id), JSON.stringify(u));
}

export class AuthError extends Error {
  constructor(public code: "invalid_login" | "weak_password" | "taken" | "wrong" | "rate" | "name") {
    super(code);
  }
}

export async function register(rawLogin: string, password: string, rawName: string, prefs?: string): Promise<User> {
  const login = parseLogin(rawLogin);
  if (!login) throw new AuthError("invalid_login");
  if (password.length < 8 || password.length > 200) throw new AuthError("weak_password");
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) throw new AuthError("name");
  const id = randomUUID();
  // Claim the login name first, so two sign-ups with the same phone/email can't both win.
  if (!(await kvSet(loginKey(login), id, { nx: true }))) throw new AuthError("taken");
  const user: User = { id, name, [login.kind]: login.value, hash: await hashPassword(password), created: new Date().toISOString(), prefs };
  await saveUser(user);
  return user;
}

export async function authenticate(rawLogin: string, password: string): Promise<User> {
  const login = parseLogin(rawLogin);
  if (!login) throw new AuthError("wrong");
  const id = await kvGet(loginKey(login));
  const user = id ? await getUser(id) : null;
  if (!user?.hash || !(await checkPassword(password, user.hash))) throw new AuthError("wrong");
  return user;
}

/** Google sign-in: the account linked to this Google id, else the one with this email, else a new one. */
export async function googleUser(sub: string, email: string | undefined, name: string): Promise<User> {
  const linked = await kvGet(googleKey(sub));
  if (linked) {
    const u = await getUser(linked);
    if (u) return u;
  }
  const login = email ? parseLogin(email) : null;
  const byEmail = login ? await kvGet(loginKey(login)) : null;
  let user = byEmail ? await getUser(byEmail) : null;
  if (user) {
    user.google = sub;
  } else {
    user = { id: randomUUID(), name: name.slice(0, 60) || (email ?? "STARK"), email: login?.value, google: sub, created: new Date().toISOString() };
    if (login) await kvSet(loginKey(login), user.id, { nx: true });
  }
  await saveUser(user);
  await kvSet(googleKey(sub), user.id);
  return user;
}

/** At most `max` tries per IP and action in 10 minutes. */
export async function rateLimit(ip: string, action: string, max = 10) {
  try {
    if ((await kvIncr(`rl:${action}:${ip}`, 600)) > max) throw new AuthError("rate");
  } catch (e) {
    if (e instanceof AuthError) throw e; // store unavailable: don't lock everyone out
  }
}

// ---------- Session cookie ----------
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function sessionToken(u: User): string {
  const s: Session = { uid: u.id, name: u.name, login: u.email ?? u.phone ?? "", exp: Date.now() + SESSION_DAYS * 86_400_000 };
  const data = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function readToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  try {
    const want = Buffer.from(sign(data));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const sessionCookie = (value: string, maxAge = SESSION_DAYS * 86400) => ({
  name: SESSION_COOKIE,
  value,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** The signed-in visitor, read from the cookie (no database call). */
export async function getSession(): Promise<Session | null> {
  try {
    return readToken((await cookies()).get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
