import { parseHTML } from "linkedom";

/**
 * Entertainment data without API keys:
 * - Music: Spotify's daily Top 200 for Vietnam and the world, as published by kworb.net,
 *   with cover art from Spotify's public oEmbed and the music video found on YouTube.
 * - Cinema: films opening in Vietnamese cinemas this month, from Moveek (now showing and
 *   coming soon), with the trailer, synopsis and runtime from each film's page.
 * Lists are cached for 6 hours; a failed refresh keeps the previous copy.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HOURS6 = 6 * 3_600_000;
const VN = 7 * 3_600_000;

async function getText(url: string, timeout = 10000) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "vi,en;q=0.8" }, cache: "no-store", signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

/** A value refreshed at most every `ttl`, shared by concurrent callers, kept on failure. */
function cached<T>(ttl: number, load: () => Promise<T>) {
  let memo: { at: number; value: T } | null = null;
  let inflight: Promise<void> | null = null;
  return async (): Promise<T | null> => {
    if ((!memo || Date.now() - memo.at > ttl) && !inflight) {
      inflight = load()
        .then((value) => { memo = { at: Date.now(), value }; })
        .catch(() => { if (memo) memo = { ...memo, at: Date.now() - ttl + 600_000 }; }) // retry in 10 minutes
        .finally(() => (inflight = null));
    }
    if (!memo) await inflight;
    return memo?.value ?? null;
  };
}

/** Runs `fn` over items, `n` at a time. */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

// ---------------------------------------------------------------- music
export type Song = {
  id: string; // Spotify track id
  chart: "vn" | "global";
  rank: number;
  move: number | "new" | null; // places up (+) or down (-) since yesterday
  title: string;
  artist: string;
  cover?: string;
};

const covers = new Map<string, string | null>();
async function coverOf(id: string): Promise<string | undefined> {
  if (covers.has(id)) return covers.get(id) ?? undefined;
  try {
    const j = JSON.parse(await getText(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}`, 6000));
    covers.set(id, j.thumbnail_url ?? null);
    return j.thumbnail_url;
  } catch {
    return undefined; // try again next time
  }
}

async function kworb(chart: Song["chart"], top: number): Promise<Song[]> {
  const html = await getText(`https://kworb.net/spotify/country/${chart === "vn" ? "vn" : "global"}_daily.html`);
  const { document } = parseHTML(html);
  const rows = Array.from(document.querySelectorAll("table tbody tr")).slice(0, top) as any[];
  const songs = rows.flatMap((tr): Song[] => {
    const td = Array.from(tr.querySelectorAll("td")) as any[];
    const cell = td[2];
    const track = cell?.querySelector('a[href*="/track/"]');
    const id = track?.getAttribute("href")?.match(/track\/([A-Za-z0-9]+)/)?.[1];
    if (!id) return [];
    const p = (td[1]?.textContent ?? "").trim();
    // "Artist - Title (w/ Featured)": the artist is everything before the track link.
    const text = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
    const title = (track.textContent ?? "").trim();
    const artist = text.slice(0, text.indexOf(` - ${title}`)).trim() || text.split(" - ")[0];
    const feat = text.match(/\(w\/ ([^)]+)\)\s*$/)?.[1];
    return [{
      id,
      chart,
      rank: Number((td[0]?.textContent ?? "").trim()) || 0,
      move: p === "=" ? 0 : /new/i.test(p) ? "new" : /^[+-]\d+$/.test(p) ? Number(p) : null,
      title,
      artist: feat ? `${artist}, ${feat}` : artist,
    }];
  });
  await pool(songs, 6, async (s) => { s.cover = await coverOf(s.id); });
  return songs;
}

const chartVn = cached(HOURS6, () => kworb("vn", 30));
const chartGlobal = cached(HOURS6, () => kworb("global", 30));

/** Top 10 of each chart for the Showbiz page. */
export async function getCharts(): Promise<{ vn: Song[]; global: Song[] }> {
  const [vn, global] = await Promise.all([chartVn(), chartGlobal()]);
  return { vn: (vn ?? []).slice(0, 10), global: (global ?? []).slice(0, 10) };
}

/** Hot songs for the Showbiz ticker: the top of both charts, alternating, without repeats. */
export async function getHotSongs(): Promise<Song[]> {
  const [vn, global] = await Promise.all([chartVn(), chartGlobal()]);
  const a = (vn ?? []).slice(0, 20), b = (global ?? []).slice(0, 20);
  const seen = new Set<string>();
  const out: Song[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    for (const s of [a[i], b[i]]) if (s && !seen.has(s.id)) { seen.add(s.id); out.push(s); }
  }
  return out;
}

/** Search links for a song (YouTube, Zing MP3, Spotify). */
export function songLinks(s: { id: string; title: string; artist: string }) {
  const q = encodeURIComponent(`${s.artist.split(",")[0]} ${s.title}`);
  return {
    youtube: `https://www.youtube.com/results?search_query=${q}`,
    zing: `https://zingmp3.vn/tim-kiem/tat-ca?q=${q}`,
    spotify: `https://open.spotify.com/track/${s.id}`,
  };
}

const videos = new Map<string, { at: number; id: string | null }>();
/** First YouTube result for a query (the official video, almost always). */
export async function youtubeId(query: string): Promise<string | null> {
  const hit = videos.get(query);
  if (hit && (hit.id || Date.now() - hit.at < 3_600_000)) return hit.id;
  let id: string | null = null;
  try {
    const html = await getText(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`, 8000);
    id = html.match(/"videoId":"([\w-]{11})"/)?.[1] ?? null;
  } catch {}
  videos.set(query, { at: Date.now(), id });
  if (videos.size > 1000) videos.delete(videos.keys().next().value!);
  return id;
}

// ---------------------------------------------------------------- cinema
export type Movie = {
  slug: string; // Moveek slug
  title: string;
  poster?: string;
  release: string; // ISO date of the Vietnamese release
  genres: string[];
  popularity: number;
};
export type MovieDetail = Movie & { trailer?: string; synopsis?: string; runtime?: string; age?: string; cast?: string; link: string };

const GENRES: Record<string, string> = {
  action: "Hành động", adventure: "Phiêu lưu", animation: "Hoạt hình", comedy: "Hài", crime: "Tội phạm", documentary: "Tài liệu",
  drama: "Chính kịch", family: "Gia đình", fantasy: "Giả tưởng", history: "Lịch sử", horror: "Kinh dị", music: "Âm nhạc",
  mystery: "Bí ẩn", romance: "Tình cảm", "science-fiction": "Khoa học viễn tưởng", thriller: "Giật gân", war: "Chiến tranh", western: "Miền Tây",
};

async function moveekList(path: string): Promise<Movie[]> {
  const { document } = parseHTML(await getText(`https://moveek.com/${path}/`));
  return (Array.from(document.querySelectorAll("div.item[data-release]")) as any[]).flatMap((el): Movie[] => {
    const a = el.querySelector('a[href^="/phim/"]');
    const slug = a?.getAttribute("href")?.match(/\/phim\/([^/]+)\//)?.[1];
    const title = (a?.getAttribute("title") ?? "").trim();
    const release = Number(el.getAttribute("data-release"));
    if (!slug || !title || !release) return [];
    const img = el.querySelector("img");
    const srcset: string = img?.getAttribute("data-srcset") ?? "";
    const poster = srcset.split(",").map((s) => s.trim().split(/\s+/)[0]).find((u) => /card_2x|tall/.test(u)) ?? img?.getAttribute("data-src") ?? undefined;
    const genres = String(el.getAttribute("class") ?? "").split(/\s+/).flatMap((c) => (c.startsWith("genre-") ? [GENRES[c.slice(6)] ?? c.slice(6)] : []));
    return [{ slug, title, poster: poster && !/no-poster/.test(poster) ? poster : undefined, release: new Date(release * 1000).toISOString(), genres, popularity: Number(el.getAttribute("data-popularity")) || 0 }];
  });
}

/** Films whose Vietnamese release falls in the current month (Vietnam time), soonest first. */
const monthMovies = cached(HOURS6, async () => {
  const lists = await Promise.allSettled([moveekList("dang-chieu"), moveekList("sap-chieu")]);
  const all = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []));
  if (!all.length) throw new Error("moveek empty");
  const month = new Date(Date.now() + VN).toISOString().slice(0, 7);
  const seen = new Set<string>();
  return all
    .filter((m) => new Date(Date.parse(m.release) + VN).toISOString().slice(0, 7) === month)
    .filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)))
    .sort((a, b) => a.release.localeCompare(b.release) || b.popularity - a.popularity);
});

export async function getMonthMovies(): Promise<Movie[]> {
  return (await monthMovies()) ?? [];
}

const details = new Map<string, { at: number; data: MovieDetail }>();
const pendingDetail = new Map<string, Promise<MovieDetail>>();

/** A film's page: trailer (YouTube id), synopsis, runtime, age rating, cast. */
export async function getMovieDetail(slug: string): Promise<MovieDetail> {
  const hit = details.get(slug);
  if (hit && Date.now() - hit.at < HOURS6) return hit.data;
  let p = pendingDetail.get(slug);
  if (!p) {
    p = (async () => {
      const base = (await getMonthMovies()).find((m) => m.slug === slug);
      const link = `https://moveek.com/phim/${slug}/`;
      const { document } = parseHTML(await getText(link));
      const text = (el: any) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      // The facts are label/value pairs: "Khởi chiếu 23/10/2026", "Thời lượng 80 phút"…
      const fact = (label: string) => {
        const strong = (Array.from(document.querySelectorAll("strong, b, span, dt, label")) as any[]).find((e) => text(e) === label);
        const parent = strong?.parentElement;
        return parent ? text(parent).replace(label, "").trim() || undefined : undefined;
      };
      const trailer = document.querySelector("[data-video-url]")?.getAttribute("data-video-url") ?? undefined;
      const synopsis = (Array.from(document.querySelectorAll("p.text-justify, p.mb-3")) as any[]).map(text).find((t) => t.length > 60);
      const title = base?.title ?? text(document.querySelector("h1"));
      const data: MovieDetail = {
        slug,
        title,
        poster: base?.poster ?? document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? undefined,
        release: base?.release ?? "",
        genres: base?.genres ?? [],
        popularity: base?.popularity ?? 0,
        trailer: trailer && /^[\w-]{11}$/.test(trailer) ? trailer : (await youtubeId(`${title} trailer`)) ?? undefined,
        synopsis,
        runtime: fact("Thời lượng"),
        age: fact("Giới hạn tuổi"),
        cast: fact("Diễn viên")?.replace(/\s*,\s*/g, ", "),
        link,
      };
      details.set(slug, { at: Date.now(), data });
      if (details.size > 300) details.delete(details.keys().next().value!);
      return data;
    })().finally(() => pendingDetail.delete(slug));
    pendingDetail.set(slug, p);
  }
  return p;
}
