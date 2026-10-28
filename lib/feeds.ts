import Parser from "rss-parser";
import { CATEGORIES, SOURCES, type Lang, type Source } from "./sources";
import { excerpt, fromId, stripHtml, toId } from "./text";
import { preferFor, translateMany, type Prefer } from "./translate";
import { videoFromUrl } from "./fulltext";
import { mockArticles } from "./mock";
import { SCRAPERS } from "./scrapers";
import { warmLatest } from "./warm";
import { background } from "./background";

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
    if (Date.now() - memo.at >= REFRESH_SECONDS * 1000) background(refreshFeeds());
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
      background(pretranslate(articles).then(() => warmLatest(articles)));
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
        await translateArticles(picked.slice(i, i + 15), lang);
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
  const all = await getAllArticles();
  return all.find((a) => a.id === id) ?? recoverArticle(id, all);
}

/** "vnexpress.net" for "e.vnexpress.net", "tapchikientruc.com.vn" for "www.tapchikientruc.com.vn". */
function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  const n = parts.length >= 3 && /^(com|net|org|co|gov|edu|ac)$/.test(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-n).join(".");
}

const recovered = new Map<string, Article | null>();

/**
 * An article that isn't in this server's current feed list: it dropped out of its feed, or
 * this server instance (Vercel runs several) fetched the feeds when that source failed.
 * The id is the article's link, so rebuild the card from the page's own meta tags.
 * Only links on the sites we follow are read.
 */
async function recoverArticle(id: string, all: Article[]): Promise<Article | undefined> {
  if (recovered.has(id)) return recovered.get(id) ?? undefined;
  const link = fromId(id);
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  if (!/^https?:$/.test(url.protocol) || toId(link) !== id) return undefined;
  const base = baseDomain(url.hostname);
  const twin = all.find((a) => baseDomain(new URL(a.link).hostname) === base);
  const sources = SOURCES.filter((s) => baseDomain(new URL(s.url).hostname) === base);
  if (!twin && !sources.length) return undefined;
  let article: Article | null = null;
  try {
    const res = await fetch(link, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    // A missing story often redirects to the home page or a "404.html" page that answers 200.
    const landed = new URL(res.url || link);
    const notAStory = landed.pathname === "/" || /(^|\/)(404|not-?found)(\.html?)?\/?$/i.test(landed.pathname);
    if (res.ok && !notAStory) {
      const html = decodeBody(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type"));
      const end = html.search(/<\/head>/i);
      const head = end > 0 ? html.slice(0, end) : html.slice(0, 400_000);
      const meta = (key: string) => {
        const tag = head.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"))?.[0];
        const v = tag?.match(/content=["']([^"']*)["']/i)?.[1];
        return v ? stripHtml(v) : undefined;
      };
      const title = meta("og:title") ?? meta("twitter:title") ?? stripHtml(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      // Home and section pages say og:type "website"; stories say "article" (or nothing).
      const type = meta("og:type")?.toLowerCase();
      // Several feeds of one site (VnExpress Thể thao, Giải trí…): pick the one whose section
      // matches the page's own section names (meta tags, breadcrumb names, its address).
      const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const section = fold([meta("tt_list_folder_name"), meta("article:section"), meta("category"), meta("og:url"), landed.pathname].filter(Boolean).join(" "));
      const words = (s: (typeof SOURCES)[number]) =>
        new URL(s.url).pathname.split("/").map((p) => p.replace(/\.(rss|xml|html?)$/i, "")).filter((p) => p && !/^(rss|feeds?|category|index|home|news)$/i.test(p));
      const src = [...sources].sort((x, y) => words(y).filter((w) => section.includes(w)).length - words(x).filter((w) => section.includes(w)).length)[0];
      if (title && (!type || type === "article" || type === "news" || type.startsWith("video"))) {
        const desc = meta("og:description") ?? meta("description") ?? "";
        let image = meta("og:image") ?? meta("twitter:image");
        if (image?.startsWith("//")) image = `https:${image}`;
        article = {
          id,
          title,
          link,
          excerpt: excerpt(desc),
          text: desc,
          image,
          source: src?.name ?? twin!.source,
          category: src?.category ?? twin!.category,
          lang: src?.lang ?? twin!.lang,
          region: src?.region ?? twin!.region,
          published: parseDate(meta("article:published_time") ?? meta("pubdate") ?? undefined),
        };
      }
    }
  } catch {}
  recovered.set(id, article);
  if (!article) setTimeout(() => recovered.delete(id), 10 * 60_000); // try again later
  if (recovered.size > 2000) recovered.delete(recovered.keys().next().value!);
  return article ?? undefined;
}

/** True when some shown articles are still in the other language (translation still running). */
export function hasUntranslated(articles: Article[], lang: Lang): boolean {
  return articles.some((a) => a.lang !== lang && a.pending);
}

/**
 * Title and excerpt of each article, translated: sections in CLAUDE_CATEGORIES go to Claude
 * first, the rest to the free translators first. Returns [title, excerpt] per article.
 */
async function translateArticles(list: Article[], lang: Lang): Promise<[string, string][]> {
  const out: [string, string][] = list.map((a) => [a.title, a.excerpt]);
  const groups = new Map<Prefer, number[]>();
  list.forEach((a, i) => groups.set(preferFor(a.category), [...(groups.get(preferFor(a.category)) ?? []), i]));
  await Promise.all(
    [...groups].map(async ([prefer, idx]) => {
      // Names (award-winning websites) keep their title; an empty string is not translated.
      const tr = await translateMany(idx.flatMap((i) => [list[i].keepTitle ? "" : list[i].title, list[i].excerpt]), lang, { prefer });
      idx.forEach((i, j) => (out[i] = [list[i].keepTitle ? list[i].title : tr[j * 2], tr[j * 2 + 1]]));
    })
  );
  return out;
}

/** Translates title and excerpt of articles whose language differs from the reader's choice. */
export async function localize(articles: Article[], lang: Lang, waitMs = 1500): Promise<Article[]> {
  const need = articles.filter((a) => a.lang !== lang);
  if (!need.length) return articles;
  // Don't hold the page for long: after waitMs show the original text. Translation keeps
  // going in the background and fills the cache for the next visit.
  let timedOut = false;
  const original = need.map((a): [string, string] => [a.title, a.excerpt]);
  const job = translateArticles(need, lang);
  // If the page stops waiting, the translation still finishes and fills the cache.
  background(job);
  const tr = await Promise.race([
    job,
    new Promise<[string, string][]>((r) => setTimeout(() => ((timedOut = true), r(original)), waitMs)),
  ]);
  const map = new Map(need.map((a, i) => [a.id, { title: tr[i][0], excerpt: tr[i][1] }]));
  return articles.map((a) => {
    const t = map.get(a.id);
    if (t && (t.title !== a.title || t.excerpt !== a.excerpt)) return { ...a, ...t, translated: true };
    // Still in the original language because we stopped waiting: the page refreshes later.
    return t && timedOut ? { ...a, pending: true } : a;
  });
}
