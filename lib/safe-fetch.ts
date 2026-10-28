import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch for addresses readers type in (their own news sources). Only public http(s) sites:
 * no localhost, private networks or cloud metadata addresses, checked again after every
 * redirect, with a time and size limit.
 */
const BLOCKED_HOST = /(^|\.)(localhost|local|internal|intranet|home|lan|corp)$/i;

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? privateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export async function isPublicUrl(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST.test(host) || !host.includes(".") && !isIP(host)) return false;
  if (isIP(host)) return !privateIp(host);
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
  } catch {
    return false;
  }
}

const hostOk = new Map<string, { ok: boolean; at: number }>();
/** isPublicUrl, remembered per host for an hour (for links inside feeds). */
export async function isPublicHostCached(raw: string): Promise<boolean> {
  let host: string;
  try {
    host = new URL(raw).host;
  } catch {
    return false;
  }
  const hit = hostOk.get(host);
  if (hit && Date.now() - hit.at < 3600_000) return hit.ok;
  const ok = await isPublicUrl(raw);
  hostOk.set(host, { ok, at: Date.now() });
  return ok;
}

export class UnsafeUrlError extends Error {}

export async function safeFetch(url: string, opts: { timeoutMs?: number; maxBytes?: number; accept?: string } = {}) {
  const { timeoutMs = 10_000, maxBytes = 3_000_000 } = opts;
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!(await isPublicUrl(current))) throw new UnsafeUrlError(current);
    const res = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; STARK/1.0; +rss reader)",
        Accept: opts.accept ?? "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      void res.body?.cancel().catch(() => {});
      continue;
    }
    // Read at most maxBytes.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size > maxBytes ? chunks.reduce((n, c) => n + c.length, 0) : size);
    let off = 0;
    for (const c of chunks) body.set(c, off), (off += c.length);
    return { ok: res.ok, status: res.status, url: current, contentType: res.headers.get("content-type"), body };
  }
  throw new Error("too many redirects");
}
