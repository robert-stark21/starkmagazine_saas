import Parser from "rss-parser";
import { CATEGORIES, SOURCES, type Lang, type Source } from "./sources";
import { excerpt, stripHtml, toId } from "./text";
import { translateMany } from "./translate";
import { videoFromUrl } from "./fulltext";
import { mockArticles } from "./mock";
import { SCRAPERS } from "./scrapers";
import { warmLatest } from "./warm";

export const REFRESH_SECONDS = 600; // 10 minutes

export type Article = {
  id: string;
  title: string;
  link: string;
  excerpt: string;
  text: string; // plain-text body from the feed
  image?: string;
  video?: { provider: "youtube" | "vimeo" | "file" | "hls"; src: string; poster?: string };
  source: string;
  category: string;
  lang: Lang;
  region: "vn" | "intl";
  published: string;
  translated?: boolean;
  pending?: boolean; // shown untranslated because translation was still running
  keepTitle?: boolean; // the title is a name (an award-winning website): never translated
};

type Item = Record<string, any>;

const parser: Parser<{}, Item> = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

/** A video attached to the feed item (media:content, enclosure, or an embedded player). */
function findVideo(item: Item): Article["video"] {
  const media = [
    ...(item.mediaContent ?? []).filter((m: any) => m?.$?.medium === "video" || m?.$?.type?.startsWith("video")).map((m: any) => m.$.url),
    item.enclosure?.type?.startsWith("video") ? item.enclosure.url : undefined,
  ];
  const html = `${item.contentEncoded ?? ""} ${item.content ?? ""}`;
  const embeds = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const u of [...media, ...embeds]) {
    const v = videoFromUrl(u);
    if (v) return v;
  }
  return undefined;
}

function findImage(item: Item): string | undefined {
  const mc = item.mediaContent?.find?.((m: any) => m?.$?.url)?.$?.url;
  const mt = item.mediaThumbnail?.$?.url;
  const enc = item.enclosure?.type?.startsWith("image") || /\.(jpe?g|png|webp|gif)/i.test(item.enclosure?.url ?? "")
    ? item.enclosure?.url
    : undefined;
  const html = `${item.contentEncoded ?? ""} ${item.content ?? ""} ${item.description ?? ""}`;
  const img = html.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1];
  const url = mc || mt || enc || img;
  return url?.startsWith("//") ? `https:${url}` : url;
}

// Videos, live blogs and podcasts have no article text to show.
const NOT_ARTICLE = /\/(watch|videos?|live-blog|live|audio|podcasts?)\//i;

// Time zone names JavaScript can't parse (e.g. Sky Sports uses "BST").
const ZONES: Record<string, string> = {
  BST: "+0100", CET: "+0100", CEST: "+0200", EET: "+0200", EEST: "+0300",
  AEST: "+1000", AEDT: "+1100", ICT: "+0700", JST: "+0900", KST: "+0900",
};

function parseDate(raw?: string): string {
  if (raw) {
    let d = new Date(raw);
    if (isNaN(d.getTime())) d = new Date(raw.replace(/\b([A-Z]{3,4})$/, (z) => ZONES[z] ?? z));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/** Decodes the feed using its declared charset (header or XML prolog), defaulting to UTF-8. */
function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 300));
  const charset =
    contentType?.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function fetchSource(src: Source): Promise<Article[]> {
  if (src.scrape) {
    // Listing pages of sites without a usable feed (award sites, UXmatters, ColorME…).
    const items = await SCRAPERS[src.scrape](src.url);
    const list: Article[] = items.slice(0, 20).map((it) => ({
      id: toId(it.link),
      title: it.title,
      link: it.link,
      excerpt: it.excerpt ?? "",
      text: it.excerpt ?? "",
      image: it.image,
      source: src.name,
      category: it.category ?? src.category,
      lang: src.lang,
      region: src.region,
      published: it.published,
      keepTitle: !!it.keepTitle,
    }));
    return src.pageImages ? addPageImages(list) : list;
  }
  const res = await fetch(src.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TinTongHop/1.0; +rss reader)" },
    // We cache parsed results in memory below, so skip Next's fetch cache (it rejects feeds over 2MB).
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${src.name}: ${res.status}`);
  // Some feeds contain a bare "&" which breaks the XML parser.
  const xml = decodeBody(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type")).replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  const feed = await parser.parseString(xml);
  const items: Article[] = (feed.items ?? []).slice(0, 20).flatMap((item) => {
    let link = item.link?.trim();
    // GameK's feeds link through a tracking host (cl44.cnnd.vn) that refuses visitors: use the site itself.
    if (link && /^https?:\/\/[^/]+\.cnnd\.vn\//.test(link)) link = new URL(src.url).origin + new URL(link).pathname;
    const title = stripHtml(item.title ?? "");
    if (!link || !title || NOT_ARTICLE.test(link)) return [];
    const text = stripHtml(item.contentEncoded || item.content || item.description || item.contentSnippet || "");
    return [
      {
        id: toId(link),
        title,
        link,
        excerpt: excerpt(text),
        text,
        image: findImage(item),
        video: findVideo(item),
        source: src.name,
        category: src.category,
        lang: src.lang,
        region: src.region,
        published: parseDate(item.isoDate || item.pubDate),
      },
    ];
  });
  return src.pageImages ? addPageImages(items) : items;
}

const pageImageCache = new Map<string, string | null>();

/** Reads an article page only up to </head> and returns its og:image. Remembered per link. */
async function pageImage(link: string): Promise<string | undefined> {
  if (pageImageCache.has(link)) return pageImageCache.get(link) ?? undefined;
  let found: string | null = null;
  try {
    const res = await fetch(link, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const reader = res.body?.getReader();
    const dec = new TextDecoder();
    let head = "";
    while (reader && head.length < 400_000) {
      const { done, value } = await reader.read();
      if (done) break;
      head += dec.decode(value, { stream: true });
      if (head.includes("</head>")) break;
    }
    void reader?.cancel().catch(() => {});
    const tag = head.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
    found = tag?.match(/content=["']([^"']+)["']/i)?.[1] ?? null;
  } catch {}
  pageImageCache.set(link, found);
  if (pageImageCache.size > 3000) pageImageCache.delete(pageImageCache.keys().next().value!);
  return found ?? undefined;
}

/** Fills missing pictures from the article pages, four pages at a time. */
async function addPageImages(articles: Article[]): Promise<Article[]> {
  const out = articles.slice();
  let next = 0;
  const worker = async () => {
    while (next < out.length) {
      const i = next++;
      if (!out[i].image) out[i] = { ...out[i], image: await pageImage(out[i].link) };
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return out;
}

let memo: { at: number; articles: Article[] } | null = null;
let inflight: Promise<Article[]> | null = null;

/** All articles from every source, newest first. Cached for 10 minutes. */
export async function getAllArticles(): Promise<Article[]> {
  if (process.env.MOCK_FEEDS === "1") return mockArticles();
  // Stale-while-revalidate: once we have articles, never make a visitor wait for the feeds.
  if (memo) {
    if (Date.now() - memo.at >= REFRESH_SECONDS * 1000) void refreshFeeds();
    return memo.articles;
  }
  return refreshFeeds();
}

/** Fetches every feed, then translates titles in the background. Only one refresh runs at a time. */
export function refreshFeeds(): Promise<Article[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const results = await Promise.allSettled(SOURCES.map(fetchSource));
    results.forEach((r, i) => {
      if (r.status === "rejected") console.warn(`[feeds] ${SOURCES[i].name} failed:`, String(r.reason));
    });
    const seen = new Set<string>();
    const articles = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
      .filter((a) => new Date(a.published).getTime() <= Date.now() + 3600_000)
      .sort((a, b) => b.published.localeCompare(a.published));
    if (articles.length) {
      memo = { at: Date.now(), articles };
      // Titles first, then the bodies of the newest stories, so they open instantly.
      void pretranslate(articles).then(() => warmLatest(articles));
    } else if (memo) {
      memo = { ...memo, at: Date.now() }; // all feeds failed: keep old articles, try again later
    }
    return memo?.articles ?? [];
  })().finally(() => (inflight = null));
  return inflight;
}

let warming = false;

/** Translates titles and excerpts that list pages show, so pages find them in the cache. */
async function pretranslate(articles: Article[]) {
  if (warming) return;
  warming = true;
  try {
    for (const lang of ["vi", "en"] as Lang[]) {
      const picked = CATEGORIES.flatMap((c) =>
        // The 60 newest overall plus the 60 newest per region, so the VN / international
        // filters on category pages are covered too.
        ["all", "vn", "intl"].flatMap((r) =>
          articles
            .filter((a) => a.category === c.slug && a.lang !== lang && (r === "all" || a.region === r))
            .slice(0, c.slug === "inspiration" ? 120 : 60)
        )
      );
      picked.splice(0, picked.length, ...new Set(picked));
      // Newest first, in small batches, so translations reach the cache (and pages) quickly.
      picked.sort((a, b) => b.published.localeCompare(a.published));
      for (let i = 0; i < picked.length; i += 15) {
        await translateMany(picked.slice(i, i + 15).flatMap((a) => [a.title, a.excerpt]), lang);
      }
    }
  } catch (e) {
    console.warn("[feeds] pre-translation failed:", String(e));
  } finally {
    warming = false;
  }
}

export function lastUpdated(): Date {
  return new Date(memo?.at ?? Date.now());
}

export async function getArticle(id: string): Promise<Article | undefined> {
  return (await getAllArticles()).find((a) => a.id === id);
}

/** True when some shown articles are still in the other language (translation still running). */
export function hasUntranslated(articles: Article[], lang: Lang): boolean {
  return articles.some((a) => a.lang !== lang && a.pending);
}

/** Translates title and excerpt of articles whose language differs from the reader's choice. */
export async function localize(articles: Article[], lang: Lang, waitMs = 1500): Promise<Article[]> {
  const need = articles.filter((a) => a.lang !== lang);
  if (!need.length) return articles;
  // Names (award-winning websites) keep their title; an empty string is not translated.
  const texts = need.flatMap((a) => [a.keepTitle ? "" : a.title, a.excerpt]);
  // Don't hold the page for long: after waitMs show the original text. Translation keeps
  // going in the background and fills the cache for the next visit.
  let timedOut = false;
  const tr = await Promise.race([
    translateMany(texts, lang),
    new Promise<string[]>((r) => setTimeout(() => ((timedOut = true), r(texts)), waitMs)),
  ]);
  const map = new Map(need.map((a, i) => [a.id, { title: a.keepTitle ? a.title : tr[i * 2], excerpt: tr[i * 2 + 1] }]));
  return articles.map((a) => {
    const t = map.get(a.id);
    if (t && (t.title !== a.title || t.excerpt !== a.excerpt)) return { ...a, ...t, translated: true };
    // Still in the original language because we stopped waiting: the page refreshes later.
    return t && timedOut ? { ...a, pending: true } : a;
  });
}
