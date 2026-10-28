import { describe, getWeather } from "@/lib/weather";

/** Travel page: a sliding row of weather cards for popular destinations. */
export async function WeatherStrip({ lang, region }: { lang: "vi" | "en"; region?: string }) {
  const all = await getWeather();
  const list = region === "vn" || region === "intl" ? all.filter((w) => w.region === region) : all;
  if (!list.length) return null;
  const vi = lang === "vi";
  return (
    <section className="wx" aria-label={vi ? "Thời tiết điểm du lịch" : "Weather at destinations"}>
      <h2 className="chart-h">
        {vi ? "Thời tiết điểm đến" : "Weather at destinations"} <span>Open-Meteo</span>
      </h2>
      <div className="wx-row">
        {list.map((w) => {
          const d = describe(w.code, lang);
          return (
            <div key={w.id} className="wx-card" title={d.label}>
              <span className="wx-place">{w[lang]}</span>
              <span className="wx-icon" aria-hidden="true">{d.icon}</span>
              <b className="wx-temp">{w.temp}°</b>
              <span className="wx-range">{w.min}° / {w.max}°</span>
              <span className="wx-label">{d.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
