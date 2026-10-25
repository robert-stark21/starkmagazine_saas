"use client";
import { useEffect, useState } from "react";
import PopShell, { type PopProps } from "./PopShell";
import type { LolDetail, LolGame, LolMatch } from "@/lib/lol";
import { LOL_LOGOS, LolBadge } from "./client";

/**
 * LoL match popup for the E-sport ticker, loaded only on that page: teams, series score,
 * best-of and stage, then each game with its winner, kills, towers, gold and length (from
 * Riot's live stats), and a link to watch on lolesports.com.
 */
type Lang = "vi" | "en";
const T = {
  vi: {
    game: "Ván", live: "Đang đấu", next: "Chưa đấu", won: "Thắng", finished: "Kết thúc", notStarted: "Chưa bắt đầu",
    start: "Giờ thi đấu", format: "Thể thức", stage: "Vòng", kills: "Hạ gục", towers: "Trụ", gold: "Vàng", min: "phút",
    watch: "Xem trên LoL Esports", watchLive: "Xem trực tiếp trên LoL Esports", error: "Chưa tải được chi tiết trận đấu.", close: "Đóng",
    noGames: "Chưa có thông tin từng ván.",
  },
  en: {
    game: "Game", live: "Live", next: "Not played", won: "Won", finished: "Final", notStarted: "Not started",
    start: "Start", format: "Format", stage: "Stage", kills: "Kills", towers: "Towers", gold: "Gold", min: "min",
    watch: "Watch on LoL Esports", watchLive: "Watch live on LoL Esports", error: "Could not load the match details.", close: "Close",
    noGames: "No game details yet.",
  },
} as const;

const cache = new Map<string, { at: number; data: LolDetail }>();
const pending = new Map<string, Promise<LolDetail>>();
const maxAge = (d: LolDetail) => (d.state === "live" ? 25_000 : d.state === "pre" ? 300_000 : 3_600_000);

function load(m: LolMatch, force = false): Promise<LolDetail> {
  const hit = cache.get(m.id);
  if (hit && !force && Date.now() - hit.at < maxAge(hit.data)) return Promise.resolve(hit.data);
  let p = pending.get(m.id);
  if (!p) {
    p = fetch(`/api/lol?id=${encodeURIComponent(m.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: LolDetail) => (cache.set(m.id, { at: Date.now(), data }), data))
      .finally(() => pending.delete(m.id));
    pending.set(m.id, p);
  }
  return p;
}

/** Starts loading a match before its panel opens (hover intent). */
export function prefetchLol(m: LolMatch) {
  load(m).catch(() => {});
}

function useDetail(m: LolMatch) {
  const [state, setState] = useState<{ id: string; data?: LolDetail; error?: boolean }>(() => ({ id: m.id, data: cache.get(m.id)?.data }));
  useEffect(() => {
    let stop = false;
    const run = (force = false) =>
      load(m, force)
        .then((data) => !stop && setState({ id: m.id, data }))
        .catch(() => !stop && setState((s) => (s.id === m.id && s.data ? s : { id: m.id, error: true })));
    run();
    const t = m.state === "live" ? setInterval(() => run(true), 30_000) : undefined;
    return () => { stop = true; clearInterval(t); };
  }, [m]);
  return state.id === m.id ? state : { id: m.id };
}

const fmtTime = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", {
    hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
const kGold = (n: number) => `${(n / 1000).toFixed(1)}k`;

function Game({ g, d, lang }: { g: LolGame; d: LolDetail; lang: Lang }) {
  const t = T[lang];
  const [a, b] = d.teams;
  const side = (code: string) => (g.blue === code ? "blue" : g.red === code ? "red" : "");
  const cell = (code: string, i: 0 | 1) => (
    <span className={`lg-team ${i ? "r" : "l"} ${side(code)}${g.winner === code ? " win" : ""}`}>
      {i === 1 && g.winner === code && <i className="lg-won">{t.won}</i>}
      <b>{code}</b>
      {i === 0 && g.winner === code && <i className="lg-won">{t.won}</i>}
    </span>
  );
  return (
    <li className={`lg-row${g.state === "live" ? " live" : ""}`}>
      <span className="lg-n">{t.game} {g.number}</span>
      {cell(a.code, 0)}
      <span className="lg-mid">
        {g.kills ? <b>{g.kills[0]} - {g.kills[1]}</b> : <span className="lg-state">{g.state === "live" ? t.live : g.state === "next" ? t.next : "–"}</span>}
        {g.state === "live" && g.kills && <span className="lg-state live"><i className="m-dot" />{t.live}</span>}
      </span>
      {cell(b.code, 1)}
      {(g.towers || g.minutes) && (
        <span className="lg-sub">
          {g.towers && <>{t.towers} {g.towers[0]}–{g.towers[1]}</>}
          {g.gold && <> · {t.gold} {kGold(g.gold[0])}–{kGold(g.gold[1])}</>}
          {g.minutes ? <> · {g.minutes} {t.min}</> : null}
        </span>
      )}
    </li>
  );
}

function Body({ m, lang }: { m: LolMatch; lang: Lang }) {
  const t = T[lang];
  const { data, error } = useDetail(m);
  const d: LolDetail = data ?? { ...m, leagueName: LOL_LOGOS[m.league].name, games: [], link: `https://lolesports.com/en-US/leagues/${m.league}` };
  const status = d.state === "live" ? "LIVE" : d.state === "post" ? t.finished : fmtTime(d.start || m.start, lang);
  const [a, b] = d.teams;
  return (
    <>
      <div className="mp-top">
        <LolBadge src={LOL_LOGOS[d.league].src} name={d.leagueName} />
        <span className="mp-league">{d.leagueName}{(d.block ?? m.block) ? ` · ${d.block ?? m.block}` : ""}</span>
        <span className={`mp-status${d.state === "live" ? " live" : ""}`}>
          {d.state === "live" && <i className="m-dot" />}
          {status}
        </span>
      </div>
      <div className="mp-teams">
        {[a, b].map((x, i) => (
          <span className={`mp-team${x.outcome === "win" ? " lol-win" : ""}`} key={i} style={{ order: i * 2 }}>
            <LolBadge src={x.image} name={x.name} size={40} />
            <b>{x.code}</b>
            {x.name !== x.code && <small className="mp-tname">{x.name}</small>}
          </span>
        ))}
        <span className="mp-score" style={{ order: 1 }}>
          {d.state === "pre" ? "–" : `${a.wins} - ${b.wins}`}
          <small className="mp-bo">Bo{d.bestOf}</small>
        </span>
      </div>

      {d.state === "pre" ? (
        <dl className="mp-pre">
          <div><dt>{t.start}</dt><dd>{fmtTime(d.start || m.start, lang)}</dd></div>
          <div><dt>{t.format}</dt><dd>Bo{d.bestOf}</dd></div>
          {(d.block ?? m.block) && <div><dt>{t.stage}</dt><dd>{d.block ?? m.block}</dd></div>}
          <p className="mp-note">{t.notStarted}</p>
        </dl>
      ) : !data && !error ? (
        <div className="mp-skel" aria-hidden="true"><i /><i /><i /></div>
      ) : error && !data ? (
        <p className="mp-note">{t.error}</p>
      ) : d.games.length === 0 ? (
        <p className="mp-note">{t.noGames}</p>
      ) : (
        <ol className="lg-list">{d.games.map((g) => <Game key={g.number} g={g} d={d} lang={lang} />)}</ol>
      )}

      <a className="mp-more" href={d.link} target="_blank" rel="noopener noreferrer">
        {d.state === "live" ? t.watchLive : t.watch} <span aria-hidden="true">↗</span>
      </a>
    </>
  );
}

export default function LolPop(props: PopProps<LolMatch>) {
  const { match, lang } = props;
  return (
    <PopShell {...props} id={match.id} label={`${match.teams[0].code} – ${match.teams[1].code}`} closeLabel={T[lang].close}>
      <Body m={match} lang={lang} />
    </PopShell>
  );
}
