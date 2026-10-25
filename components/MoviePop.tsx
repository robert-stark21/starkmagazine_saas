"use client";
import { useEffect, useState } from "react";
import PopShell, { type PopProps } from "./PopShell";
import { canHover, YtLite } from "./YtLite";
import type { Movie, MovieDetail } from "@/lib/ent";

/**
 * Film popup (Film ticker): the YouTube trailer (a muted preview starts by itself with a
 * mouse; tap to play on phones), release date, runtime, age rating, genres and synopsis.
 */
type M = Movie & { id: string };
const cache = new Map<string, Promise<MovieDetail>>();
function load(m: M): Promise<MovieDetail> {
  let p = cache.get(m.slug);
  if (!p) {
    p = fetch(`/api/movies?slug=${encodeURIComponent(m.slug)}`).then((r) => (r.ok ? r.json() : Promise.reject()));
    p.catch(() => cache.delete(m.slug));
    cache.set(m.slug, p);
  }
  return p;
}
export function prefetchMovie(m: M) {
  load(m).catch(() => {});
}

const T = {
  vi: { release: "Khởi chiếu", runtime: "Thời lượng", age: "Độ tuổi", cast: "Diễn viên", play: "Xem trailer", more: "Lịch chiếu và đặt vé trên Moveek", close: "Đóng", noTrailer: "Chưa có trailer." },
  en: { release: "Release", runtime: "Runtime", age: "Rating", cast: "Cast", play: "Play trailer", more: "Showtimes and tickets on Moveek", close: "Close", noTrailer: "No trailer yet." },
} as const;

export const fmtDay = (iso: string, lang: "vi" | "en", year = true) =>
  new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", { day: "2-digit", month: "2-digit", ...(year ? { year: "numeric" } : {}), timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

function Body({ m, lang }: { m: M; lang: "vi" | "en" }) {
  const t = T[lang];
  const [d, setD] = useState<MovieDetail | null>(null);
  const [err, setErr] = useState(false);
  const [auto] = useState(canHover);
  useEffect(() => {
    let stop = false;
    load(m).then((x) => !stop && setD(x)).catch(() => !stop && setErr(true));
    return () => { stop = true; };
  }, [m]);
  const facts = [
    [t.release, fmtDay(m.release, lang)],
    [t.runtime, d?.runtime],
    [t.age, d?.age],
  ].filter((f) => f[1]) as [string, string][];
  return (
    <>
      <div className="mp-top">
        <span className="mp-league">{m.genres.slice(0, 3).join(" · ") || "Phim"}</span>
      </div>
      <h3 className="mv-title">{m.title}</h3>
      {d?.trailer ? (
        <YtLite id={d.trailer} title={`${m.title} – trailer`} autoMuted={auto} playLabel={t.play} />
      ) : !d && !err ? (
        <div className="yt yt-wait" aria-hidden="true" />
      ) : (
        <p className="mp-note">{t.noTrailer}</p>
      )}
      <dl className="mv-facts">
        {facts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {d?.synopsis && <p className="mv-syn">{d.synopsis}</p>}
      {d?.cast && <p className="mv-cast"><span>{t.cast}:</span> {d.cast}</p>}
      <a className="mp-more" href={d?.link ?? `https://moveek.com/phim/${m.slug}/`} target="_blank" rel="noopener noreferrer">
        {t.more} <span aria-hidden="true">↗</span>
      </a>
    </>
  );
}

export default function MoviePop(props: PopProps<M>) {
  const { match, lang } = props;
  return (
    <PopShell {...props} id={match.id} label={match.title} closeLabel={T[lang].close}>
      <Body m={match} lang={lang} />
    </PopShell>
  );
}
