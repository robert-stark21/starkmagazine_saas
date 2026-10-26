import { getEconCalendar, getLiquidations, type EconEvent, type LiqPanel } from "@/lib/markets";
import { translateMany } from "@/lib/translate";
import { LiqViews } from "./LiqViews";

/**
 * Panels pinned under the Crypto and Finance titles, in the same cards as the Showbiz
 * charts. Each hides itself when its source fails.
 */

const usd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
const px = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString("en-US", { maximumFractionDigits: 0 }));
const vnTime = (ms: number, lang: "vi" | "en") =>
  new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(ms));

/** Crypto: BTC and ETH liquidations (OKX, last 24h) and estimated liquidation levels. */
export async function LiquidationPanels({ lang }: { lang: "vi" | "en" }) {
  const panels = await getLiquidations();
  if (!panels.length) return null;
  const vi = lang === "vi";
  return (
    <div className="charts market">
      {panels.map((p) => <LiqCard key={p.coin} p={p} vi={vi} lang={lang} />)}
    </div>
  );
}

function LiqCard({ p, vi, lang }: { p: LiqPanel; vi: boolean; lang: "vi" | "en" }) {
  const max = Math.max(1, ...p.bins.map((b) => Math.max(b.long, b.short)));
  return (
    <section className="chart liq" aria-label={`${p.coin} ${vi ? "thanh lý" : "liquidations"}`}>
      <h2 className="chart-h">
        {p.coin} <b className="liq-px">${p.price.toLocaleString("en-US", { maximumFractionDigits: p.price > 1000 ? 0 : 2 })}</b>
        <span>{vi ? `Thanh lý · OKX ${p.hours || 24}h` : `Liquidations · OKX ${p.hours || 24}h`}</span>
        <a className="chart-more" href={`https://www.coinglass.com/pro/futures/LiquidationHeatMap?coin=${p.coin}`} target="_blank" rel="noopener noreferrer">
          Coinglass ↗
        </a>
      </h2>
      <div className="liq-tot">
        {p.totals.map((t) => {
          const all = t.long + t.short || 1;
          return (
            <div key={t.label}>
              <span className="liq-lab">{t.label}</span>
              <span className="liq-nums"><b className="lg">{usd(t.long)}</b> <b className="sh">{usd(t.short)}</b></span>
              <span className="liq-split" aria-hidden="true"><i className="lg" style={{ width: `${(t.long / all) * 100}%` }} /><i className="sh" /></span>
            </div>
          );
        })}
      </div>
      <LiqViews heat={p.heat} lang={lang}>
      {p.bins.length > 0 && (
        <ol className="liq-bins" aria-label={vi ? "Thanh lý theo vùng giá, 24 giờ" : "Liquidations by price, 24 hours"}>
          {p.bins.map((b) => (
            <li key={b.from} className={b.current ? "now" : undefined}>
              <span className="liq-range">{px(b.from)}–{px(b.to)}</span>
              {/* Longs grow left of the centre line, shorts right. */}
              <span className="liq-bar">
                <span><i className="lg" style={{ width: `${(b.long / max) * 100}%` }} title={`Long ${usd(b.long)}`} /></span>
                <span><i className="sh" style={{ width: `${(b.short / max) * 100}%` }} title={`Short ${usd(b.short)}`} /></span>
              </span>
              <span className="liq-v">{b.current ? (vi ? "◀ giá" : "◀ price") : b.long + b.short ? usd(b.long + b.short) : ""}</span>
            </li>
          ))}
        </ol>
      )}
      </LiqViews>
      <div className="liq-lev">
        <span className="liq-lab">{vi ? "Mức thanh lý ước tính" : "Estimated liquidation levels"}</span>
        <span className="lg">Long {p.levels.map((l) => `${l.lev}x ${px(l.long)}`).join(" · ")}</span>
        <span className="sh">Short {p.levels.map((l) => `${l.lev}x ${px(l.short)}`).join(" · ")}</span>
      </div>
      {p.biggest && (
        <p className="liq-big">
          {vi ? "Lệnh lớn nhất" : "Biggest"}: <b className={p.biggest.side === "long" ? "lg" : "sh"}>{p.biggest.side === "long" ? "Long" : "Short"} {usd(p.biggest.usd)}</b> @ {px(p.biggest.price)} · {vnTime(p.biggest.ts, lang)}
        </p>
      )}
    </section>
  );
}

/** Finance: today's and the coming days' important economic events with their results. */
export async function EconPanels({ lang }: { lang: "vi" | "en" }) {
  const events = await getEconCalendar();
  if (!events.length) return null;
  const vi = lang === "vi";
  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
  const today = dayOf(new Date().toISOString());
  const todays = events.filter((e) => dayOf(e.time) === today);
  const later = events.filter((e) => dayOf(e.time) > today && e.impact === "High").slice(0, 10);
  // Vietnamese names in VI mode (machine translation, cached); English if it takes too long.
  const titles = [...new Set([...todays, ...later].map((e) => e.title))];
  // "m/m", "y/y", "q/q" read as MoM / YoY / QoQ, as Vietnamese finance news writes them.
  const plain = titles.map((t) => t.replace(/\bm\/m\b/g, "MoM").replace(/\by\/y\b/g, "YoY").replace(/\bq\/q\b/g, "QoQ"));
  const tr = vi
    ? await Promise.race([translateMany(plain, "vi"), new Promise<string[]>((r) => setTimeout(() => r(plain), 2500))])
    : titles;
  const name = new Map(titles.map((t, i) => [t, tr[i] || t]));
  const next = events.find((e) => Date.parse(e.time) > Date.now())?.id;
  const card = (title: string, list: EconEvent[], withDay: boolean) => (
    <section className="chart econ" aria-label={title}>
      <h2 className="chart-h">
        {title} <span>{vi ? "giờ Việt Nam" : "Vietnam time"}</span>
        <a className="chart-more" href="https://vn.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer">Investing ↗</a>
      </h2>
      {list.length ? (
        <table className="econ-t">
          <thead>
            <tr>
              <th>{vi ? "Giờ" : "Time"}</th><th /><th>{vi ? "Sự kiện" : "Event"}</th>
              <th>{vi ? "Thực tế" : "Actual"}</th><th>{vi ? "Dự báo" : "Forecast"}</th><th className="econ-prev">{vi ? "Trước" : "Prev."}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className={`${e.id === next ? "next" : ""}${Date.parse(e.time) <= Date.now() ? " done" : ""}`}>
                <td className="econ-time">
                  {e.id === next && <i className="econ-arrow" aria-label={vi ? "Sắp tới" : "Next"}>▶</i>}
                  {withDay && <small>{new Intl.DateTimeFormat(vi ? "vi-VN" : "en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(e.time))} </small>}
                  {vnTime(Date.parse(e.time), lang)}
                </td>
                <td className="econ-cur"><b>{e.currency}</b><i className={`econ-imp ${e.impact.toLowerCase()}`} title={e.impact === "High" ? (vi ? "Ảnh hưởng cao" : "High impact") : vi ? "Ảnh hưởng trung bình" : "Medium impact"} /></td>
                <td className="econ-name">{name.get(e.title)}</td>
                <td className={`econ-act ${e.verdict ?? ""}`}>{e.actual ?? ""}</td>
                <td>{e.forecast ?? ""}</td>
                <td className="econ-prev">{e.previous ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="econ-empty">{vi ? "Hôm nay không có tin quan trọng." : "No important releases today."}</p>
      )}
    </section>
  );
  return (
    <div className="charts market">
      {card(vi ? "Tin quan trọng hôm nay" : "Today's key releases", todays, false)}
      {card(vi ? "Sắp tới trong tuần" : "Coming up this week", later, true)}
    </div>
  );
}
