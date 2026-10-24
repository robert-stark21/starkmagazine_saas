import { ESPN, type Match } from "./scores";

/**
 * One match in detail, for the popup of the Sports ticker: teams, score, status, a timeline
 * of goals, cards and substitutions, a few statistics. European leagues come from ESPN's
 * public match summary; V-League from TheSportsDB (its free key has no timeline, so only
 * the header). Cached 30 seconds while live, 10 minutes before kick-off, a day after.
 */
export type EventKind = "goal" | "pen-goal" | "own-goal" | "pen-miss" | "yellow" | "red" | "yellow-red" | "sub";
export type TimelineRow =
  | { type: "event"; min: string; side: "home" | "away"; kind: EventKind; player: string; other?: string; score?: string }
  | { type: "break"; label: "HT" | "FT" | "AET" | "PEN"; score: string };
export type Side = { name: string; logo?: string };
export type MatchDetail = {
  id: string;
  league: Match["league"];
  home: Side;
  away: Side;
  hs?: number;
  as?: number;
  state: Match["state"];
  minute?: string;
  kickoff: string;
  venue?: string;
  timeline: TimelineRow[] | null; // null: the source has no timeline for this match
  stats: { key: "possession" | "shots" | "onTarget" | "corners" | "fouls"; home: number; away: number }[];
  link?: string;
};

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" };
const getJson = async (url: string) => {
  const r = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

/** ESPN key event → kind, or null for events the timeline leaves out (kick-off, delays…). */
function kindOf(k: any): EventKind | null {
  const t = String(k.type?.type ?? "");
  const text = String(k.text ?? "");
  if (/own/.test(t)) return "own-goal";
  if (/penalty/.test(t)) return k.scoringPlay ? "pen-goal" : "pen-miss";
  if (k.scoringPlay || /^goal/.test(t)) return "goal";
  if (t === "yellow-card") return "yellow";
  if (t === "red-card") return /second yellow/i.test(text) ? "yellow-red" : "red";
  if (t === "substitution") return "sub";
  return null;
}

const STATS: [MatchDetail["stats"][number]["key"], string][] = [
  ["possession", "possessionPct"],
  ["shots", "totalShots"],
  ["onTarget", "shotsOnTarget"],
  ["corners", "wonCorners"],
  ["fouls", "foulsCommitted"],
];

async function espnDetail(eventId: string, league: Match["league"]): Promise<MatchDetail> {
  const slug = ESPN.find((l) => l.league === league)?.slug;
  if (!slug) throw new Error("unknown league");
  const j = await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`);
  const comp = j.header?.competitions?.[0] ?? {};
  const home = comp.competitors?.find((c: any) => c.homeAway === "home");
  const away = comp.competitors?.find((c: any) => c.homeAway === "away");
  const st = comp.status?.type ?? {};
  const state: Match["state"] = st.state === "in" ? "live" : st.state === "post" ? "post" : "pre";
  // Crests come as 500px PNGs; ESPN's image service gives a 64px copy.
  const crest = (u?: string) => (u?.startsWith("https://a.espncdn.com/i/") ? `https://a.espncdn.com/combiner/i?img=${new URL(u).pathname}&w=64&h=64` : u);
  const side = (c: any): Side => ({ name: c?.team?.shortDisplayName ?? c?.team?.displayName ?? "", logo: crest(c?.team?.logos?.[0]?.href ?? c?.team?.logo) });

  let timeline: TimelineRow[] | null = null;
  if (state !== "pre") {
    timeline = [];
    let h = 0, a = 0;
    for (const k of j.keyEvents ?? []) {
      const t = String(k.type?.type ?? "");
      if (t === "halftime") { timeline.push({ type: "break", label: "HT", score: `${h} - ${a}` }); continue; }
      if (t === "end-regular-time" && state === "post") { timeline.push({ type: "break", label: "FT", score: `${h} - ${a}` }); continue; }
      const kind = kindOf(k);
      if (!kind) continue;
      const sideKey: "home" | "away" = k.team?.id && String(k.team.id) === String(away?.team?.id ?? away?.id) ? "away" : "home";
      const names = (k.participants ?? []).map((p: any) => p.athlete?.displayName).filter(Boolean);
      let score: string | undefined;
      if (kind === "goal" || kind === "pen-goal" || kind === "own-goal") {
        sideKey === "home" ? h++ : a++;
        score = `${h} - ${a}`;
      }
      timeline.push({
        type: "event",
        min: String(k.clock?.displayValue ?? "").replace(/'\+(\d+)'/, "+$1'"),
        side: sideKey,
        kind,
        player: names[0] ?? (kind === "own-goal" ? "OG" : ""),
        other: kind === "sub" ? names[1] : undefined,
        score,
      });
    }
    // Extra time / shoot-out results are only in the status; the last row says how it ended.
    if (state === "post" && !timeline.some((r) => r.type === "break" && r.label === "FT")) {
      timeline.push({ type: "break", label: /PEN/i.test(st.shortDetail ?? "") ? "PEN" : /AET/i.test(st.shortDetail ?? "") ? "AET" : "FT", score: `${home?.score ?? h} - ${away?.score ?? a}` });
    }
  }

  const teams = j.boxscore?.teams ?? [];
  const statOf = (teamId: string, name: string) => {
    const t = teams.find((x: any) => String(x.team?.id) === String(teamId));
    const v = parseFloat(t?.statistics?.find((s: any) => s.name === name)?.displayValue ?? "");
    return Number.isFinite(v) ? v : null;
  };
  const stats: MatchDetail["stats"] = [];
  if (state !== "pre") {
    for (const [key, name] of STATS) {
      const hv = statOf(home?.team?.id ?? home?.id, name), av = statOf(away?.team?.id ?? away?.id, name);
      if (hv !== null && av !== null && (hv || av)) stats.push({ key, home: hv, away: av });
    }
  }

  return {
    id: `espn-${eventId}`,
    league,
    home: side(home),
    away: side(away),
    hs: state === "pre" ? undefined : Number(home?.score ?? 0),
    as: state === "pre" ? undefined : Number(away?.score ?? 0),
    state,
    minute: state === "live" ? (st.name === "STATUS_HALFTIME" ? "HT" : comp.status?.displayClock) : undefined,
    kickoff: comp.date ?? "",
    venue: j.gameInfo?.venue?.fullName,
    timeline,
    stats,
    link: j.header?.links?.find((l: any) => /\/match\//.test(l.href ?? ""))?.href ?? `https://www.espn.com/soccer/match/_/gameId/${eventId}`,
  };
}

async function tsdbDetail(eventId: string): Promise<MatchDetail> {
  const e = (await getJson(`https://www.thesportsdb.com/api/v1/json/123/lookupevent.php?id=${eventId}`))?.events?.[0];
  if (!e) throw new Error("not found");
  const s = String(e.strStatus ?? "");
  const state: Match["state"] = s === "NS" || s === "" || s === "TBD" ? "pre" : /^(FT|AET|PEN|Match Finished)$/i.test(s) ? "post" : "live";
  return {
    id: `tsdb-${eventId}`,
    league: "VLEAGUE",
    home: { name: e.strHomeTeam, logo: e.strHomeTeamBadge ? `${e.strHomeTeamBadge}/tiny` : undefined },
    away: { name: e.strAwayTeam, logo: e.strAwayTeamBadge ? `${e.strAwayTeamBadge}/tiny` : undefined },
    hs: state === "pre" ? undefined : Number(e.intHomeScore ?? 0),
    as: state === "pre" ? undefined : Number(e.intAwayScore ?? 0),
    state,
    minute: state === "live" ? (s === "HT" ? "HT" : e.strProgress ? `${e.strProgress}'` : s) : undefined,
    kickoff: e.strTimestamp ? `${e.strTimestamp}${/Z|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? "" : "Z"}` : `${e.dateEvent}T00:00:00Z`,
    venue: e.strVenue || undefined,
    timeline: null,
    stats: [],
    link: `https://www.thesportsdb.com/event/${eventId}`,
  };
}

const cache = new Map<string, { at: number; data: MatchDetail }>();
const inflight = new Map<string, Promise<MatchDetail>>();
const ttl = (d: MatchDetail) => (d.state === "live" ? 30_000 : d.state === "pre" ? 600_000 : 86_400_000);

export async function getMatchDetail(id: string, league: Match["league"]): Promise<MatchDetail> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < ttl(hit.data)) return hit.data;
  let p = inflight.get(id);
  if (!p) {
    const [src, eventId] = id.split("-");
    if (!/^\d+$/.test(eventId ?? "")) throw new Error("bad id");
    p = (src === "tsdb" ? tsdbDetail(eventId) : espnDetail(eventId, league))
      .then((data) => {
        cache.set(id, { at: Date.now(), data });
        if (cache.size > 300) cache.delete(cache.keys().next().value!);
        return data;
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  try {
    return await p;
  } catch (e) {
    if (hit) return hit.data; // an older copy beats an error
    throw e;
  }
}
