/**
 * Market panels without API keys.
 *
 * Liquidations (Crypto page): OKX's public USDT perpetual liquidation feed for BTC and ETH,
 * which keeps about the last 24 hours. From it: long vs short totals over 1h / 4h / 24h,
 * where in price those liquidations happened (a histogram, like a small heatmap), and the
 * biggest one. The leverage levels next to it are estimates (price ± 1/leverage).
 *
 * Economic calendar (Finance page): the ForexFactory weekly calendar (events, impact,
 * forecast, previous; times in US Eastern) with actual figures from Nasdaq's public
 * economic events list, matched by country, time and name. Investing.com refuses servers.
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

// ---------------------------------------------------------------- liquidations
export type Coin = "BTC" | "ETH";
type Liq = { side: "long" | "short"; usd: number; price: number; ts: number };
export type LiqPanel = {
  coin: Coin;
  price: number;
  hours: number; // how far back the data goes
  totals: { label: "1h" | "4h" | "24h"; long: number; short: number }[];
  bins: { from: number; to: number; long: number; short: number; current: boolean }[]; // high price first
  biggest?: Liq;
  levels: { lev: number; long: number; short: number }[]; // estimated liquidation prices by leverage
  heat?: LiqHeat | null; // estimated heatmap (time × price)
};

const CT_VAL: Record<Coin, number> = { BTC: 0.01, ETH: 0.1 }; // coin per contract (OKX USDT swaps)

async function okxLiquidations(coin: Coin): Promise<Liq[]> {
  const out: Liq[] = [];
  const since = Date.now() - 24 * 3_600_000;
  let after = "";
  for (let page = 0; page < 40; page++) {
    const j = await getJson(`https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=${coin}-USDT&state=filled&limit=100${after ? `&after=${after}` : ""}`);
    const rows: any[] = j?.data?.[0]?.details ?? [];
    if (!rows.length) break;
    let oldest = Infinity;
    for (const d of rows) {
      const ts = Number(d.ts), price = Number(d.bkPx), sz = Number(d.sz);
      oldest = Math.min(oldest, ts);
      if (!(ts && price && sz) || ts < since) continue;
      // The liquidation order sells a long position and buys back a short one.
      const side = d.posSide === "long" || (d.posSide !== "short" && d.side === "sell") ? "long" : "short";
      out.push({ side, usd: sz * CT_VAL[coin] * price, price, ts });
    }
    if (oldest < since) break;
    after = String(oldest);
  }
  return out;
}

async function okxPrice(coin: Coin): Promise<number> {
  const j = await getJson(`https://www.okx.com/api/v5/market/ticker?instId=${coin}-USDT-SWAP`);
  return Number(j?.data?.[0]?.last) || 0;
}

/** Bands of `step` around the 24h range; each band sums the liquidations inside it. */
function histogram(liqs: Liq[], price: number, rows = 9) {
  const prices = liqs.map((l) => l.price).concat(price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const raw = (hi - lo) / rows || price * 0.002;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(lo / step) * step;
  const n = Math.max(1, Math.ceil((hi - start) / step + 1e-9));
  const bins = Array.from({ length: n }, (_, i) => ({ from: start + i * step, to: start + (i + 1) * step, long: 0, short: 0, current: false }));
  for (const l of liqs) {
    const b = bins[Math.min(n - 1, Math.floor((l.price - start) / step))];
    b[l.side] += l.usd;
  }
  const at = Math.min(n - 1, Math.floor((price - start) / step));
  if (bins[at]) bins[at].current = true;
  return bins.reverse();
}

async function loadLiq(coin: Coin): Promise<LiqPanel> {
  const [liqs, price] = await Promise.all([okxLiquidations(coin), okxPrice(coin)]);
  if (!price) throw new Error("no price");
  const now = Date.now();
  const sum = (h: number, side: Liq["side"]) => liqs.filter((l) => l.side === side && now - l.ts <= h * 3_600_000).reduce((a, l) => a + l.usd, 0);
  const oldest = liqs.length ? Math.min(...liqs.map((l) => l.ts)) : now;
  return {
    coin,
    price,
    hours: Math.round((now - oldest) / 3_600_000),
    totals: ([[1, "1h"], [4, "4h"], [24, "24h"]] as const).map(([h, label]) => ({ label, long: sum(h, "long"), short: sum(h, "short") })),
    bins: liqs.length ? histogram(liqs, price) : [],
    biggest: liqs.reduce<Liq | undefined>((m, l) => (!m || l.usd > m.usd ? l : m), undefined),
    // Isolated margin with ~0.5% maintenance margin: liquidated after a move of about 1/leverage.
    levels: [100, 50, 25, 10].map((lev) => ({ lev, long: price * (1 - 1 / lev + 0.005), short: price * (1 + 1 / lev - 0.005) })),
  };
}

const liqCache = { BTC: cached(10 * 60_000, () => loadLiq("BTC")), ETH: cached(10 * 60_000, () => loadLiq("ETH")) };

export async function getLiquidations(): Promise<LiqPanel[]> {
  const [all, heats] = await Promise.all([Promise.all([liqCache.BTC(), liqCache.ETH()]), Promise.all([getLiqHeat("BTC"), getLiqHeat("ETH")])]);
  return all.flatMap((x, i) => (x ? [{ ...x, heat: heats[i] }] : []));
}

// ---------------------------------------------------------------- estimated liquidation heatmap
export type LiqHeat = {
  t0: number; // first column start (ms)
  step: number; // ms per column
  lo: number; // price at the bottom row
  hi: number; // price at the top row
  rows: number;
  cols: number;
  cells: number[]; // rows × cols, row 0 at the top (high price); 0–100
  close: number[]; // price per column, for the line on top
};

const LEVERAGE: [number, number][] = [[5, 0.1], [10, 0.25], [25, 0.3], [50, 0.2], [100, 0.15]]; // assumed mix

/**
 * An estimate in the spirit of Coinglass's heatmap: whenever open interest grows, the new
 * positions are assumed to open at that candle's close with a typical leverage mix; each
 * leaves a long and a short liquidation price (± about 1/leverage). Levels stay until price
 * trades through them, and shrink when open interest falls. Each column shows what is left.
 */
async function loadHeat(coin: Coin): Promise<LiqHeat> {
  const inst = `${coin}-USDT-SWAP`;
  const q = (bar: string, period: string, limit: number) =>
    Promise.all([
      getJson(`https://www.okx.com/api/v5/market/candles?instId=${inst}&bar=${bar}&limit=${limit}`),
      getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${inst}&period=${period}&limit=100`),
    ]);
  // The last 24h in 15-minute columns, and the three days before in hours to build up the
  // positions that were already open when the chart starts.
  const [[c15, oi15], [c1h, oi1h]] = await Promise.all([q("15m", "15m", 96), q("1H", "1H", 100)]);
  const toBars = (j: any) => ((j?.data ?? []) as string[][]).map((c) => ({ ts: +c[0], high: +c[2], low: +c[3], close: +c[4] })).reverse();
  const toOi = (j: any) => new Map(((j?.data ?? []) as string[][]).map((r) => [+r[0], +r[3]]));
  const bars = toBars(c15);
  if (bars.length < 20) throw new Error("no candles");
  const warm = toBars(c1h).filter((b) => b.ts + 3_600_000 <= bars[0].ts);
  const oiAt = new Map([...toOi(oi1h), ...toOi(oi15)]);
  const step = 15 * 60_000;
  const lo0 = Math.min(...bars.map((b) => b.low)), hi0 = Math.max(...bars.map((b) => b.high));
  const pad = (hi0 - lo0) * 0.35 + bars.at(-1)!.close * 0.01;
  const lo = lo0 - pad, hi = hi0 + pad, rows = 64, cols = bars.length;
  const grid = new Float64Array(rows * cols);
  type Level = { price: number; usd: number; long: boolean };
  let levels: Level[] = [];
  // New positions enter anywhere in the candle's range: low, middle and high.
  const open = (b: { high: number; low: number; close: number }, usd: number) => {
    for (const entry of [b.low, (b.low + b.high + b.close) / 3, b.high])
      for (const [lev, w] of LEVERAGE) {
        levels.push({ price: entry * (1 - 1 / lev + 0.005), usd: (usd * w) / 6, long: true });
        levels.push({ price: entry * (1 + 1 / lev - 0.005), usd: (usd * w) / 6, long: false });
      }
  };
  let prevOi = oiAt.get(warm[0]?.ts ?? bars[0].ts) ?? [...oiAt.values()][0] ?? 0;
  const advance = (b: { ts: number; high: number; low: number; close: number }) => {
    const now = oiAt.get(b.ts) ?? prevOi;
    const d = now - prevOi;
    prevOi = now;
    if (d > 0) open(b, d);
    else if (d < 0) {
      const total = levels.reduce((a, l) => a + l.usd, 0) || 1;
      const k = Math.max(0, 1 + d / total);
      for (const l of levels) l.usd *= k;
    }
    // Price traded through: those positions are gone (liquidated).
    levels = levels.filter((l) => (l.long ? l.price < b.low : l.price > b.high));
  };
  warm.forEach(advance);
  bars.forEach((b, col) => {
    advance(b);
    for (const l of levels) {
      if (l.price < lo || l.price > hi) continue;
      const row = Math.min(rows - 1, Math.floor(((hi - l.price) / (hi - lo)) * rows));
      grid[row * cols + col] += l.usd;
    }
  });
  // Scale to 0–100 against the 98th percentile, so a few huge cells don't flatten the rest.
  const sorted = [...grid].filter((v) => v > 0).sort((a, b) => a - b);
  const cap = sorted[Math.floor(sorted.length * 0.97)] || 1;
  return {
    t0: bars[0].ts,
    step,
    lo,
    hi,
    rows,
    cols,
    cells: [...grid].map((v) => Math.round(Math.min(1, Math.sqrt(v / cap)) * 100)),
    close: bars.map((b) => b.close),
  };
}

const heatCache = { BTC: cached(10 * 60_000, () => loadHeat("BTC")), ETH: cached(10 * 60_000, () => loadHeat("ETH")) };
export async function getLiqHeat(coin: Coin): Promise<LiqHeat | null> {
  return heatCache[coin]();
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
