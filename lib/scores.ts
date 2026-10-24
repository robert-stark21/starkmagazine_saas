/**
 * Match results for the Sports page ticker, from yesterday to tomorrow (Vietnam time):
 * Champions League, Europa League, Premier League, La Liga and Serie A from ESPN's public
 * scoreboard data, V-League 1 from TheSportsDB (public test key). Only scores are used;
 * no articles. Cached 30 seconds while a match is live, 5 minutes otherwise.
 */
export type Match = {
  id: string;
  league: "C1" | "C2" | "EPL" | "LALIGA" | "SERIEA" | "VLEAGUE";
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
  hs?: number;
  as?: number;
  state: "live" | "post" | "pre";
  minute?: string; // live only: "67'", "HT", "90'+3'"
  kickoff: string; // ISO time
  pinned?: boolean; // Real Madrid or AC Milan playing live
};

export const ESPN: { slug: string; league: Match["league"] }[] = [
  { slug: "uefa.champions", league: "C1" },
  { slug: "uefa.europa", league: "C2" },
  { slug: "eng.1", league: "EPL" },
  { slug: "esp.1", league: "LALIGA" },
  { slug: "ita.1", league: "SERIEA" },
];
const VLEAGUE = "4803"; // TheSportsDB id of Vietnamese V.League 1
const PIN = /^(real madrid|ac milan)$/i;
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" };
const DAY = 86_400_000;
const VN = 7 * 3_600_000; // Asia/Ho_Chi_Minh, no daylight saving

const getJson = async (url: string) => {
  const r = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

/** Vietnam calendar day as YYYYMMDD (or YYYY-MM-DD), offset by n days. */
function vnDay(n: number, dash = false) {
  const d = new Date(Date.now() + VN + n * DAY).toISOString().slice(0, 10);
  return dash ? d : d.replace(/-/g, "");
}

async function espnLeague(slug: string, league: Match["league"]): Promise<Match[]> {
  // ESPN days follow US time, so ask one extra day on each side and filter afterwards.
  const days = [-2, -1, 0, 1].map((n) => vnDay(n));
  const pages = await Promise.all(
    days.map((d) => getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${d}`).catch(() => null))
  );
  const out: Match[] = [];
  for (const page of pages) {
    for (const e of page?.events ?? []) {
      const c = e.competitions?.[0];
      const home = c?.competitors?.find((t: any) => t.homeAway === "home");
      const away = c?.competitors?.find((t: any) => t.homeAway === "away");
      if (!home || !away) continue;
      const st = e.status?.type ?? {};
      const state: Match["state"] = st.state === "in" ? "live" : st.state === "post" ? "post" : "pre";
      if (/postponed|canceled|cancelled/i.test(st.name ?? "")) continue;
      out.push({
        id: `espn-${e.id}`,
        league,
        home: home.team?.shortDisplayName ?? home.team?.displayName,
        away: away.team?.shortDisplayName ?? away.team?.displayName,
        homeAbbr: home.team?.abbreviation ?? "",
        awayAbbr: away.team?.abbreviation ?? "",
        hs: state === "pre" ? undefined : Number(home.score),
        as: state === "pre" ? undefined : Number(away.score),
        state,
        minute: state === "live" ? (st.name === "STATUS_HALFTIME" ? "HT" : e.status?.displayClock) : undefined,
        kickoff: e.date,
        pinned: state === "live" && (PIN.test(home.team?.displayName ?? "") || PIN.test(away.team?.displayName ?? "")),
      });
    }
  }
  return out;
}

async function vLeague(): Promise<Match[]> {
  const days = [-1, 0, 1].map((n) => vnDay(n, true));
  const pages = await Promise.all(
    days.map((d) => getJson(`https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${d}&l=${VLEAGUE}`).catch(() => null))
  );
  const abbr = (name: string) => name.split(/\s+/).filter((w) => w.length > 1).map((w) => w[0]).join("").toUpperCase().slice(0, 3);
  const out: Match[] = [];
  for (const page of pages) {
    for (const e of page?.events ?? []) {
      const s = String(e.strStatus ?? "");
      if (/postp|cancel|abandon/i.test(s)) continue;
      const state: Match["state"] = s === "NS" || s === "" || s === "TBD" ? "pre" : /^(FT|AET|PEN|Match Finished)$/i.test(s) ? "post" : "live";
      out.push({
        id: `tsdb-${e.idEvent}`,
        league: "VLEAGUE",
        home: e.strHomeTeam,
        away: e.strAwayTeam,
        homeAbbr: abbr(e.strHomeTeam ?? ""),
        awayAbbr: abbr(e.strAwayTeam ?? ""),
        hs: state === "pre" ? undefined : Number(e.intHomeScore ?? 0),
        as: state === "pre" ? undefined : Number(e.intAwayScore ?? 0),
        state,
        minute: state === "live" ? (s === "HT" ? "HT" : e.strProgress ? `${e.strProgress}'` : s) : undefined,
        kickoff: e.strTimestamp ? `${e.strTimestamp}${/Z|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? "" : "Z"}` : `${e.dateEvent}T00:00:00Z`,
      });
    }
  }
  return out;
}

/**
 * Which matches the ticker shows, decided at the moment of asking: live matches; results
 * that ended within the last 24 hours (end taken as kick-off + 2h); upcoming matches
 * until the end of tomorrow, Vietnam time. Old results drop out on their own.
 */
export function isVisible(m: Match, now = Date.now()): boolean {
  const kickoff = Date.parse(m.kickoff);
  if (m.state === "live") return true;
  if (m.state === "post") return now - (kickoff + 2 * 3_600_000) <= DAY;
  const endOfTomorrow = Date.parse(`${new Date(now + VN + DAY).toISOString().slice(0, 10)}T23:59:59+07:00`);
  return kickoff <= endOfTomorrow;
}

let memo: { at: number; matches: Match[]; live: boolean } | null = null;
let inflight: Promise<Match[]> | null = null;

async function load(): Promise<Match[]> {
  const parts = await Promise.all([...ESPN.map((l) => espnLeague(l.slug, l.league).catch(() => [])), vLeague().catch(() => [])]);
  const seen = new Set<string>();
  const matches = parts
    .flat()
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .filter((m) => isVisible(m));
  const rank = { live: 0, post: 1, pre: 2 } as const;
  matches.sort((a, b) => {
    if (a.state !== b.state) return rank[a.state] - rank[b.state];
    // Latest results first; the soonest upcoming matches first.
    return a.state === "post" ? b.kickoff.localeCompare(a.kickoff) : a.kickoff.localeCompare(b.kickoff);
  });
  if (matches.length) memo = { at: Date.now(), matches, live: matches.some((m) => m.state === "live") };
  else if (memo) memo = { ...memo, at: Date.now() };
  return memo?.matches ?? [];
}

export async function getScores(): Promise<{ matches: Match[]; live: boolean }> {
  const ttl = memo?.live ? 30_000 : 300_000;
  const fresh = memo && Date.now() - memo.at < ttl;
  if (!fresh && !inflight) inflight = load().finally(() => (inflight = null));
  if (!memo) await inflight;
  // Filter again on every answer, so cached data never shows results past the 24h cutoff.
  const matches = (memo?.matches ?? []).filter((m) => isVisible(m));
  return { matches, live: matches.some((m) => m.state === "live") };
}
