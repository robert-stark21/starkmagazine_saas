/**
 * Economic calendar (Finance page): the ForexFactory weekly calendar (events, impact,
 * forecast, previous; times in US Eastern) with actual figures from Nasdaq's public
 * economic events list, matched by country, time and name. Investing.com refuses servers.
 * (Crypto liquidations live in liq.ts.)
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function getJson(url: string, timeout = 8000) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

/** A value refreshed at most every `ttl`, shared by concurrent callers, kept on failure. */
function cached<T>(ttl: number, load: () => Promise<T>) {
  let memo: { at: number; value: T } | null = null;
  let inflight: Promise<void> | null = null;
  return async (): Promise<T | null> => {
    if ((!memo || Date.now() - memo.at > ttl) && !inflight) {
      inflight = load()
        .then((value) => { memo = { at: Date.now(), value }; })
        .catch(() => { if (memo) memo = { ...memo, at: Date.now() - ttl + 120_000 }; })
        .finally(() => (inflight = null));
    }
    if (!memo) await inflight;
    return memo?.value ?? null;
  };
}

// ---------------------------------------------------------------- economic calendar
export type EconEvent = {
  id: string;
  time: string; // ISO
  allDay: boolean;
  currency: string;
  impact: "High" | "Medium";
  title: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  verdict?: "better" | "worse" | "same"; // actual against forecast (or previous), for the currency
};

const COUNTRIES: Record<string, RegExp> = {
  USD: /united states|^us$|u\.s\./i,
  EUR: /euro|germany|france|italy|spain|european/i,
  GBP: /united kingdom|^uk$|britain/i,
  JPY: /japan/i,
  AUD: /australia/i,
  NZD: /new zealand/i,
  CAD: /canada/i,
  CHF: /switzerland/i,
  CNY: /china/i,
};

const num = (s?: string) => {
  const m = (s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !/^(the|of|and|sa|nsa|global|s|p|mom|yoy|q|m|y)$/.test(w)));

/** Nasdaq's events for one US-Eastern day (actual, consensus, previous; times in ET). */
const nasdaqDays = new Map<string, { at: number; rows: any[] }>();
async function nasdaqDay(day: string): Promise<any[]> {
  const hit = nasdaqDays.get(day);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.rows;
  try {
    const j = await getJson(`https://api.nasdaq.com/api/calendar/economicevents?date=${day}`);
    const rows = j?.data?.rows ?? [];
    nasdaqDays.set(day, { at: Date.now(), rows });
    return rows;
  } catch {
    return hit?.rows ?? [];
  }
}

function verdictOf(e: EconEvent): EconEvent["verdict"] {
  const a = num(e.actual), f = num(e.forecast) ?? num(e.previous);
  if (a === null || f === null) return undefined;
  if (a === f) return "same";
  const lowerIsBetter = /unemployment|jobless|claims|inventor/i.test(e.title);
  return (a > f) !== lowerIsBetter ? "better" : "worse";
}

const calendar = cached(30 * 60_000, async () => {
  const list: any[] = await getJson("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
  return list.filter((e) => e.impact === "High" || e.impact === "Medium");
});

/** This week's high and medium impact events, with actual figures for those already out. */
export async function getEconCalendar(): Promise<EconEvent[]> {
  const raw = (await calendar()) ?? [];
  const now = Date.now();
  const events: EconEvent[] = raw.map((e: any, i: number) => ({
    id: `${e.date}-${e.country}-${i}`,
    time: new Date(e.date).toISOString(),
    allDay: !/T\d\d:\d\d/.test(e.date) || /all day|tentative/i.test(e.time ?? ""),
    currency: e.country,
    impact: e.impact,
    title: e.title,
    forecast: e.forecast || undefined,
    previous: e.previous || undefined,
  }));
  // Actual figures for events already out: same country, same Eastern time, closest name
  // (and the same "previous" figure when a release has several lines, like CPI m/m and y/y).
  const past = events.filter((e) => Date.parse(e.time) <= now);
  const days = [...new Set(past.map((e) => (raw[events.indexOf(e)].date as string).slice(0, 10)))];
  const byDay = new Map(await Promise.all(days.map(async (d) => [d, await nasdaqDay(d)] as const)));
  for (const e of past) {
    const src = raw[events.indexOf(e)];
    const actual = matchActual(e, String(src.date).slice(11, 16), byDay.get(String(src.date).slice(0, 10)) ?? []);
    if (actual) {
      e.actual = actual;
      e.verdict = verdictOf(e);
    }
  }
  return events.sort((a, b) => a.time.localeCompare(b.time));
}

/** The Nasdaq row for an event: same country and Eastern time ("08:30"), most words in common. */
export function matchActual(e: Pick<EconEvent, "currency" | "title" | "previous">, hm: string, rows: any[]): string | undefined {
  const want = words(e.title);
  let best: any, score = 0;
  for (const r of rows) {
    if (r.gmt !== hm || !COUNTRIES[e.currency]?.test(r.country ?? "")) continue;
    let s = [...words(r.eventName ?? "")].filter((w) => want.has(w)).length;
    if (!s) continue;
    if (e.previous && num(r.previous) === num(e.previous)) s += 2; // CPI m/m vs y/y lines
    if (s > score) { score = s; best = r; }
  }
  return String(best?.actual ?? "").trim() || undefined;
}
