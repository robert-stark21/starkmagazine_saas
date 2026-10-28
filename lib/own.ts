import { createHash } from "node:crypto";
import type { Article } from "./feeds";
import { decodeBody, itemsFromFeed } from "./feeds";
import { kvGet, kvSet } from "./kv";
import { isPublicHostCached, safeFetch, UnsafeUrlError } from "./safe-fetch";
import { CATEGORIES, getCategory, type Category, type Source } from "./sources";
import type { OwnSection, OwnSource, User } from "./auth";

/**
 * Readers' own sources and sections. A reader pastes a site or feed address; we find its
 * RSS/Atom feed and add it to one of the site's sections or to a section they made. Their
 * stories are fetched like the site's (10-minute cache, shared through Redis) and stored by
 * id for 3 days so the article page can open them.
 */
export const MAX_SOURCES = 30;
export const MAX_SECTIONS = 10;
const FEED_TTL = 600; // seconds
const ARTICLE_TTL = 3 * 86400;

export const SECTION_COLORS = ["#2563eb", "#059669", "#dc2626", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#4d7c0f", "#475569", "#a16207"];

export const ownSlug = (s: OwnSection) => `u-${s.id}`;
export const ownCategories = (u: User | null): Category[] =>
  (u?.sections ?? []).map((s) => ({ slug: ownSlug(s), vi: s.name, en: s.name, color: s.color }));

/** A site section or one of this reader's own. */
export function categoryFor(slug: string, u: User | null): Category | undefined {
  return getCategory(slug) ?? ownCategories(u).find((c) => c.slug === slug);
}

// ---------- Finding a feed ----------
export class SourceError extends Error {
  constructor(public code: "bad_url" | "blocked" | "no_feed" | "unreachable") {
    super(code);
  }
}

const looksLikeFeed = (text: string) => /<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 3000));

function guessLang(titles: string[]): "vi" | "en" {
  const vi = titles.filter((t) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(t)).length;
  return vi >= Math.max(1, titles.length / 3) ? "vi" : "en";
}

/** Finds the feed for an address (a feed itself, a page that links one, or /feed, /rss…). */
export async function discoverFeed(input: string): Promise<{ url: string; name: string; site: string; lang: "vi" | "en" }> {
  let start: URL;
  try {
    const raw = input.trim();
    start = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new SourceError("bad_url");
  }
  const tryFeed = async (url: string) => {
    const r = await safeFetch(url, { timeoutMs: 8000 });
    if (!r.ok) return null;
    const text = decodeBody(r.body, r.contentType);
    return { r, text, feed: looksLikeFeed(text) };
  };

  let first;
  try {
    first = await tryFeed(start.toString());
  } catch (e) {
    throw new SourceError(e instanceof UnsafeUrlError ? "blocked" : "unreachable");
  }
  const candidates: string[] = [];
  if (first?.feed) candidates.push(first.r.url);
  else {
    if (first) {
      // <link rel="alternate" type="application/rss+xml" href="…">
      for (const m of first.text.matchAll(/<link\b[^>]*>/gi)) {
        const tag = m[0];
        if (!/rel=["']?alternate/i.test(tag) || !/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
        const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
        if (href) candidates.push(new URL(href.replace(/&amp;/g, "&"), first.r.url).toString());
      }
    }
    const origin = start.origin;
    candidates.push(...["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml", "/feeds/posts/default"].map((p) => origin + p));
  }

  for (const url of [...new Set(candidates)].slice(0, 8)) {
    try {
      const got = url === first?.r.url && first.feed ? first : await tryFeed(url);
      if (!got?.feed) continue;
      const items = await itemsFromFeed(got.r.body, got.r.contentType, { name: "", url, category: "", lang: "en", region: "intl" });
      if (!items.length) continue;
      const title = got.text.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim();
      const site = new URL(items[0].link).hostname.replace(/^www\./, "");
      // "CarScoops - The Inside Track to…" → "CarScoops"
      const short = title?.replace(/&amp;/g, "&").split(/\s+[-–—|:·»]\s+/)[0].trim();
      return {
        url: got.r.url,
        name: short && short.length <= 40 ? short : site,
        site,
        lang: guessLang(items.map((i) => i.title)),
      };
    } catch (e) {
      if (e instanceof UnsafeUrlError) throw new SourceError("blocked");
    }
  }
  throw new SourceError("no_feed");
}

export const sourceId = (url: string) => createHash("sha1").update(url).digest("base64url").slice(0, 12);

// ---------- Reading a reader's sources ----------
const memo = new Map<string, { at: number; items: Article[] }>();
const inflight = new Map<string, Promise<Article[]>>();

async function fetchOwnSource(src: OwnSource): Promise<Article[]> {
  const hit = memo.get(src.url);
  if (hit && Date.now() - hit.at < FEED_TTL * 1000) return hit.items;
  const running = inflight.get(src.url);
  if (running) return running;
  const job = (async () => {
    // Another server instance may have read it a moment ago.
    const shared = await kvGet(`of:${src.id}`).catch(() => null);
    if (shared) {
      const items = JSON.parse(shared) as Article[];
      memo.set(src.url, { at: Date.now(), items });
      return items;
    }
    const r = await safeFetch(src.url, { timeoutMs: 10_000 });
    if (!r.ok) throw new Error(`${src.name}: ${r.status}`);
    const source: Source = { name: src.name, url: src.url, category: src.cat, lang: src.lang, region: src.lang === "vi" ? "vn" : "intl" };
    const parsed = await itemsFromFeed(r.body, r.contentType, source);
    // Only stories on public sites: the article page fetches them.
    const items: Article[] = [];
    for (const a of parsed) if (await isPublicHostCached(a.link)) items.push(a);
    memo.set(src.url, { at: Date.now(), items });
    await kvSet(`of:${src.id}`, JSON.stringify(items), { ex: FEED_TTL }).catch(() => {});
    // Keep each story openable for a few days.
    await Promise.all(items.map((a) => kvSet(`oa:${a.id}`, JSON.stringify(a), { ex: ARTICLE_TTL }).catch(() => {})));
    return items;
  })().finally(() => inflight.delete(src.url));
  inflight.set(src.url, job);
  return job;
}

/** All stories from this reader's sources, newest first, labelled with their section. Waits at most `waitMs`. */
export async function ownArticles(u: User | null, waitMs = 4000): Promise<Article[]> {
  if (!u?.sources?.length) return [];
  const own = new Map(ownCategories(u).map((c) => [c.slug, c]));
  const lists = await Promise.all(
    u.sources.map((s) =>
      Promise.race([fetchOwnSource(s), new Promise<Article[]>((r) => setTimeout(() => r(memo.get(s.url)?.items ?? []), waitMs))]).catch((e) => {
        console.warn("[own] source failed:", s.url, String(e));
        return [] as Article[];
      })
    )
  );
  const out: Article[] = [];
  const seen = new Set<string>();
  lists.forEach((items, i) => {
    const src = u.sources![i];
    const sec = own.get(src.cat);
    // A section that was deleted: its sources fall back to a site section… or are skipped.
    if (!sec && !CATEGORIES.some((c) => c.slug === src.cat)) return;
    for (const a of items) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push({ ...a, source: src.name, category: src.cat, own: sec ? { name: sec.vi, color: sec.color } : undefined });
    }
  });
  return out.sort((a, b) => b.published.localeCompare(a.published));
}

/** A story from some reader's source, by id (for the article page). */
export async function getOwnArticle(id: string): Promise<Article | undefined> {
  for (const { items } of memo.values()) {
    const a = items.find((x) => x.id === id);
    if (a) return a;
  }
  try {
    const raw = await kvGet(`oa:${id}`);
    return raw ? (JSON.parse(raw) as Article) : undefined;
  } catch {
    return undefined;
  }
}
