import { Redis } from "@upstash/redis";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Small key-value store for accounts and settings.
 * - Upstash Redis when connected (the same env vars as the translation cache), shared by
 *   every server instance on Vercel.
 * - Otherwise a JSON file: .data/kv.json locally, /tmp on Vercel. Fine for development; on
 *   Vercel without Redis accounts would be lost between instances, so connect Redis there.
 */
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = URL_ && TOKEN ? new Redis({ url: URL_, token: TOKEN, automaticDeserialization: false, retry: { retries: 2 } }) : null;

export const hasRedis = !!redis;

// ---------- File fallback ----------
const FILE = process.env.VERCEL ? "/tmp/stark-kv.json" : path.join(process.cwd(), ".data", "kv.json");
type Entry = { v: string; exp?: number };
let mem: Map<string, Entry> | null = null;
let saving: Promise<void> | null = null;

async function load() {
  if (mem) return mem;
  try {
    mem = new Map(Object.entries(JSON.parse(await fs.readFile(FILE, "utf8")) as Record<string, Entry>));
  } catch {
    mem = new Map();
  }
  return mem;
}
function save() {
  if (saving) return;
  saving = (async () => {
    await new Promise((r) => setTimeout(r, 50));
    try {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(Object.fromEntries(mem!)));
    } catch (e) {
      console.warn("[kv] could not save:", String(e));
    }
    saving = null;
  })();
}
function alive(e: Entry | undefined) {
  return e && (!e.exp || e.exp > Date.now()) ? e : undefined;
}

// ---------- API ----------
export async function kvGet(key: string): Promise<string | null> {
  if (redis) {
    const v = await redis.get<string>(key);
    return typeof v === "string" ? v : null;
  }
  return alive((await load()).get(key))?.v ?? null;
}

export async function kvSet(key: string, value: string, opts: { ex?: number; nx?: boolean } = {}): Promise<boolean> {
  if (redis) {
    const r = opts.nx
      ? opts.ex
        ? await redis.set(key, value, { nx: true, ex: opts.ex })
        : await redis.set(key, value, { nx: true })
      : opts.ex
        ? await redis.set(key, value, { ex: opts.ex })
        : await redis.set(key, value);
    return r === "OK";
  }
  const m = await load();
  if (opts.nx && alive(m.get(key))) return false;
  m.set(key, { v: value, exp: opts.ex ? Date.now() + opts.ex * 1000 : undefined });
  save();
  return true;
}

/** Counter that expires `ttl` seconds after its first hit (for rate limits). */
export async function kvIncr(key: string, ttl: number): Promise<number> {
  if (redis) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, ttl);
    return n;
  }
  const m = await load();
  const e = alive(m.get(key));
  const n = (e ? Number(e.v) : 0) + 1;
  m.set(key, { v: String(n), exp: e?.exp ?? Date.now() + ttl * 1000 });
  return n;
}

export async function kvDel(key: string) {
  if (redis) await redis.del(key);
  else if ((await load()).delete(key)) save();
}
