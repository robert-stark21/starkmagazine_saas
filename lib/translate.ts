import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Lang } from "./sources";

/**
 * Translation chain. Each piece of text goes to the first translator that succeeds, in one
 * of two orders:
 *   "free" (default)   Microsoft → Google → Claude: Claude only gets what the free ones failed on.
 *   "claude"           Claude → Microsoft → Google: for the sections in CLAUDE_CATEGORIES,
 *                      where wording matters most (design, UI/UX, tech).
 * Microsoft is the free Bing Translator web API, Google a free endpoint, Claude needs
 * ANTHROPIC_API_KEY (model from TRANSLATE_MODEL, default claude-haiku-5-5); without the key
 * everything goes through the free ones. A translator that fails (blocked, rate-limited,
 * timed out, out of credit) is skipped for 5 minutes, so pages don't wait on it. If all fail,
 * the original text is shown. Translations are cached whichever translator made them: in
 * memory, on disk, and in Upstash Redis when connected (shared by every server instance).
 */

type Provider = {
  name: string;
  free?: boolean; // free web endpoint: empty or untouched output counts as a failure
  maxChars: number; // characters per request
  enabled: () => boolean;
  translate: (texts: string[], target: Lang) => Promise<string[]>;
};

const cache = new Map<string, string>();

// ---------- Saved translations ----------
// Kept on disk so a server restart doesn't show untranslated titles while everything is
// translated again. On Vercel only /tmp is writable (and it lasts as long as the instance).
const SAVE_FILE = path.join(process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".cache"), "translations.json");
let saveTimer: ReturnType<typeof setTimeout> | undefined;

try {
  const saved: [string, string][] = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
  for (const [k, v] of saved.slice(-20000)) cache.set(k, v);
} catch {}

function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = undefined;
    try {
      await fs.promises.mkdir(path.dirname(SAVE_FILE), { recursive: true });
      const tmp = `${SAVE_FILE}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify([...cache]));
      await fs.promises.rename(tmp, SAVE_FILE);
    } catch (e) {
      console.warn("[translate] could not save translations:", String(e));
    }
  }, 5000);
}

// ---------- Shared translations (Upstash Redis) ----------
// On Vercel every server instance has its own memory and /tmp, so a reload could land on an
// instance that translates (and pays for) the same text again. With an Upstash Redis store
// connected (env UPSTASH_REDIS_REST_URL / _TOKEN, or the KV_REST_API_URL / _TOKEN names
// Vercel sets), translations are shared by every instance for 30 days. Without it, or if it
// fails, the memory + disk cache above is used as before.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN, automaticDeserialization: false, retry: { retries: 1 }, signal: () => AbortSignal.timeout(2500) })
    : null;
const SHARED_TTL = 30 * 24 * 3600; // seconds
/** Short key: "t:" + 22 characters of the SHA-1 of "lang|text". */
const sharedKey = (key: string) => "t:" + createHash("sha1").update(key).digest("base64url").slice(0, 22);

/** One request for many texts. Returns null for each miss (or everything, when unavailable). */
async function sharedGet(keys: string[]): Promise<(string | null)[]> {
  if (!redis || !keys.length) return keys.map(() => null);
  try {
    const got = await redis.mget<(string | null)[]>(...keys.map(sharedKey));
    return keys.map((_, i) => (typeof got[i] === "string" ? (got[i] as string) : null));
  } catch (e) {
    warn("redis", e);
    return keys.map(() => null);
  }
}

/** One pipelined request for all new translations. */
async function sharedSet(entries: [string, string][]) {
  if (!redis || !entries.length) return;
  try {
    const pipe = redis.pipeline();
    for (const [k, v] of entries) pipe.set(sharedKey(k), v, { ex: SHARED_TTL });
    await pipe.exec();
  } catch (e) {
    warn("redis", e);
  }
}

const UNIT = 950; // longer texts are split into sentence groups up to this size
const CONCURRENCY = 5;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

const clean = (s: string) => s.replace(/[​-‍﻿]/g, "").trim();

// ---------- Microsoft (Bing Translator web API) ----------

type BingSession = { IG: string; IID: string; key: string; token: string; cookie: string; expires: number };
let bing: BingSession | null = null;

async function bingSession(fresh = false): Promise<BingSession> {
  if (bing && !fresh && Date.now() < bing.expires) return bing;
  const res = await fetch("https://www.bing.com/translator", {
    headers: { "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  const html = await res.text();
  const IG = html.match(/IG:"([^"]+)"/)?.[1];
  const IID = html.match(/data-iid="([^"]+)"/)?.[1];
  const ap = html.match(/params_AbusePreventionHelper\s*=\s*\[([^\]]+)\]/)?.[1];
  if (!IG || !IID || !ap) throw new Error("bing: could not read token");
  const [key, token, ttl] = ap.split(",").map((s) => s.replace(/"/g, "").trim());
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  // Refresh a few minutes before the token expires (usually 1 hour).
  bing = { IG, IID, key, token, cookie, expires: Date.now() + Math.max(60_000, Number(ttl) - 300_000 || 1_800_000) };
  return bing;
}

async function bingCall(text: string, target: Lang, s: BingSession): Promise<string> {
  const res = await fetch(`https://www.bing.com/ttranslatev3?isVertical=1&IG=${s.IG}&IID=${s.IID}`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: s.cookie,
      Referer: "https://www.bing.com/translator",
    },
    body: new URLSearchParams({ fromLang: "auto-detect", to: target, text, token: s.token, key: s.key }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  const data: any = await res.json().catch(() => null);
  const out = Array.isArray(data) ? data[0]?.translations?.[0]?.text : undefined;
  if (typeof out !== "string") throw new Error(`bing ${res.status} ${data?.statusCode ?? ""}`);
  return out;
}

const microsoft: Provider = {
  name: "microsoft",
  free: true,
  maxChars: 1000,
  enabled: () => true,
  translate: bingBatch,
};

/** Sends texts as lines of one request. If Bing merges or splits lines, retries each half separately. */
async function bingBatch(texts: string[], target: Lang): Promise<string[]> {
  const joined = texts.join("\n");
  let out: string;
  try {
    out = await bingCall(joined, target, await bingSession());
  } catch {
    out = await bingCall(joined, target, await bingSession(true)); // token may have expired
  }
  const lines = out.split("\n");
  if (lines.length === texts.length) return lines;
  if (texts.length === 1) return [out.replace(/\n+/g, " ")];
  const mid = Math.ceil(texts.length / 2);
  const [a, b] = await Promise.all([bingBatch(texts.slice(0, mid), target), bingBatch(texts.slice(mid), target)]);
  return [...a, ...b];
}

// ---------- Google (free endpoint) ----------

// Google rate-limits per host, so rotate to the next one on 429.
const GOOGLE_HOSTS = [
  "https://translate.googleapis.com/translate_a/t?client=gtx",
  "https://clients5.google.com/translate_a/t?client=dict-chrome-ex",
  "https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex",
  "https://clients5.google.com/translate_a/t?client=gtx",
];
let googleHost = 0;

const google: Provider = {
  name: "google",
  free: true,
  maxChars: 4000,
  enabled: () => true,
  async translate(texts, target) {
    const body = new URLSearchParams(texts.map((t) => ["q", t]));
    let lastErr: unknown;
    for (let attempt = 0; attempt < GOOGLE_HOSTS.length; attempt++) {
      const base = GOOGLE_HOSTS[(googleHost + attempt) % GOOGLE_HOSTS.length];
      try {
        const res = await fetch(`${base}&sl=auto&tl=${target}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body,
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) throw new Error(`google ${res.status}`);
        const data: unknown = await res.json();
        if (!Array.isArray(data) || data.length !== texts.length) throw new Error("google: unexpected response");
        googleHost = (googleHost + attempt) % GOOGLE_HOSTS.length;
        return data.map((d) => String(Array.isArray(d) ? d[0] : d));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  },
};

// ---------- Claude (optional, needs ANTHROPIC_API_KEY) ----------
// Models that accept the server-side refusal fallback ("default" routes by refusal category).
const FALLBACK_MODELS = /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/;

let anthropic: Anthropic | null = null;
const TranslationsSchema = z.object({ translations: z.array(z.string()) });
const LANG_NAME: Record<Lang, string> = { vi: "Vietnamese", en: "English" };

const claude: Provider = {
  name: "claude",
  maxChars: 8000,
  enabled: () => !!process.env.ANTHROPIC_API_KEY,
  async translate(texts, target) {
    anthropic ??= new Anthropic();
    const model = process.env.TRANSLATE_MODEL || "claude-haiku-5-5";
    const fallback = FALLBACK_MODELS.test(model);
    const response = await anthropic.beta.messages.parse({
      model,
      max_tokens: 16000,
      // A rare policy decline (e.g. a crime story) is re-run on another model in the same call.
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      // Translation needs little thinking: low effort keeps it fast and cheap.
      output_config: { effort: "low", format: betaZodOutputFormat(TranslationsSchema) },
      system:
        `You translate news for a ${LANG_NAME[target]}-language magazine covering tech, finance, sport, film, design and art. ` +
        `Translate each input string into natural, fluent ${LANG_NAME[target]} as a native journalist would write it. ` +
        "Keep names of people, clubs, teams, films, brands and products in their original form. " +
        "Return exactly one translation per input, in the same order.",
      messages: [{ role: "user", content: JSON.stringify(texts) }],
    });
    const out = response.parsed_output?.translations;
    if (response.stop_reason !== "end_turn" || !out || out.length !== texts.length) {
      throw new Error(`claude: ${response.stop_reason}`);
    }
    return out;
  },
};

/** Sections translated by Claude first (the others use the free translators first). */
export const CLAUDE_CATEGORIES = new Set(["design", "ui-ux", "cong-nghe"]);
export type Prefer = "claude" | "free";
export const preferFor = (category: string): Prefer => (CLAUDE_CATEGORIES.has(category) ? "claude" : "free");
const ORDER: Record<Prefer, Provider[]> = { free: [microsoft, google, claude], claude: [claude, microsoft, google] };

// ---------- circuit breaker and serving stats ----------

const PAUSE = 5 * 60_000;
const downUntil = new Map<string, number>();
const isDown = (p: Provider) => Date.now() < (downUntil.get(p.name) ?? 0);

/** A "translation" that came back unchanged although it reads like a sentence: treat as failed. */
const looksUntranslated = (src: string, out: string) => out.trim() === src.trim() && (src.match(/\p{L}{2,}/gu)?.length ?? 0) >= 4;

// Which translator served how many pieces, logged at most once a minute (no text, no keys).
const served = new Map<string, number>();
let lastStats = Date.now();
function count(name: string, n: number) {
  served.set(name, (served.get(name) ?? 0) + n);
  if (Date.now() - lastStats < 60_000) return;
  lastStats = Date.now();
  console.info(`[translate] served: ${[...served].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  served.clear();
}

// ---------- chain ----------

/** Splits long text into sentence groups of at most UNIT characters. */
function toUnits(text: string): string[] {
  const t = text.replace(/\s*\n+\s*/g, " ").trim();
  if (t.length <= UNIT) return [t];
  const out: string[] = [];
  let cur = "";
  for (let s of t.split(/(?<=[.!?…])\s+/)) {
    while (s.length > UNIT) {
      // A single very long sentence: cut at a space.
      const cut = s.lastIndexOf(" ", UNIT) > 0 ? s.lastIndexOf(" ", UNIT) : UNIT;
      if (cur) out.push(cur), (cur = "");
      out.push(s.slice(0, cut));
      s = s.slice(cut).trim();
    }
    if (cur && cur.length + 1 + s.length > UNIT) out.push(cur), (cur = "");
    cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

function chunk(idx: number[], units: string[], maxChars: number): number[][] {
  const chunks: number[][] = [];
  let cur: number[] = [];
  let len = 0;
  for (const i of idx) {
    const l = units[i].length + 1;
    if (cur.length && len + l > maxChars) chunks.push(cur), (cur = []), (len = 0);
    cur.push(i);
    len += l;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function runLimited<T>(items: T[], fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
}

const warned = new Map<string, number>();
function warn(name: string, e: unknown) {
  if (Date.now() - (warned.get(name) ?? 0) < 60_000) return; // at most once a minute per translator
  warned.set(name, Date.now());
  console.warn(`[translate] ${name} failed, trying the next one:`, String(e));
}

/** Translates many texts. Falls back to the original text when every translator fails. */
export async function translateMany(texts: string[], target: Lang, opts: { prefer?: Prefer } = {}): Promise<string[]> {
  const out = texts.slice();
  const todo: number[] = [];
  const claimed = new Set<string>();
  const waitFor = new Map<number, Promise<unknown>>(); // texts another request is translating
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  texts.forEach((t, i) => {
    if (!t.trim()) return;
    const key = `${target}|${t}`;
    const hit = cache.get(key);
    if (hit !== undefined) out[i] = hit;
    // Another request is already translating this text: wait for it instead of sending it twice.
    else if (inFlight.has(key) && !claimed.has(key)) waitFor.set(i, inFlight.get(key)!);
    else {
      inFlight.set(key, mine);
      claimed.add(key);
      todo.push(i);
    }
  });
  try {
    // Already translated by another server instance? (one request for all of them)
    if (todo.length && redis) {
      const got = await sharedGet(todo.map((i) => `${target}|${texts[i]}`));
      let hits = 0;
      todo.splice(0, todo.length, ...todo.filter((i, j) => {
        const v = got[j];
        if (v === null) return true;
        out[i] = v;
        cache.set(`${target}|${texts[i]}`, v);
        hits++;
        return false;
      }));
      if (hits) count("shared-hit", hits);
      if (todo.length) count("shared-miss", todo.length);
    }
    if (todo.length) {
      await translatePending(texts, target, out, todo, ORDER[opts.prefer ?? "free"]);
      // Share what was just translated (texts left in the original language are not stored).
      await sharedSet(
        todo.flatMap((i): [string, string][] => {
          const v = cache.get(`${target}|${texts[i]}`);
          return v !== undefined ? [[`${target}|${texts[i]}`, v]] : [];
        })
      );
    }
  } finally {
    claimed.forEach((k) => inFlight.delete(k));
    release();
  }
  if (waitFor.size) {
    await Promise.all(waitFor.values());
    for (const i of waitFor.keys()) out[i] = cache.get(`${target}|${texts[i]}`) ?? texts[i];
  }
  return out;
}

/** Texts being translated right now, with the request doing it (resolves when it is done). */
const inFlight = new Map<string, Promise<void>>();

async function translatePending(texts: string[], target: Lang, out: string[], todo: number[], providers: Provider[]): Promise<string[]> {

  // Break texts into units; remember which units make up each text.
  const units: string[] = [];
  const owner: number[][] = [];
  for (const i of todo) {
    owner[i] = toUnits(texts[i]).map((u) => units.push(u) - 1);
  }
  const done: (string | undefined)[] = new Array(units.length);

  for (const p of providers) {
    if (!p.enabled() || isDown(p)) continue;
    const pending = units.map((_, k) => k).filter((k) => done[k] === undefined);
    if (!pending.length) break;
    await runLimited(chunk(pending, units, p.maxChars), async (ids) => {
      if (isDown(p)) return; // it failed on another piece meanwhile: leave the rest to the next one
      try {
        const res = await p.translate(ids.map((k) => units[k]), target);
        let ok = 0;
        ids.forEach((k, j) => {
          const out = clean(res[j] ?? "");
          // Free translators sometimes return empty or untouched text: let the next one try.
          if (p.free && (!out || looksUntranslated(units[k], out))) return;
          done[k] = out || units[k];
          ok++;
        });
        if (ok) count(p.name, ok);
      } catch (e) {
        warn(p.name, e);
        downUntil.set(p.name, Date.now() + PAUSE);
      }
    });
  }

  for (const i of todo) {
    const parts = owner[i].map((k) => done[k]);
    if (parts.some((x) => x === undefined)) continue; // keep the original; retry next time
    out[i] = parts.join(" ");
    cache.set(`${target}|${texts[i]}`, out[i]);
  }
  // Drop the oldest entries instead of everything when the cache gets big.
  if (cache.size > 20000) [...cache.keys()].slice(0, cache.size - 15000).forEach((k) => cache.delete(k));
  saveSoon();
  return out;
}
