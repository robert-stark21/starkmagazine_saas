/**
 * League of Legends matches for the E-sport page ticker: First Stand, LCK, LCP, LPL, MSI and
 * Worlds, from the public API the lolesports.com site itself uses (its public key, sent by
 * every visitor's browser). Same rules as the football ticker: live first, results of the
 * last 24 hours, then upcoming matches until the end of tomorrow (Vietnam time).
 * Per-game results come from Riot's live stats feed (the final frame of each game).
 */
const API = "https://esports-api.lolesports.com/persisted/gw";
const FEED = "https://feed.lolesports.com/livestats/v1";
const KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"; // public key shipped in lolesports.com's own JavaScript
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DAY = 86_400_000;
const VN = 7 * 3_600_000;

export const LOL_LEAGUES = {
  first_stand: { id: "113464388705111224", name: "First Stand" },
  lck: { id: "98767991310872058", name: "LCK" },
  lcp: { id: "113476371197627891", name: "LCP" },
  lpl: { id: "98767991314006698", name: "LPL" },
  msi: { id: "98767991325878492", name: "MSI" },
  worlds: { id: "98767975604431411", name: "Worlds" },
} as const;
export type LolLeague = keyof typeof LOL_LEAGUES;
const PIN = /^T1$/i; // a live T1 match is pinned on the left

export type LolTeam = { code: string; name: string; image?: string; wins: number; outcome?: "win" | "loss" };
export type LolMatch = {
  id: string;
  league: LolLeague;
  block?: string; // stage: "Swiss", "Quarterfinals", "Week 3"…
  start: string; // ISO
  state: "live" | "post" | "pre";
  bestOf: number;
  teams: [LolTeam, LolTeam];
  pinned?: boolean;
  vod?: boolean;
};

const https = (u?: string) => (u ? u.replace(/^http:\/\//, "https://") : u);

async function api(path: string) {
  const r = await fetch(`${API}/${path}`, {
    headers: { "x-api-key": KEY, "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

/** Rough length of a series, to know when a result is older than 24 hours. */
const seriesHours = (bestOf: number) => (bestOf >= 5 ? 4.5 : bestOf >= 3 ? 3 : 1.2);

export function isLolVisible(m: LolMatch, now = Date.now()): boolean {
  const start = Date.parse(m.start);
  if (m.state === "live") return true;
  if (m.state === "post") return now - (start + seriesHours(m.bestOf) * 3_600_000) <= DAY;
  const endOfTomorrow = Date.parse(`${new Date(now + VN + DAY).toISOString().slice(0, 10)}T23:59:59+07:00`);
  return start <= endOfTomorrow && start >= now - 6 * 3_600_000; // stale "unstarted" entries drop out
}

async function load(): Promise<LolMatch[]> {
  const ids = Object.values(LOL_LEAGUES).map((l) => l.id).join(",");
  const j = await api(`getSchedule?hl=en-US&leagueId=${ids}`);
  const slugOf = new Map(Object.entries(LOL_LEAGUES).map(([slug]) => [slug, slug as LolLeague]));
  const out: LolMatch[] = [];
  for (const e of j?.data?.schedule?.events ?? []) {
    if (e.type !== "match" || !e.match?.teams || e.match.teams.length !== 2) continue;
    const league = slugOf.get(e.league?.slug);
    if (!league) continue;
    const state: LolMatch["state"] = e.state === "inProgress" ? "live" : e.state === "completed" ? "post" : "pre";
    const teams = e.match.teams.map((t: any) => ({
      code: t.code || t.name?.slice(0, 3)?.toUpperCase() || "TBD",
      name: t.name || "TBD",
      image: https(t.image),
      wins: Number(t.result?.gameWins ?? 0),
      outcome: t.result?.outcome === "win" || t.result?.outcome === "loss" ? t.result.outcome : undefined,
    })) as [LolTeam, LolTeam];
    out.push({
      id: String(e.match.id),
      league,
      block: e.blockName || undefined,
      start: e.startTime,
      state,
      bestOf: Number(e.match.strategy?.count ?? 1),
      teams,
      pinned: state === "live" && teams.some((t) => PIN.test(t.code)),
      vod: (e.match.flags ?? []).includes("hasVod"),
    });
  }
  const rank = { live: 0, post: 1, pre: 2 } as const;
  return out
    .filter((m) => isLolVisible(m))
    .sort((a, b) => (a.state !== b.state ? rank[a.state] - rank[b.state] : a.state === "post" ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
}

let memo: { at: number; matches: LolMatch[]; live: boolean } | null = null;
let inflight: Promise<void> | null = null;

export async function getLolMatches(): Promise<{ matches: LolMatch[]; live: boolean }> {
  const ttl = memo?.live ? 30_000 : 300_000;
  if ((!memo || Date.now() - memo.at >= ttl) && !inflight) {
    inflight = load()
      .then((matches) => { memo = { at: Date.now(), matches, live: matches.some((m) => m.state === "live") }; })
      .catch(() => { if (memo) memo = { ...memo, at: Date.now() - ttl + 60_000 }; }) // retry in a minute
      .finally(() => (inflight = null));
  }
  if (!memo) await inflight;
  const matches = (memo?.matches ?? []).filter((m) => isLolVisible(m));
  return { matches, live: matches.some((m) => m.state === "live") };
}

// ---------- one match in detail (popup) ----------
export type LolGame = {
  number: number;
  state: "done" | "live" | "next";
  blue?: string; // team code on the blue side
  red?: string;
  winner?: string; // team code
  kills?: [number, number]; // [team 0, team 1] (same order as LolDetail.teams)
  towers?: [number, number];
  gold?: [number, number];
  minutes?: number;
};
export type LolDetail = LolMatch & { leagueName: string; games: LolGame[]; link: string };

const round10 = (t: number) => new Date(Math.floor(t / 10_000) * 10_000).toISOString();

async function feedWindow(gameId: string, startingTime?: string) {
  const r = await fetch(`${FEED}/window/${gameId}${startingTime ? `?startingTime=${startingTime}` : ""}`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok || r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Last frame of a game: asking for a moment long after the game returns its final frames
 * ("finished"); for a live game, the frames of a minute ago.
 */
async function gameStats(gameId: string, live: boolean) {
  const first = await feedWindow(gameId);
  const begin = Date.parse(first?.frames?.[0]?.rfc460Timestamp ?? "");
  if (!first || !Number.isFinite(begin)) return null;
  const at = live ? Date.now() - 60_000 : begin + 3 * 3_600_000;
  const end = await feedWindow(gameId, round10(at));
  const f = end?.frames?.at(-1);
  if (!f) return null;
  return {
    blueId: String(first.gameMetadata?.blueTeamMetadata?.esportsTeamId ?? ""),
    finished: f.gameState === "finished",
    minutes: Math.round((Date.parse(f.rfc460Timestamp) - begin) / 60_000),
    blue: { kills: f.blueTeam.totalKills, towers: f.blueTeam.towers, inhib: f.blueTeam.inhibitors, gold: f.blueTeam.totalGold },
    red: { kills: f.redTeam.totalKills, towers: f.redTeam.towers, inhib: f.redTeam.inhibitors, gold: f.redTeam.totalGold },
  };
}

async function loadDetail(id: string): Promise<LolDetail> {
  const j = await api(`getEventDetails?hl=en-US&id=${id}`);
  const ev = j?.data?.event;
  if (!ev?.match) throw new Error("not found");
  const fromList = (memo?.matches ?? []).find((m) => m.id === id);
  const league = (Object.keys(LOL_LEAGUES) as LolLeague[]).find((k) => k === ev.league?.slug) ?? fromList?.league ?? "worlds";
  const teamsRaw = ev.match.teams ?? [];
  const teams = teamsRaw.map((t: any, i: number) => ({
    code: t.code || "TBD",
    name: t.name || "TBD",
    image: https(t.image),
    wins: Number(t.result?.gameWins ?? 0),
    outcome: fromList?.teams[i]?.outcome,
  })) as [LolTeam, LolTeam];
  const idx = new Map<string, number>(teamsRaw.map((t: any, i: number) => [String(t.id), i]));
  const codeOf = (teamId?: string) => (teamId && idx.has(teamId) ? teams[idx.get(teamId)!].code : undefined);
  const state: LolMatch["state"] =
    fromList?.state ?? (ev.match.games?.some((g: any) => g.state === "inProgress") ? "live" : ev.match.games?.every((g: any) => g.state === "completed" || g.state === "unneeded") ? "post" : "pre");

  const games: LolGame[] = await Promise.all(
    (ev.match.games ?? [])
      .filter((g: any) => g.state !== "unneeded")
      .map(async (g: any): Promise<LolGame> => {
        const blue = g.teams?.find((t: any) => t.side === "blue")?.id;
        const red = g.teams?.find((t: any) => t.side === "red")?.id;
        const base: LolGame = {
          number: g.number,
          state: g.state === "completed" ? "done" : g.state === "inProgress" ? "live" : "next",
          blue: codeOf(blue),
          red: codeOf(red),
        };
        if (base.state === "next") return base;
        const s = await gameStats(String(g.id), base.state === "live").catch(() => null);
        if (!s) return base;
        // Team order of the popup (teams[0], teams[1]) rather than blue/red.
        const zeroIsBlue = idx.get(s.blueId || String(blue)) === 0;
        const pair = (k: "kills" | "towers" | "gold"): [number, number] => (zeroIsBlue ? [s.blue[k], s.red[k]] : [s.red[k], s.blue[k]]);
        let winner: string | undefined;
        if (s.finished) {
          // The winner destroys the Nexus: more towers (then inhibitors, then kills).
          const b = s.blue, r = s.red;
          const blueWon = b.towers !== r.towers ? b.towers > r.towers : b.inhib !== r.inhib ? b.inhib > r.inhib : b.kills > r.kills;
          winner = blueWon ? base.blue : base.red;
        }
        return { ...base, winner, kills: pair("kills"), towers: pair("towers"), gold: pair("gold"), minutes: s.minutes };
      })
  );
  // Keep the per-game winners only if they add up to the series score.
  const tally = teams.map((t) => games.filter((g) => g.winner === t.code).length);
  if (tally[0] !== teams[0].wins || tally[1] !== teams[1].wins) games.forEach((g) => delete g.winner);

  const link =
    state === "live" ? `https://lolesports.com/en-US/live/${league}` : fromList?.vod || state === "post" ? `https://lolesports.com/en-US/vod/${id}/1` : `https://lolesports.com/en-US/leagues/${league}`;
  return {
    id,
    league,
    leagueName: ev.league?.name ?? LOL_LEAGUES[league].name,
    block: fromList?.block,
    start: fromList?.start ?? "",
    state,
    bestOf: Number(ev.match.strategy?.count ?? fromList?.bestOf ?? 1),
    teams,
    games,
    link,
  };
}

const cache = new Map<string, { at: number; data: LolDetail }>();
const pending = new Map<string, Promise<LolDetail>>();

export async function getLolDetail(id: string): Promise<LolDetail> {
  const hit = cache.get(id);
  const ttl = hit?.data.state === "live" ? 30_000 : hit?.data.state === "pre" ? 600_000 : DAY;
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  let p = pending.get(id);
  if (!p) {
    p = loadDetail(id)
      .then((data) => {
        cache.set(id, { at: Date.now(), data });
        if (cache.size > 200) cache.delete(cache.keys().next().value!);
        return data;
      })
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  try {
    return await p;
  } catch (e) {
    if (hit) return hit.data;
    throw e;
  }
}
