/**
 * Crypto liquidations for the BTC and ETH cards, from exchanges with free public data:
 * - OKX: every liquidation order of the last ~24h (price, side, size), candles, open interest.
 * - HTX: liquidation orders (asked in 2-hour windows), candles, hourly open interest.
 * - Gate: 15-minute statistics (long/short liquidated in USD, open interest, mark price);
 *   no single orders, so a band holds what was liquidated while price was there.
 * - Binance: candles and open interest history, but no public liquidation history (only a
 *   live socket), so only the estimated heatmap.
 * - Hyperliquid: candles and today's open interest, no history of either liquidations or
 *   open interest; its heatmap uses traded volume as a stand-in for new positions.
 * "All" adds up the liquidations and open interest of those that publish them.
 * Bybit and Bitget give no liquidation history without a key.
 *
 * The heatmap is an estimate in the spirit of Coinglass: whenever open interest grows, the
 * new positions are assumed to open within that candle's range with a typical leverage mix;
 * each leaves a long and a short liquidation price. Levels stay until price trades through
 * them and shrink when open interest falls.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const H = 3_600_000;

async function getJson(url: string, timeout = 8000) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

export type Coin = "BTC" | "ETH";
export type ExId = "okx" | "binance" | "htx" | "gate" | "hl" | "all";
export const EXCHANGES: { id: Exclude<ExId, "all">; name: string }[] = [
  { id: "okx", name: "OKX" },
  { id: "binance", name: "Binance" },
  { id: "htx", name: "HTX" },
  { id: "gate", name: "Gate" },
  { id: "hl", name: "Hyperliquid" },
];

type Liq = { side: "long" | "short"; usd: number; price: number; ts: number };
type Bar = { ts: number; high: number; low: number; close: number };
// hasLiq: the exchange publishes liquidations; realOi: open interest history (not a stand-in).
type Raw = { liqs: Liq[]; orders: boolean; hasLiq: boolean; realOi: boolean; bars15: Bar[]; bars1h: Bar[]; oi: Map<number, number> };

export type LiqHeat = { t0: number; step: number; lo: number; hi: number; rows: number; cols: number; cells: number[]; close: number[] };
export type LiqPanel = {
  coin: Coin;
  ex: ExId;
  exName: string;
  price: number;
  hours: number;
  orders: boolean; // single liquidation orders (else 15-minute totals)
  hasLiq: boolean; // false: no liquidation data at all (heatmap only)
  totals: { label: "1h" | "4h" | "24h"; long: number; short: number }[];
  bins: { from: number; to: number; long: number; short: number; current: boolean }[];
  biggest?: Liq;
  levels: { lev: number; long: number; short: number }[];
  heat: LiqHeat | null;
};

// ---------------------------------------------------------------- per exchange
const CT_VAL: Record<Coin, number> = { BTC: 0.01, ETH: 0.1 };

async function okx(coin: Coin): Promise<Raw> {
  const inst = `${coin}-USDT-SWAP`;
  const liqs: Liq[] = [];
  const since = Date.now() - 24 * H;
  const orders = (async () => {
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
        const side = d.posSide === "long" || (d.posSide !== "short" && d.side === "sell") ? "long" : "short";
        liqs.push({ side, usd: sz * CT_VAL[coin] * price, price, ts });
      }
      if (oldest < since) break;
      after = String(oldest);
    }
  })();
  const bars = (j: any) => ((j?.data ?? []) as string[][]).map((c) => ({ ts: +c[0], high: +c[2], low: +c[3], close: +c[4] })).reverse();
  const [, c15, c1h, oi15, oi1h] = await Promise.all([
    orders,
    getJson(`https://www.okx.com/api/v5/market/candles?instId=${inst}&bar=15m&limit=96`),
    getJson(`https://www.okx.com/api/v5/market/candles?instId=${inst}&bar=1H&limit=100`),
    getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${inst}&period=15m&limit=100`),
    getJson(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${inst}&period=1H&limit=100`),
  ]);
  const oi = new Map<number, number>();
  for (const j of [oi1h, oi15]) for (const r of (j?.data ?? []) as string[][]) oi.set(+r[0], +r[3]);
  return { liqs, orders: true, hasLiq: true, realOi: true, bars15: bars(c15), bars1h: bars(c1h), oi };
}

async function binance(coin: Coin): Promise<Raw> {
  const sym = `${coin}USDT`;
  const k = (i: string, n: number) => getJson(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${i}&limit=${n}`);
  const o = (p: string) => getJson(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=${p}&limit=100`);
  const [k15, k1h, o15, o1h] = await Promise.all([k("15m", 96), k("1h", 100), o("15m"), o("1h")]);
  const bars = (j: any[]) => j.map((c) => ({ ts: +c[0], high: +c[2], low: +c[3], close: +c[4] }));
  const oi = new Map<number, number>();
  for (const r of [...(o1h as any[]), ...(o15 as any[])]) oi.set(Number(r.timestamp), Number(r.sumOpenInterestValue));
  return { liqs: [], orders: false, hasLiq: false, realOi: true, bars15: bars(k15), bars1h: bars(k1h), oi };
}

async function hl(coin: Coin): Promise<Raw> {
  const post = (body: object) =>
    fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
  const now = Date.now();
  const [c15, c1h] = await Promise.all([
    post({ type: "candleSnapshot", req: { coin, interval: "15m", startTime: now - 24 * H } }),
    post({ type: "candleSnapshot", req: { coin, interval: "1h", startTime: now - 100 * H } }),
  ]);
  const toBars = (j: any[]) => j.map((c) => ({ ts: c.t, high: +c.h, low: +c.l, close: +c.c, usd: +c.v * +c.c }));
  const b15 = toBars(c15).slice(-96), b1h = toBars(c1h);
  // No open interest history: a stand-in where a tenth of the traded value opens new positions
  // and 3% of what is open closes every quarter hour (12% an hour).
  const oi = new Map<number, number>();
  let level = 0;
  for (const b of b1h.filter((x) => x.ts + H <= (b15[0]?.ts ?? now))) oi.set(b.ts, (level = level * 0.88 + b.usd * 0.1));
  for (const b of b15) oi.set(b.ts, (level = level * 0.97 + b.usd * 0.1));
  const strip = (x: { ts: number; high: number; low: number; close: number }) => ({ ts: x.ts, high: x.high, low: x.low, close: x.close });
  return { liqs: [], orders: false, hasLiq: false, realOi: false, bars15: b15.map(strip), bars1h: b1h.map(strip), oi };
}

async function htx(coin: Coin): Promise<Raw> {
  const code = `${coin}-USDT`;
  const now = Date.now();
  // The API answers at most two hours per question: twelve windows for a day.
  const windows = await Promise.all(
    Array.from({ length: 12 }, (_, w) => {
      const end = now - w * 2 * H;
      return getJson(`https://api.hbdm.com/linear-swap-api/v3/swap_liquidation_orders?contract=${code}&pair=${code}&trade_type=0&start_time=${end - 2 * H + 1}&end_time=${end}`)
        .then((j) => (j?.code === 200 ? (j.data as any[]) : []))
        .catch(() => []);
    })
  );
  const liqs: Liq[] = windows.flat().flatMap((d: any): Liq[] => {
    const price = Number(d.price), usd = Number(d.trade_turnover), ts = Number(d.created_at);
    if (!(price && usd && ts)) return [];
    // Closing a long is a sell; closing a short is a buy.
    return [{ side: d.direction === "sell" ? "long" : "short", usd, price, ts }];
  });
  const k = (period: string, size: number) => getJson(`https://api.hbdm.com/linear-swap-ex/market/history/kline?contract_code=${code}&period=${period}&size=${size}`);
  const bars = (j: any) => ((j?.data ?? []) as any[]).map((c) => ({ ts: c.id * 1000, high: c.high, low: c.low, close: c.close }));
  const [c15, c1h, oiH] = await Promise.all([
    k("15min", 96),
    k("60min", 100),
    getJson(`https://api.hbdm.com/linear-swap-api/v1/swap_his_open_interest?contract_code=${code}&period=60min&amount_type=2&size=100`),
  ]);
  if (j0(c15) === 0) throw new Error("htx candles");
  const oi = new Map<number, number>();
  for (const t of (oiH?.data?.tick ?? []) as any[]) oi.set(Number(t.ts), Number(t.value));
  return { liqs, orders: true, hasLiq: true, realOi: true, bars15: bars(c15), bars1h: bars(c1h), oi: fill15(oi) };
}
const j0 = (j: any) => ((j?.data ?? []) as any[]).length;

/** Hourly open interest spread over the quarter hours in between (straight line). */
function fill15(hourly: Map<number, number>): Map<number, number> {
  const pts = [...hourly].sort((a, b) => a[0] - b[0]);
  const out = new Map(pts);
  for (let i = 1; i < pts.length; i++) {
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    for (let t = t0 + 15 * 60_000; t < t1; t += 15 * 60_000) out.set(t, v0 + ((v1 - v0) * (t - t0)) / (t1 - t0));
  }
  return out;
}

async function gate(coin: Coin): Promise<Raw> {
  const c = `${coin}_USDT`;
  const [stats15, stats1h, k15, k1h] = await Promise.all([
    getJson(`https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=${c}&interval=15m&limit=100`),
    getJson(`https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=${c}&interval=1h&limit=100`),
    getJson(`https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${c}&interval=15m&limit=96`),
    getJson(`https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${c}&interval=1h&limit=100`),
  ]);
  const since = Date.now() - 24 * H;
  // 15-minute totals, placed at that quarter hour's mark price.
  const liqs: Liq[] = (stats15 as any[]).flatMap((s): Liq[] => {
    const ts = s.time * 1000, price = Number(s.mark_price);
    if (ts < since || !price) return [];
    const out: Liq[] = [];
    if (s.long_liq_usd > 0) out.push({ side: "long", usd: Number(s.long_liq_usd), price, ts });
    if (s.short_liq_usd > 0) out.push({ side: "short", usd: Number(s.short_liq_usd), price, ts });
    return out;
  });
  const oi = new Map<number, number>();
  for (const s of [...(stats1h as any[]), ...(stats15 as any[])]) oi.set(s.time * 1000, Number(s.open_interest_usd));
  const bars = (j: any[]) => j.map((k) => ({ ts: k.t * 1000, high: +k.h, low: +k.l, close: +k.c }));
  return { liqs, orders: false, hasLiq: true, realOi: true, bars15: bars(k15), bars1h: bars(k1h), oi };
}

const FETCH = { okx, binance, htx, gate, hl } as const;

// ---------------------------------------------------------------- shaping
function histogram(liqs: Liq[], price: number, rows = 9) {
  const prices = liqs.map((l) => l.price).concat(price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const raw = (hi - lo) / rows || price * 0.002;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(lo / step) * step;
  const n = Math.max(1, Math.ceil((hi - start) / step + 1e-9));
  const bins = Array.from({ length: n }, (_, i) => ({ from: start + i * step, to: start + (i + 1) * step, long: 0, short: 0, current: false }));
  for (const l of liqs) bins[Math.min(n - 1, Math.floor((l.price - start) / step))][l.side] += l.usd;
  const at = Math.min(n - 1, Math.floor((price - start) / step));
  if (bins[at]) bins[at].current = true;
  return bins.reverse();
}

const LEVERAGE: [number, number][] = [[5, 0.1], [10, 0.25], [25, 0.3], [50, 0.2], [100, 0.15]]; // assumed mix

function heatmap(bars: Bar[], warm: Bar[], oiAt: Map<number, number>): LiqHeat | null {
  if (bars.length < 20 || oiAt.size < 10) return null;
  const step = 15 * 60_000;
  const lo0 = Math.min(...bars.map((b) => b.low)), hi0 = Math.max(...bars.map((b) => b.high));
  const pad = (hi0 - lo0) * 0.35 + bars.at(-1)!.close * 0.01;
  const lo = lo0 - pad, hi = hi0 + pad, rows = 64, cols = bars.length;
  const grid = new Float64Array(rows * cols);
  type Level = { price: number; usd: number; long: boolean };
  let levels: Level[] = [];
  const open = (b: Bar, usd: number) => {
    for (const entry of [b.low, (b.low + b.high + b.close) / 3, b.high])
      for (const [lev, w] of LEVERAGE) {
        levels.push({ price: entry * (1 - 1 / lev + 0.005), usd: (usd * w) / 6, long: true });
        levels.push({ price: entry * (1 + 1 / lev - 0.005), usd: (usd * w) / 6, long: false });
      }
  };
  const first = warm[0]?.ts ?? bars[0].ts;
  let prevOi = oiAt.get(first) ?? [...oiAt.entries()].sort((a, b) => a[0] - b[0])[0][1];
  const advance = (b: Bar) => {
    const now = oiAt.get(b.ts) ?? prevOi;
    const d = now - prevOi;
    prevOi = now;
    if (d > 0) open(b, d);
    else if (d < 0) {
      const total = levels.reduce((a, l) => a + l.usd, 0) || 1;
      const k = Math.max(0, 1 + d / total);
      for (const l of levels) l.usd *= k;
    }
    levels = levels.filter((l) => (l.long ? l.price < b.low : l.price > b.high));
  };
  warm.filter((b) => b.ts + H <= bars[0].ts).forEach(advance);
  bars.forEach((b, col) => {
    advance(b);
    for (const l of levels) {
      if (l.price < lo || l.price > hi) continue;
      grid[Math.min(rows - 1, Math.floor(((hi - l.price) / (hi - lo)) * rows)) * cols + col] += l.usd;
    }
  });
  const sorted = [...grid].filter((v) => v > 0).sort((a, b) => a - b);
  const cap = sorted[Math.floor(sorted.length * 0.97)] || 1;
  return { t0: bars[0].ts, step, lo, hi, rows, cols, cells: [...grid].map((v) => Math.round(Math.min(1, Math.sqrt(v / cap)) * 100)), close: bars.map((b) => b.close) };
}

function panel(coin: Coin, ex: ExId, exName: string, raw: Raw): LiqPanel {
  const price = raw.bars15.at(-1)?.close ?? 0;
  if (!price) throw new Error("no price");
  const now = Date.now();
  const { liqs } = raw;
  const sum = (h: number, side: Liq["side"]) => liqs.filter((l) => l.side === side && now - l.ts <= h * H).reduce((a, l) => a + l.usd, 0);
  const oldest = liqs.length ? Math.min(...liqs.map((l) => l.ts)) : now - 24 * H;
  return {
    coin,
    ex,
    exName,
    price,
    hours: Math.max(1, Math.round((now - oldest) / H)),
    orders: raw.orders,
    hasLiq: raw.hasLiq,
    totals: ([[1, "1h"], [4, "4h"], [24, "24h"]] as const).map(([h, label]) => ({ label, long: sum(h, "long"), short: sum(h, "short") })),
    bins: liqs.length ? histogram(liqs, price) : [],
    biggest: raw.orders ? liqs.reduce<Liq | undefined>((m, l) => (!m || l.usd > m.usd ? l : m), undefined) : undefined,
    levels: [100, 50, 25, 10].map((lev) => ({ lev, long: price * (1 - 1 / lev + 0.005), short: price * (1 + 1 / lev - 0.005) })),
    heat: heatmap(raw.bars15, raw.bars1h, raw.oi),
  };
}

// ---------------------------------------------------------------- cache and API
const TTL = 10 * 60_000;
const raws = new Map<string, { at: number; value: Raw | null; job?: Promise<Raw | null> }>();

/** One exchange's data, cached; null when the exchange refuses or fails (kept 10 min too). */
async function rawOf(ex: Exclude<ExId, "all">, coin: Coin): Promise<Raw | null> {
  const key = `${ex}|${coin}`;
  const hit = raws.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  if (hit?.job) return hit.job;
  const job = FETCH[ex](coin)
    .then((r) => (r.bars15.length ? r : null))
    .catch(() => null)
    .then((value) => {
      // A failure keeps an older good copy for a while.
      const keep = value ?? (hit?.value && Date.now() - hit.at < 6 * TTL ? hit.value : null);
      raws.set(key, { at: value || !hit ? Date.now() : hit.at, value: keep });
      return keep;
    });
  raws.set(key, { at: hit?.at ?? 0, value: hit?.value ?? null, job });
  return job;
}

/** Everything added up: liquidations of those that publish them, real open interest, candles of the first. */
function combine(list: Raw[]): Raw {
  const withOi = list.filter((r) => r.realOi);
  const oi = new Map<number, number>();
  // Only times every exchange reported, so a missing point doesn't look like a drop.
  if (withOi.length) for (const [t] of withOi[0].oi) if (withOi.every((r) => r.oi.has(t))) oi.set(t, withOi.reduce((a, r) => a + r.oi.get(t)!, 0));
  const liq = list.filter((r) => r.hasLiq);
  return { liqs: liq.flatMap((r) => r.liqs), orders: liq.every((r) => r.orders), hasLiq: liq.length > 0, realOi: withOi.length > 0, bars15: list[0].bars15, bars1h: list[0].bars1h, oi };
}

export async function getLiqPanel(coin: Coin, ex: ExId): Promise<LiqPanel | null> {
  if (ex === "all") {
    const got = (await Promise.all(EXCHANGES.map((e) => rawOf(e.id, coin)))).filter((r): r is Raw => !!r);
    if (!got.length) return null;
    return panel(coin, "all", "all", combine(got));
  }
  const raw = await rawOf(ex, coin);
  return raw ? panel(coin, ex, EXCHANGES.find((e) => e.id === ex)!.name, raw) : null;
}

/** For the page: each coin on the first exchange that answers, and which exchanges work. */
export async function getLiquidations(): Promise<{ panels: LiqPanel[]; available: ExId[] }> {
  const ok = await Promise.all(EXCHANGES.map(async (e) => ((await Promise.all([rawOf(e.id, "BTC"), rawOf(e.id, "ETH")])).some(Boolean) ? e.id : null)));
  const available = ok.filter((x): x is Exclude<ExId, "all"> => !!x) as ExId[];
  if (!available.length) return { panels: [], available };
  if (available.length > 1) available.push("all");
  // Default: the first exchange that publishes liquidations (else the first that answers).
  const withLiq = await Promise.all(available.map(async (id) => (id !== "all" && (await rawOf(id, "BTC"))?.hasLiq ? id : null)));
  const first = withLiq.find(Boolean) ?? available[0];
  const panels = (await Promise.all((["BTC", "ETH"] as Coin[]).map((c) => getLiqPanel(c, first)))).filter((p): p is LiqPanel => !!p);
  return { panels, available };
}
