import { parseHTML } from "linkedom";

/**
 * List pages for sources without a usable feed (or with a stale one). Each scraper turns the
 * site's listing into feed-like items (title, link, picture, date).
 * `keepTitle`: the title is a name (an award-winning website) and is never translated.
 * `category`: overrides the source's section for this item.
 */
export type ScrapedItem = {
  title: string;
  link: string;
  image?: string;
  excerpt?: string;
  published: string;
  keepTitle?: boolean;
  category?: string;
};

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" };
const DAY = 86_400_000;

async function page(url: string) {
  const r = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(25000) }); // Awwwards can take ~18s
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return parseHTML(await r.text()).document;
}

/** Start of today in Vietnam, minus n days (Sites of the Day come one per day). */
const vnDayStart = (n: number) => new Date(Date.parse(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10) + "T00:00:00+07:00") - n * DAY).toISOString();

/** Awwwards Sites of the Day: newest first; the large 880x660 screenshot from the srcset. */
async function awwwards(url: string): Promise<ScrapedItem[]> {
  const doc: any = await page(url);
  const seen = new Set<string>();
  const out: ScrapedItem[] = [];
  for (const fig of Array.from(doc.querySelectorAll("figure.figure-rollover")) as any[]) {
    const a = fig.querySelector('a[href^="/sites/"]');
    const href = a?.getAttribute("href");
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const img = fig.querySelector("img");
    const srcset: string = img?.getAttribute("data-srcset") ?? img?.getAttribute("srcset") ?? "";
    const big = srcset.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean).pop();
    out.push({
      title: img?.getAttribute("alt") || a.getAttribute("aria-label") || href.split("/").pop(),
      link: new URL(href, url).href,
      image: big || img?.getAttribute("data-src") || undefined,
      excerpt: "Awwwards Site of the Day",
      published: vnDayStart(out.length),
      keepTitle: true,
    });
  }
  return out;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** CSS Design Awards, Website of the Day winners: screenshot, name and the award date. */
async function cssda(url: string): Promise<ScrapedItem[]> {
  const doc: any = await page(url);
  const out: ScrapedItem[] = [];
  const now = new Date();
  for (const box of Array.from(doc.querySelectorAll(".single-project__thumbnail")) as any[]) {
    const href = box.querySelector('a[href^="/sites/"]')?.getAttribute("href");
    const img = box.querySelector('img[src*="/cdasites/"]');
    if (!href || !img) continue;
    const [mon, day] = (box.querySelector(".sp__meta__date")?.textContent ?? "").trim().toUpperCase().split(/\s+/);
    let published = now.toISOString();
    const m = MONTHS.indexOf(mon);
    if (m >= 0 && +day) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), m, +day, 5)); // noon in Vietnam
      if (d.getTime() > now.getTime() + DAY) d.setUTCFullYear(d.getUTCFullYear() - 1);
      published = d.toISOString();
    }
    out.push({
      title: (img.getAttribute("alt") ?? "").replace(/\s+website$/i, "") || href.split("/")[2],
      link: new URL(href, url).href,
      image: new URL(img.getAttribute("src"), url).href,
      excerpt: "CSS Design Awards · Website of the Day",
      published,
      keepTitle: true,
    });
  }
  return out;
}

const text = (el: any) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** UX Foundation case studies (Framer site): "29 thg 9, 2026" dates, project type as excerpt. */
async function uxfoundation(url: string): Promise<ScrapedItem[]> {
  const doc: any = await page(url);
  const seen = new Set<string>();
  const out: ScrapedItem[] = [];
  for (const a of Array.from(doc.querySelectorAll('a[href*="case-study/"]')) as any[]) {
    const link = new URL(a.getAttribute("href"), url).href.split(/[?#]/)[0];
    const title = text(a.querySelector("h1,h2,h3,h4,h5,h6"));
    if (!title || seen.has(link)) continue;
    seen.add(link);
    const labels = (Array.from(a.querySelectorAll("p")) as any[]).map(text).filter((t) => t && !t.includes("thg"));
    const d = text(a).match(/(\d{1,2})\s*thg\s*(\d{1,2}),\s*(\d{4})/);
    const img = a.querySelector("img")?.getAttribute("src");
    out.push({
      title,
      link,
      image: img ? img.split("?")[0] : undefined, // full-size original
      excerpt: [...new Set(labels)].reverse().join(" · "),
      published: d ? new Date(Date.UTC(+d[3], +d[2] - 1, +d[1], 5)).toISOString() : vnDayStart(out.length),
    });
  }
  return out.sort((x, y) => y.published.localeCompare(x.published));
}

/** UXmatters home page: the latest articles with their publication date (the feeds stopped in 2024). */
async function uxmatters(url: string): Promise<ScrapedItem[]> {
  const doc: any = await page(url);
  const out: ScrapedItem[] = [];
  for (const box of Array.from(doc.querySelectorAll("section.article_excerpt1, section[class*=article_excerpt]")) as any[]) {
    const a = box.querySelector("h2.article_title a");
    const href = a?.getAttribute("href");
    if (!href || out.some((o) => o.link === new URL(href, url).href)) continue;
    const date = Date.parse(text(box.querySelector(".publication_date")) + " 12:00 GMT");
    const excerpt = (Array.from(box.querySelectorAll("p")) as any[]).map(text).find((t) => t.length > 60) ?? "";
    out.push({
      title: text(a),
      link: new URL(href, url).href,
      excerpt,
      published: Number.isFinite(date) ? new Date(date).toISOString() : vnDayStart(out.length),
    });
  }
  return out;
}

/** ColorME blog: tutorials and design news; sales posts are skipped, dates come from each page. */
const COLORME_PROMO = /khóa học|ưu đãi|giảm giá|tuyển sinh|khai giảng|học phí|đăng ký học|học bổng|voucher|workshop miễn phí/i;
const COLORME_UIUX = /(^|[^a-zà-ỹ])(ui|ux|figma|thiết kế web|web design|website|giao diện|trải nghiệm người dùng|wireframe|prototype|thiết kế app|app design|ứng dụng di động)([^a-zà-ỹ]|$)/i;

async function colorme(url: string): Promise<ScrapedItem[]> {
  const doc: any = await page(url);
  const seen = new Set<string>();
  const found: ScrapedItem[] = [];
  for (const a of Array.from(doc.querySelectorAll('a[href*="/blog/"]')) as any[]) {
    const link = new URL(a.getAttribute("href"), url).href.split(/[?#]/)[0];
    // Cards have a heading; the numbered "most read" list (older posts, span only) is skipped.
    const title = text(a.querySelector("h1,h2,h3,h4"));
    if (!title || title.length < 12 || seen.has(link) || COLORME_PROMO.test(title)) continue;
    seen.add(link);
    const img = a.querySelector("img")?.getAttribute("src");
    found.push({
      title,
      link,
      image: img ? new URL(img, url).href : undefined,
      excerpt: "",
      published: "",
      // A category page (e.g. "UI UX") keeps the source's section; the main blog is sorted by title.
      category: url.includes("category=") ? undefined : COLORME_UIUX.test(title) ? "ui-ux" : "design",
    });
  }
  // The listing has no dates: read them (and missing pictures) from the pages' <head>.
  const items = found.slice(0, 16);
  await Promise.all(
    items.map(async (it, i) => {
      try {
        const r = await fetch(it.link, { headers: UA, signal: AbortSignal.timeout(10000) });
        const html = await r.text();
        const head = html.slice(0, html.indexOf("</head>") + 1 || 200_000);
        const meta = (p: string) => head.match(new RegExp(`<meta[^>]+property="${p}"[^>]+content="([^"]+)"`))?.[1];
        it.published = meta("article:published_time") ? new Date(meta("article:published_time")!).toISOString() : vnDayStart(i);
        it.image ??= meta("og:image");
        it.excerpt = head.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)?.[1] ?? it.excerpt;
      } catch {
        it.published = vnDayStart(i);
      }
    }),
  );
  return items.sort((x, y) => y.published.localeCompare(x.published));
}

export const SCRAPERS = { awwwards, cssda, uxfoundation, uxmatters, colorme } as const;
export type ScraperName = keyof typeof SCRAPERS;
