"use client";
import { useEffect, useState } from "react";
import PopShell, { type PopProps } from "./PopShell";
import { YtLite } from "./YtLite";
import type { Song } from "@/lib/ent";

/** Hot song popup (Showbiz ticker): the music video and where to listen. */
type Detail = { video: string | null; links: { youtube: string; zing: string; spotify: string } };
const cache = new Map<string, Promise<Detail>>();

function load(s: Song): Promise<Detail> {
  let p = cache.get(s.id);
  if (!p) {
    const q = new URLSearchParams({ id: s.id, q: `${s.artist.split(",")[0]} ${s.title}`, title: s.title, artist: s.artist });
    p = fetch(`/api/songs?${q}`).then((r) => (r.ok ? r.json() : Promise.reject()));
    p.catch(() => cache.delete(s.id));
    cache.set(s.id, p);
  }
  return p;
}
export function prefetchSong(s: Song) {
  load(s).catch(() => {});
}

const T = {
  vi: { vn: "BXH Việt Nam", global: "BXH Thế giới", play: "Phát video", yt: "YouTube", mp3: "Zing MP3", sp: "Spotify", close: "Đóng", noVideo: "Chưa tìm thấy video." },
  en: { vn: "Vietnam chart", global: "Global chart", play: "Play video", yt: "YouTube", mp3: "Zing MP3", sp: "Spotify", close: "Close", noVideo: "No video found yet." },
} as const;

function Body({ s, lang }: { s: Song; lang: "vi" | "en" }) {
  const t = T[lang];
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let stop = false;
    load(s).then((x) => !stop && setD(x)).catch(() => !stop && setErr(true));
    return () => { stop = true; };
  }, [s]);
  const q = encodeURIComponent(`${s.artist.split(",")[0]} ${s.title}`);
  const links = d?.links ?? { youtube: `https://www.youtube.com/results?search_query=${q}`, zing: `https://zingmp3.vn/tim-kiem/tat-ca?q=${q}`, spotify: `https://open.spotify.com/track/${s.id}` };
  const move = s.move === "new" ? "NEW" : s.move ? `${s.move > 0 ? "▲" : "▼"}${Math.abs(s.move)}` : "";
  return (
    <>
      <div className="mp-top">
        <span className="mp-league">{t[s.chart]} · #{s.rank}{move && <span className={`sp-mv ${s.move === "new" ? "new" : (s.move as number) > 0 ? "up" : "down"}`}> {move}</span>}</span>
      </div>
      <div className="sp-head">
        {s.cover && <img src={s.cover} width={64} height={64} alt="" decoding="async" />}
        <div>
          <b className="sp-title">{s.title}</b>
          <span className="sp-artist">{s.artist}</span>
        </div>
      </div>
      {d?.video ? (
        <YtLite id={d.video} title={`${s.artist} – ${s.title}`} playLabel={t.play} />
      ) : !d && !err ? (
        <div className="yt yt-wait" aria-hidden="true" />
      ) : (
        <p className="mp-note">{t.noVideo}</p>
      )}
      <div className="sp-links">
        <a href={links.youtube} target="_blank" rel="noopener noreferrer" className="sp-yt">▶ {t.yt}</a>
        <a href={links.zing} target="_blank" rel="noopener noreferrer" className="sp-zing">♫ {t.mp3}</a>
        <a href={links.spotify} target="_blank" rel="noopener noreferrer" className="sp-sp">● {t.sp}</a>
      </div>
    </>
  );
}

export default function SongPop(props: PopProps<Song>) {
  const { match, lang } = props;
  return (
    <PopShell {...props} id={match.id} label={`${match.artist} – ${match.title}`} closeLabel={T[lang].close}>
      <Body s={match} lang={lang} />
    </PopShell>
  );
}
