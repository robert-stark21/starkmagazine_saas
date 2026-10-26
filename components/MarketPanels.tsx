import { getEconCalendar, type EconEvent } from "@/lib/markets";
import { getLiquidations } from "@/lib/liq";
import { translateMany } from "@/lib/translate";
import { LiqCard } from "./LiqCard";

/**
 * Panels pinned under the Crypto and Finance titles, in the same cards as the Showbiz
 * charts. Each hides itself when its source fails.
 */

const vnTime = (ms: number, lang: "vi" | "en") =>
  new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(ms));

/** Crypto: BTC and ETH liquidation cards, on the first exchange that answers (pickable). */
export async function LiquidationPanels({ lang }: { lang: "vi" | "en" }) {
  const { panels, available } = await getLiquidations();
  if (!panels.length) return null;
  return (
    <div className="charts market">
      {panels.map((p) => <LiqCard key={p.coin} initial={p} available={available} lang={lang} />)}
    </div>
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
  // The rest of the week, high and medium impact; the card scrolls inside.
  const later = events.filter((e) => dayOf(e.time) > today);
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
        <div className="econ-scroll">
        <table className="econ-t">
          <thead>
            <tr>
              <th>{vi ? "Giờ" : "Time"}</th><th /><th>{vi ? "Sự kiện" : "Event"}</th>
              <th>{vi ? "Thực tế" : "Actual"}</th><th>{vi ? "Dự báo" : "Forecast"}</th><th className="econ-prev">{vi ? "Trước" : "Prev."}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => [
              // A day line before each new day ("Thứ 4, 28/10").
              withDay && (i === 0 || dayOf(list[i - 1].time) !== dayOf(e.time)) && (
                <tr key={`d${e.id}`} className="econ-day">
                  <td colSpan={6}>{new Intl.DateTimeFormat(vi ? "vi-VN" : "en-GB", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(e.time))}</td>
                </tr>
              ),
              <tr key={e.id} className={`${e.id === next ? "next" : ""}${Date.parse(e.time) <= Date.now() ? " done" : ""}`}>
                <td className="econ-time">
                  {e.id === next && <i className="econ-arrow" aria-label={vi ? "Sắp tới" : "Next"}>▶</i>}
                  {vnTime(Date.parse(e.time), lang)}
                </td>
                <td className="econ-cur"><b>{e.currency}</b><i className={`econ-imp ${e.impact.toLowerCase()}`} title={e.impact === "High" ? (vi ? "Ảnh hưởng cao" : "High impact") : vi ? "Ảnh hưởng trung bình" : "Medium impact"} /></td>
                <td className="econ-name" title={name.get(e.title)}><span>{name.get(e.title)}</span></td>
                <td className={`econ-act ${e.verdict ?? ""}`}>{e.actual ?? ""}</td>
                <td>{e.forecast ?? ""}</td>
                <td className="econ-prev">{e.previous ?? ""}</td>
              </tr>,
            ])}
          </tbody>
        </table>
        </div>
      ) : (
        <p className="econ-empty">{withDay ? (vi ? "Không còn tin quan trọng trong tuần." : "No more important releases this week.") : vi ? "Hôm nay không có tin quan trọng." : "No important releases today."}</p>
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
