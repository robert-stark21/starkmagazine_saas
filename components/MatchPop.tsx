"use client";
import { useEffect, useState } from "react";
import PopShell, { type PopProps } from "./PopShell";
import type { EventKind, MatchDetail, TimelineRow } from "@/lib/match";
import type { Match } from "@/lib/scores";
import { LEAGUES, LeagueLogo } from "./client";

/**
 * Match popup for the Sports ticker, loaded only on that page. A panel under the hovered or
 * tapped match with the score, a livescore-style timeline (goals, cards, substitutions)
 * and a few statistics. Like Aceternity's navbar menu, it springs in and, when another
 * match is hovered, slides and resizes to it instead of closing and reopening.
 */

type Lang = "vi" | "en";
const T = {
  vi: {
    goal: "Bàn thắng", "pen-goal": "Phạt đền", "own-goal": "Phản lưới", "pen-miss": "Hỏng phạt đền",
    yellow: "Thẻ vàng", red: "Thẻ đỏ", "yellow-red": "Thẻ vàng thứ 2", sub: "Thay người",
    HT: "Hiệp 1", FT: "KT", AET: "Hiệp phụ", PEN: "Luân lưu",
    halftime: "Nghỉ giữa hiệp", finished: "Kết thúc", notStarted: "Chưa bắt đầu", kickoff: "Giờ bóng lăn", venue: "Sân",
    possession: "Kiểm soát bóng", shots: "Dứt điểm", onTarget: "Trúng đích", corners: "Phạt góc", fouls: "Phạm lỗi",
    noTimeline: "Nguồn dữ liệu chưa có diễn biến chi tiết cho trận này.", noEvents: "Chưa có diễn biến đáng chú ý.",
    error: "Chưa tải được chi tiết trận đấu.", more: "Xem chi tiết trận đấu", close: "Đóng",
    showSubs: "Hiện thay người", hideSubs: "Ẩn thay người",
  },
  en: {
    goal: "Goal", "pen-goal": "Penalty", "own-goal": "Own goal", "pen-miss": "Missed penalty",
    yellow: "Yellow card", red: "Red card", "yellow-red": "Second yellow", sub: "Substitution",
    HT: "HT", FT: "FT", AET: "AET", PEN: "Pens",
    halftime: "Half-time", finished: "Full time", notStarted: "Not started", kickoff: "Kick-off", venue: "Venue",
    possession: "Possession", shots: "Shots", onTarget: "On target", corners: "Corners", fouls: "Fouls",
    noTimeline: "The data source has no timeline for this match.", noEvents: "Nothing notable yet.",
    error: "Could not load the match details.", more: "Full match details", close: "Close",
    showSubs: "Show substitutions", hideSubs: "Hide substitutions",
  },
} as const;

// ---- data: one request per match, shared by prefetch and the open panel ----
const cache = new Map<string, { at: number; data: MatchDetail }>();
const pending = new Map<string, Promise<MatchDetail>>();
const maxAge = (d: MatchDetail) => (d.state === "live" ? 25_000 : d.state === "pre" ? 300_000 : 3_600_000);

function load(m: Match, force = false): Promise<MatchDetail> {
  const hit = cache.get(m.id);
  if (hit && !force && Date.now() - hit.at < maxAge(hit.data)) return Promise.resolve(hit.data);
  let p = pending.get(m.id);
  if (!p) {
    p = fetch(`/api/match?id=${encodeURIComponent(m.id)}&league=${m.league}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: MatchDetail) => (cache.set(m.id, { at: Date.now(), data }), data))
      .finally(() => pending.delete(m.id));
    pending.set(m.id, p);
  }
  return p;
}

/** Starts loading a match before its panel opens (hover intent). */
export function prefetchMatch(m: Match) {
  load(m).catch(() => {});
}

function useDetail(m: Match) {
  const [state, setState] = useState<{ id: string; data?: MatchDetail; error?: boolean }>(() => ({ id: m.id, data: cache.get(m.id)?.data }));
  useEffect(() => {
    let stop = false;
    const run = (force = false) =>
      load(m, force)
        .then((data) => !stop && setState({ id: m.id, data }))
        .catch(() => !stop && setState((s) => (s.id === m.id && s.data ? s : { id: m.id, error: true })));
    setState((s) => (s.id === m.id ? s : { id: m.id, data: cache.get(m.id)?.data }));
    run();
    // Live matches refresh while the panel stays open.
    const t = m.state === "live" ? setInterval(() => run(true), 30_000) : undefined;
    return () => { stop = true; clearInterval(t); };
  }, [m]);
  return state.id === m.id ? state : { id: m.id };
}

// ---- small pieces ----
function Crest({ src, name }: { src?: string; name: string }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return <span className="mp-crest mp-crest-x" aria-hidden="true">{name.slice(0, 1)}</span>;
  return <img className="mp-crest" src={src} width={32} height={32} alt="" loading="eager" decoding="async" onError={() => setOk(false)} />;
}

function Icon({ kind }: { kind: EventKind }) {
  switch (kind) {
    case "goal":
    case "pen-goal":
    case "own-goal":
    case "pen-miss":
      return (
        <span className={`mp-ic mp-ball ${kind}`} aria-hidden="true">
          {kind === "own-goal" && <i className="mp-og">OG</i>}
          <svg viewBox="0 0 16 16" width="15" height="15">
            <circle cx="8" cy="8" r="7" className="b-fill" />
            <path d="M8 4.6l2.6 1.9-1 3H6.4l-1-3z" className="b-patch" />
            <path d="M8 1v3.6M10.6 6.5l3.6-1.2M9.6 9.5l2.2 3.2M6.4 9.5l-2.2 3.2M5.4 6.5L1.8 5.3" className="b-seam" />
            {kind === "pen-miss" && <path d="M2.5 13.5l11-11" className="b-x" />}
          </svg>
        </span>
      );
    case "yellow":
    case "red":
      return <span className={`mp-ic mp-card ${kind}`} aria-hidden="true" />;
    case "yellow-red":
      return (
        <span className="mp-ic mp-card2" aria-hidden="true">
          <i className="mp-card yellow" />
          <i className="mp-card red" />
        </span>
      );
    case "sub":
      return (
        <span className="mp-ic mp-sub" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="15" height="15">
            <path d="M5 13V3M2 6l3-3 3 3" className="s-in" />
            <path d="M11 3v10M8 10l3 3 3-3" className="s-out" />
          </svg>
        </span>
      );
  }
}

const fmtTime = (iso: string, lang: Lang, withDay = true) =>
  new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
    ...(withDay ? { weekday: "short", day: "numeric", month: "numeric" } : {}),
  }).format(new Date(iso));

function Row({ r, lang }: { r: TimelineRow; lang: Lang }) {
  const t = T[lang];
  if (r.type === "break") {
    return (
      <li className="mp-row mp-break">
        <span className="mp-min">{t[r.label]}</span>
        <span />
        <b className="mp-mid">{r.score}</b>
        <span />
      </li>
    );
  }
  const who = (
    <span className="mp-who">
      <span className="mp-name">
        {r.player}
        {r.kind === "pen-goal" && <small> (P)</small>}
      </span>
      {r.other && <small className="mp-out">{r.other}</small>}
    </span>
  );
  const cell = (
    <span className={`mp-ev ${r.kind}`} title={t[r.kind]}>
      {r.side === "home" ? <>{who}<Icon kind={r.kind} /></> : <><Icon kind={r.kind} />{who}</>}
    </span>
  );
  return (
    <li className={`mp-row ${r.side}${r.kind === "sub" ? " is-sub" : ""}`}>
      <span className="mp-min">{r.min}</span>
      <span className="mp-h">{r.side === "home" && cell}</span>
      <span className="mp-mid">{r.score ?? ""}</span>
      <span className="mp-a">{r.side === "away" && cell}</span>
    </li>
  );
}

function Body({ m, lang }: { m: Match; lang: Lang }) {
  const t = T[lang];
  const { data, error } = useDetail(m);
  // Until the details arrive, the ticker's own data fills the header.
  const d: MatchDetail = data ?? {
    id: m.id, league: m.league, home: { name: m.home }, away: { name: m.away }, hs: m.hs, as: m.as,
    state: m.state, minute: m.minute, kickoff: m.kickoff, timeline: null, stats: [],
  };
  const status =
    d.state === "live" ? (d.minute === "HT" ? t.halftime : d.minute) : d.state === "post" ? t.finished : fmtTime(d.kickoff, lang);
  const statRows = d.stats;
  // Substitutions stay folded so goals and cards are easy to see.
  const [subs, setSubs] = useState(false);
  const subCount = d.timeline?.filter((r) => r.type === "event" && r.kind === "sub").length ?? 0;
  const rows = (d.timeline ?? []).filter((r) => subs || r.type !== "event" || r.kind !== "sub");
  return (
    <>
      <div className="mp-top">
        <LeagueLogo league={d.league} />
        <span className="mp-league">{LEAGUES[d.league].name}</span>
        <span className={`mp-status${d.state === "live" ? " live" : ""}`}>
          {d.state === "live" && <i className="m-dot" />}
          {status}
        </span>
      </div>
      <div className="mp-teams">
        <span className="mp-team">
          <Crest src={d.home.logo} name={d.home.name} />
          <b>{d.home.name}</b>
        </span>
        <span className="mp-score">{d.state === "pre" ? "–" : `${d.hs ?? 0} - ${d.as ?? 0}`}</span>
        <span className="mp-team">
          <Crest src={d.away.logo} name={d.away.name} />
          <b>{d.away.name}</b>
        </span>
      </div>

      {d.state === "pre" ? (
        <dl className="mp-pre">
          <div><dt>{t.kickoff}</dt><dd>{fmtTime(d.kickoff, lang)}</dd></div>
          {d.venue && <div><dt>{t.venue}</dt><dd>{d.venue}</dd></div>}
          <p className="mp-note">{t.notStarted}</p>
        </dl>
      ) : !data && !error ? (
        <div className="mp-skel" aria-hidden="true"><i /><i /><i /><i /></div>
      ) : error && !data ? (
        <p className="mp-note">{t.error}</p>
      ) : d.timeline === null ? (
        <p className="mp-note">{t.noTimeline}{d.venue ? ` · ${d.venue}` : ""}</p>
      ) : d.timeline.length === 0 ? (
        <p className="mp-note">{t.noEvents}</p>
      ) : (
        <>
          <ol className="mp-tl">{rows.map((r, i) => <Row key={i} r={r} lang={lang} />)}</ol>
          {subCount > 0 && (
            <button type="button" className="mp-subs" onClick={() => setSubs((v) => !v)} aria-expanded={subs}>
              <Icon kind="sub" />
              {subs ? t.hideSubs : t.showSubs} ({subCount})
            </button>
          )}
        </>
      )}

      {statRows.length > 0 && (
        <div className="mp-stats">
          {statRows.map((s) => {
            const pct = s.key === "possession";
            const total = s.home + s.away || 1;
            return (
              <div className="mp-stat" key={s.key}>
                <span className="mp-sv">{pct ? `${Math.round(s.home)}%` : s.home}</span>
                <span className="mp-sl">
                  {t[s.key]}
                  <span className="mp-bar"><i style={{ width: `${(s.home / total) * 100}%` }} /></span>
                </span>
                <span className="mp-sv">{pct ? `${100 - Math.round(s.home)}%` : s.away}</span>
              </div>
            );
          })}
        </div>
      )}

      {d.link && (
        <a className="mp-more" href={d.link} target="_blank" rel="noopener noreferrer">
          {t.more} <span aria-hidden="true">↗</span>
          <small>{d.id.startsWith("tsdb") ? "TheSportsDB" : "ESPN"}</small>
        </a>
      )}
    </>
  );
}

// ---- the panel ----
export default function MatchPop(props: PopProps<Match>) {
  const { match, lang } = props;
  return (
    <PopShell {...props} id={match.id} label={`${match.home} – ${match.away}`} closeLabel={T[lang].close}>
      <Body m={match} lang={lang} />
    </PopShell>
  );
}
