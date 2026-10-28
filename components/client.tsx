"use client";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { imgSrc } from "@/lib/img";
import type { Quote } from "@/lib/prices";
import { isVisible, type Match } from "@/lib/scores";
import { isLolVisible, type LolMatch } from "@/lib/lol";
import type { PopProps } from "./PopShell";
import type { Movie, Song } from "@/lib/ent";

export function LangToggle({ lang }: { lang: "vi" | "en" }) {
  const router = useRouter();
  const set = (l: "vi" | "en") => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div className="lang" role="group" aria-label="Language">
      <button className={lang === "vi" ? "on" : ""} onClick={() => set("vi")}>VI</button>
      <button className={lang === "en" ? "on" : ""} onClick={() => set("en")}>EN</button>
    </div>
  );
}

/**
 * Kindle mode switch: a matte black-and-white e-ink look. The choice lives in a cookie so
 * the server renders the right mode on the next visit (no flash); here it flips at once.
 */
export function KindleToggle({ on, lang }: { on: boolean; lang: "vi" | "en" }) {
  const [active, setActive] = useState(on);
  const label = lang === "vi" ? "Chế độ Kindle" : "Kindle mode";
  const flip = () => {
    const next = !active;
    setActive(next);
    document.documentElement.classList.toggle("kindle", next);
    document.cookie = `mode=${next ? "kindle" : "normal"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button className={`kindle-toggle${active ? " on" : ""}`} onClick={flip} aria-pressed={active} aria-label={label} title={label}>
      {/* An e-reader: a page with lines of text */}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
        <path d="M8.5 7h7M8.5 10.5h7M8.5 14h4.5" />
      </svg>
    </button>
  );
}

/**
 * Film grain over the page (after React Bits' Noise): random grey pixels redrawn about
 * ten times a second on a half-resolution canvas, shown at low opacity by CSS. A still
 * frame on touch devices and with reduced motion; paused while the tab is hidden.
 */
export function Grain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const TILE = 128;
    const tile = document.createElement("canvas");
    tile.width = tile.height = TILE;
    const tctx = tile.getContext("2d")!;
    const img = tctx.createImageData(TILE, TILE);
    const draw = () => {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      tctx.putImageData(img, 0, 0);
      ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    const size = () => {
      // Half resolution: each grain covers about 2x2 screen pixels.
      canvas.width = Math.ceil(innerWidth / 2);
      canvas.height = Math.ceil(innerHeight / 2);
      draw();
    };
    size();
    addEventListener("resize", size);
    const still = matchMedia("(prefers-reduced-motion: reduce), (hover: none)").matches;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!still && !timer) timer = setInterval(draw, 100); };
    const stop = () => { clearInterval(timer); timer = undefined; };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <canvas ref={ref} className="grain" aria-hidden="true" />;
}

const TICKER_NAMES: Record<string, { vi: string; en: string }> = {
  XAU: { vi: "Vàng", en: "Gold" },
  XAG: { vi: "Bạc", en: "Silver" },
};

/**
 * Fades and blurs a ticker row out over the first 70px of scroll. CSS does it with a
 * scroll-driven animation where supported; this rAF fallback covers the other browsers.
 */
function useTickerFade(row: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    const el = row.current;
    if (!active || !el || CSS.supports("animation-timeline: scroll()")) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const update = () => {
      frame = 0;
      const k = Math.min(1, scrollY / 70);
      el.style.opacity = String(still ? (k < 1 ? 1 : 0) : 1 - k);
      el.style.filter = still ? "" : `blur(${(k * 6).toFixed(1)}px)`;
      el.style.transform = still ? "" : `translateY(${(-k * 8).toFixed(1)}px)`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [row, active]);
}

/** Constant scroll speed whatever the number of items: about 40px per second. */
function useTickerSpeed(track: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useEffect(() => {
    const el = track.current;
    if (el) el.style.setProperty("--ticker-time", `${Math.max(20, el.scrollWidth / 2 / 40)}s`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Pages with the price ticker: home, Finance and Crypto. Elsewhere it would distract. */
const TICKER_PAGES = new Set(["/", "/c/tai-chinh", "/c/crypto"]);

/**
 * Price ticker under the menu: BTC, ETH, gold, altcoins. Starts from the prices the server
 * rendered, refreshes every minute without restarting the scroll, and hides itself when
 * there is nothing to show. The list is doubled so the loop is seamless.
 */
export function PriceTicker({ initial, lang }: { initial: Quote[]; lang: "vi" | "en" }) {
  const show = TICKER_PAGES.has(usePathname());
  const [quotes, setQuotes] = useState(initial);
  const [fresh, setFresh] = useState(initial.length > 0);
  const track = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show) return; // no requests on pages without the ticker
    let stop = false;
    const load = () =>
      fetch("/api/prices")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!stop && d?.quotes?.length) { setQuotes(d.quotes); setFresh(true); } })
        .catch(() => {});
    if (!fresh) load();
    const t = setInterval(load, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, [show, fresh]);
  useTickerSpeed(track, [quotes.length, show]);
  useTickerFade(row, show);
  if (!show || !quotes.length) return null;

  const loc = lang === "vi" ? "vi-VN" : "en-US";
  const fmt = (q: Quote) => {
    if (q.cur === "VND") return new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(q.price) + " ₫";
    const digits = q.price >= 1000 ? 0 : q.price >= 1 ? 2 : 4;
    return "$" + new Intl.NumberFormat(loc, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(q.price);
  };
  const item = (q: Quote, k: string) => {
    const up = (q.change ?? 0) >= 0;
    return (
      <span className="tick" key={k}>
        <b>{TICKER_NAMES[q.sym]?.[lang] ?? q.sym}</b>
        <span className="tick-price">{fmt(q)}</span>
        {q.change !== undefined && (
          <span className={`tick-chg ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"} {new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(Math.abs(q.change))}%
          </span>
        )}
      </span>
    );
  };
  return (
    <div className="ticker" ref={row} role="region" aria-label={lang === "vi" ? "Giá thị trường" : "Market prices"}>
      <div className="ticker-scroll">
        <div className="ticker-track" ref={track} aria-hidden="true">
          <div className="ticker-group">{quotes.map((q) => item(q, `a${q.sym}`))}</div>
          <div className="ticker-group">{quotes.map((q) => item(q, `b${q.sym}`))}</div>
        </div>
      </div>
    </div>
  );
}

/** League logos (40px files in public/leagues; "-dark" versions for dark backgrounds). */
export const LEAGUES: Record<Match["league"], { name: string; file: string; dark?: boolean }> = {
  C1: { name: "UEFA Champions League", file: "c1", dark: true },
  C2: { name: "UEFA Europa League", file: "c2", dark: true },
  EPL: { name: "Premier League", file: "epl", dark: true },
  LALIGA: { name: "La Liga", file: "laliga" },
  SERIEA: { name: "Serie A", file: "seriea" },
  VLEAGUE: { name: "V.League 1", file: "vleague" },
};

/** Small league logo, fixed size so nothing shifts while it loads. */
export function LeagueLogo({ league }: { league: Match["league"] }) {
  const l = LEAGUES[league];
  return (
    <span className="m-lg" title={l.name}>
      <img className={l.dark ? "lg-light" : undefined} src={`/leagues/${l.file}.png`} width={18} height={18} alt={l.name} decoding="async" />
      {l.dark && <img className="lg-dark" src={`/leagues/${l.file}-dark.png`} width={18} height={18} alt="" aria-hidden="true" decoding="async" />}
    </span>
  );
}

// Ticker popups are separate chunks, fetched only on their page.
const MatchPop = lazy(() => import("./MatchPop"));
const LolPop = lazy(() => import("./LolPop"));

const SPEED = 40; // px per second
const HOLD = 2000; // ms of stillness after a drag before the row moves again

type TickerConfig<T> = {
  lang: "vi" | "en";
  path: string; // the one page that shows this ticker
  api: string; // polled every 30 seconds; answers { matches: T[] }
  ariaLabel: string;
  keep: (m: T) => boolean; // still worth showing (drops results older than 24h)
  item: (m: T) => React.ReactNode; // inside of one item
  pin: (m: T) => React.ReactNode; // inside of the pinned live item
  label: (m: T) => string;
  isLive: (m: T) => boolean;
  Pop: React.ComponentType<PopProps<T>>;
  load: () => Promise<{ prefetch: (m: T) => void }>; // the popup module
  clickOnly?: boolean; // open on click/tap only; close with ×, Escape or a press outside (not on mouse leave)
};

/**
 * Live results ticker under the menu (football on Sports, LoL on E-sport). Live first, then
 * results, then upcoming; a live match of a followed team is pinned on the left.
 *
 * The row moves by script (one position shared by auto-scroll and dragging): it can be
 * grabbed and thrown left or right with a little momentum, and waits 2 seconds before
 * moving on. Hovering a match (desktop) or tapping it opens its details panel.
 */
function LiveTicker<T extends { id: string; pinned?: boolean }>(cfg: TickerConfig<T>) {
  const { lang } = cfg;
  const show = usePathname() === cfg.path;
  const [matches, setMatches] = useState<T[] | null>(null); // null while loading
  const track = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const conf = useRef(cfg);
  conf.current = cfg;
  useEffect(() => {
    if (!show) return;
    let stop = false;
    const load = () =>
      fetch(conf.current.api)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { if (!stop) setMatches(Array.isArray(d?.matches) ? d.matches.filter((m: T) => conf.current.keep(m)) : []); })
        .catch(() => { if (!stop) setMatches((m) => m ?? []); });
    load();
    const t = setInterval(load, 30_000);
    // Fetch the popup code while the browser is idle, so the first hover opens at once.
    const idle = setTimeout(() => conf.current.load().catch(() => {}), 1500);
    return () => { stop = true; clearInterval(t); clearTimeout(idle); };
  }, [show]);
  const list = (matches ?? []).filter((m) => !m.pinned);
  const byId = useRef(new Map<string, T>());
  byId.current = new Map((matches ?? []).map((m) => [m.id, m]));
  useTickerFade(row, show);

  // ---- popup state ----
  const [pop, setPop] = useState<{ m: T; el: HTMLElement; below: number; closing: boolean } | null>(null);
  const popRef = useRef(pop);
  popRef.current = pop;
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openAt = useCallback((el: HTMLElement) => {
    const m = byId.current.get(el.dataset.mid ?? "");
    if (!m || !row.current) return;
    clearTimeout(closeTimer.current);
    setPop({ m, el, below: row.current.getBoundingClientRect().bottom, closing: false });
  }, []);
  const close = useCallback((delay = 0) => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    const go = () => setPop((p) => (p && !p.closing ? { ...p, closing: true } : p));
    if (delay) closeTimer.current = setTimeout(go, delay);
    else go();
  }, []);
  const gone = useCallback(() => setPop((p) => (p?.closing ? null : p)), []);
  const prefetch = (el: HTMLElement) => {
    const m = byId.current.get(el.dataset.mid ?? "");
    if (m) conf.current.load().then((x) => x.prefetch(m)).catch(() => {});
  };

  // Close on Escape, a press outside, page scroll or a resize.
  useEffect(() => {
    if (!pop || pop.closing) return;
    const y0 = scrollY;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.(".mp-wrap, [data-mid]")) return;
      close();
    };
    const onScroll = () => Math.abs(scrollY - y0) > 8 && close();
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onDown, true);
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("pointerdown", onDown, true);
      removeEventListener("scroll", onScroll);
    };
  }, [pop, close]);

  // ---- motion: auto-scroll, drag and momentum share one offset ----
  const motion = useRef({ x: 0, v: 0, run: 0, hover: false, holdUntil: 0, suppress: false,
    drag: null as null | { id: number; x0: number; start: number; moved: boolean; lastX: number; lastT: number } });
  useEffect(() => {
    const el = track.current;
    if (!show || !el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(t) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = motion.current;
      if (!s.drag) {
        if (Math.abs(s.v) > 8) {
          // Thrown: glide and slow down.
          s.x += s.v * dt;
          s.v *= Math.pow(0.03, dt);
          s.holdUntil = t + HOLD;
        } else {
          s.v = 0;
          const go = !still && !s.hover && !popRef.current && t > s.holdUntil ? 1 : 0;
          s.run += (go - s.run) * Math.min(1, dt * (go ? 2.5 : 7)); // ease in slowly, stop quickly
          if (Math.abs(go - s.run) < 0.01) s.run = go;
          s.x -= SPEED * s.run * dt;
        }
      }
      const half = el.scrollWidth / 2;
      if (half > 0) s.x = ((s.x % half) - half) % half; // seamless loop: always in (-half, 0]
      el.style.transform = `translate3d(${s.x.toFixed(2)}px,0,0)`;
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [show, list.length]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button > 0) return;
    const s = motion.current;
    s.v = 0;
    s.drag = { id: e.pointerId, x0: e.clientX, start: s.x, moved: false, lastX: e.clientX, lastT: e.timeStamp };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = motion.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      scroller.current?.setPointerCapture(e.pointerId);
      scroller.current?.classList.add("dragging");
      clearTimeout(openTimer.current);
      if (popRef.current) close();
    }
    if (!d.moved) return;
    s.x = d.start + dx;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) s.v = 0.7 * (((e.clientX - d.lastX) / dt) * 1000) + 0.3 * s.v;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  };
  const endDrag = (e: React.PointerEvent, cancel = false) => {
    const s = motion.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    s.drag = null;
    if (!d.moved) return;
    scroller.current?.classList.remove("dragging");
    // A drag is not a click; a pause before letting go means no throw.
    s.suppress = true;
    setTimeout(() => (s.suppress = false), 0);
    if (cancel || e.timeStamp - d.lastT > 90) s.v = 0;
    s.v = Math.max(-2500, Math.min(2500, s.v));
    s.holdUntil = performance.now() + HOLD;
  };

  // Hover intent (mouse only): 150ms on a match opens it; moving to a neighbour while
  // the panel is open switches it quickly. Leaving closes after a short delay.
  const onOver = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || motion.current.drag?.moved) return;
    const el = (e.target as Element).closest<HTMLElement>("[data-mid]");
    if (!el) return;
    clearTimeout(closeTimer.current);
    if (popRef.current?.el === el && !popRef.current.closing) return;
    prefetch(el);
    if (conf.current.clickOnly) return; // hovering only warms the data
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => openAt(el), popRef.current && !popRef.current.closing ? 70 : 150);
  };
  const onOut = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || conf.current.clickOnly) return;
    const from = (e.target as Element).closest("[data-mid]");
    const to = (e.relatedTarget as Element | null)?.closest?.("[data-mid], .mp-wrap");
    if (from && !to) {
      clearTimeout(openTimer.current);
      if (popRef.current) close(220);
    }
  };
  const onClick = (e: React.MouseEvent) => {
    if (motion.current.suppress) { e.preventDefault(); e.stopPropagation(); return; }
    const el = (e.target as Element).closest<HTMLElement>("[data-mid]");
    if (!el) return;
    clearTimeout(openTimer.current);
    const p = popRef.current;
    const mouse = (e.nativeEvent as PointerEvent).pointerType === "mouse";
    // A tap on the open match closes it; a mouse click keeps it open.
    if (p && p.el === el && !p.closing) { if (!mouse) close(); return; }
    openAt(el);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const el = (e.target as Element).closest<HTMLElement>("[data-mid]");
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openAt(el); }
  };

  // While loading the row keeps its height so the page does not jump; with no data it hides.
  if (!show || (matches && !matches.length)) return null;

  const pinned = (matches ?? []).find((m) => m.pinned);
  const active = pop && !pop.closing ? pop.el : null;
  const Pop = cfg.Pop;
  const item = (m: T, k: string, copy: boolean) => (
    <span
      className={`tick match${cfg.isLive(m) ? " is-live" : ""}`}
      key={k}
      data-mid={m.id}
      role="button"
      tabIndex={copy ? -1 : 0}
      aria-label={cfg.label(m)}
      aria-expanded={active?.dataset.mid === m.id ? true : undefined}
    >
      {cfg.item(m)}
    </span>
  );
  return (
    <div
      className={`ticker scores${pop && !pop.closing ? " has-pop" : ""}`}
      ref={row}
      role="region"
      aria-label={cfg.ariaLabel}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onPointerEnter={(e) => e.pointerType === "mouse" && (motion.current.hover = true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && (motion.current.hover = false)}
      onClickCapture={onClick}
      onKeyDown={onKeyDown}
    >
      {pinned && (
        <div className="pin" data-mid={pinned.id} role="button" tabIndex={0} title={cfg.label(pinned)}>
          <span className="live-badge">LIVE</span>
          {cfg.pin(pinned)}
        </div>
      )}
      <div
        className="ticker-scroll"
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerCancel={(e) => endDrag(e, true)}
        onDragStart={(e) => e.preventDefault()}
      >
        {list.length > 0 && (
          <div className="ticker-track js" ref={track}>
            <div className="ticker-group">{list.map((m) => item(m, `a${m.id}`, false))}</div>
            <div className="ticker-group" aria-hidden="true">{list.map((m) => item(m, `b${m.id}`, true))}</div>
          </div>
        )}
      </div>
      {pop && (
        <Suspense fallback={null}>
          <Pop
            match={byId.current.get(pop.m.id) ?? pop.m}
            anchor={pop.el}
            below={pop.below}
            lang={lang}
            closing={pop.closing}
            onEnter={() => clearTimeout(closeTimer.current)}
            onLeave={(e) => {
              if (e.pointerType !== "mouse" || cfg.clickOnly) return;
              const to = (e.relatedTarget as Element | null)?.closest?.("[data-mid]");
              if (!to) close(220);
            }}
            onClose={() => close()}
            onGone={gone}
          />
        </Suspense>
      )}
    </div>
  );
}

/** Kick-off time in Vietnam; "Mai 02:00" for tomorrow. */
function tickTime(iso: string, vi: boolean) {
  const d = new Date(iso);
  const hm = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(d);
  const day = (t: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(t);
  const tomorrow = day(d) === day(new Date(Date.now() + 86_400_000));
  return tomorrow ? `${vi ? "Mai" : "Tmrw"} ${hm}` : hm;
}

/**
 * Results ticker on the Sports page: UCL, UEL, Premier League, La Liga, Serie A and
 * V-League, from yesterday to tomorrow. A live Real Madrid or AC Milan match is pinned.
 */
export function ScoreTicker({ lang }: { lang: "vi" | "en" }) {
  const vi = lang === "vi";
  const score = (m: Match) => (m.state === "pre" ? "–" : `${m.hs}–${m.as}`);
  return (
    <LiveTicker<Match>
      lang={lang}
      path="/c/the-thao"
      api="/api/scores"
      ariaLabel={vi ? "Kết quả bóng đá" : "Football scores"}
      keep={(m) => isVisible(m)}
      isLive={(m) => m.state === "live"}
      label={(m) => `${m.home} ${score(m)} ${m.away}`}
      Pop={MatchPop}
      load={() => import("./MatchPop").then((x) => ({ prefetch: x.prefetchMatch }))}
      item={(m) => (
        <>
          <LeagueLogo league={m.league} />
          <span className="m-tm">{m.home}</span>
          <b className="m-sc">{score(m)}</b>
          <span className="m-tm">{m.away}</span>
          {m.state === "live" ? (
            <span className="m-st live"><i className="m-dot" />{m.minute}</span>
          ) : (
            <span className="m-st">{m.state === "post" ? "FT" : tickTime(m.kickoff, vi)}</span>
          )}
        </>
      )}
      pin={(m) => (
        <>
          <LeagueLogo league={m.league} />
          <span className="pin-tm">{m.homeAbbr || m.home}</span>
          <b className="m-sc">{m.hs}–{m.as}</b>
          <span className="pin-tm">{m.awayAbbr || m.away}</span>
          <span className="m-st live">{m.minute}</span>
        </>
      )}
    />
  );
}

/** LoL league badge: the league's own logo on a dark tile (most are made for dark backgrounds). */
export const LOL_LOGOS: Record<LolMatch["league"], { name: string; src: string }> = {
  first_stand: { name: "First Stand", src: "https://static.lolesports.com/leagues/1740042025201_RG_LOL_FIRST_STAND_LOGO_VOLT_ALPHA.png" },
  lck: { name: "LCK", src: "https://static.lolesports.com/leagues/lck-color-on-black.png" },
  lcp: { name: "LCP", src: "https://static.lolesports.com/leagues/1733468139601_lcp-color-golden.png" },
  lpl: { name: "LPL", src: "https://static.lolesports.com/leagues/1592516115322_LPL-01-FullonDark.png" },
  msi: { name: "MSI", src: "https://static.lolesports.com/leagues/1592594634248_MSIDarkBG.png" },
  worlds: { name: "Worlds", src: "https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png" },
};
export function LolBadge({ src, name, size = 18 }: { src?: string; name: string; size?: number }) {
  const [ok, setOk] = useState(true);
  return (
    <span className="lol-tile" style={{ width: size, height: size }} title={name}>
      {src && ok ? <img src={src} width={size - 4} height={size - 4} alt="" decoding="async" onError={() => setOk(false)} /> : <i>{name.slice(0, 1)}</i>}
    </span>
  );
}

/**
 * LoL Esports ticker on the E-sport page: First Stand, LCK, LCP, LPL, MSI and Worlds. Series
 * score (games won), best-of, live / FT / start time. A live T1 match is pinned.
 */
export function LolTicker({ lang }: { lang: "vi" | "en" }) {
  const vi = lang === "vi";
  const score = (m: LolMatch) => (m.state === "pre" ? "–" : `${m.teams[0].wins}–${m.teams[1].wins}`);
  const team = (t: LolMatch["teams"][number], win: boolean) => (
    <span className={`lol-tm${win ? " win" : ""}`}>
      <LolBadge src={t.image} name={t.name} />
      {t.code}
    </span>
  );
  return (
    <LiveTicker<LolMatch>
      lang={lang}
      path="/c/esport"
      api="/api/lol"
      ariaLabel={vi ? "Lịch thi đấu và kết quả LMHT" : "League of Legends esports"}
      keep={(m) => isLolVisible(m)}
      isLive={(m) => m.state === "live"}
      label={(m) => `${LOL_LOGOS[m.league].name}: ${m.teams[0].code} ${score(m)} ${m.teams[1].code} (Bo${m.bestOf})`}
      Pop={LolPop}
      load={() => import("./LolPop").then((x) => ({ prefetch: x.prefetchLol }))}
      item={(m) => (
        <>
          <LolBadge src={LOL_LOGOS[m.league].src} name={LOL_LOGOS[m.league].name} />
          {team(m.teams[0], m.teams[0].outcome === "win")}
          <b className="m-sc">{score(m)}</b>
          {team(m.teams[1], m.teams[1].outcome === "win")}
          {m.state === "live" ? (
            <span className="m-st live"><i className="m-dot" />LIVE</span>
          ) : (
            <span className="m-st">{m.state === "post" ? "FT" : tickTime(m.start, vi)}</span>
          )}
          <span className="lol-bo">Bo{m.bestOf}</span>
        </>
      )}
      pin={(m) => (
        <>
          <LolBadge src={LOL_LOGOS[m.league].src} name={LOL_LOGOS[m.league].name} />
          <span className="pin-tm">{m.teams[0].code}</span>
          <b className="m-sc">{m.teams[0].wins}–{m.teams[1].wins}</b>
          <span className="pin-tm">{m.teams[1].code}</span>
          <span className="m-st live">G{Math.min(m.bestOf, m.teams[0].wins + m.teams[1].wins + 1)}</span>
        </>
      )}
    />
  );
}

const SongPop = lazy(() => import("./SongPop"));
const MoviePop = lazy(() => import("./MoviePop"));
type MovieItem = Movie & { id: string };

/**
 * Hot songs on the Showbiz page: the top of Spotify's daily charts for Vietnam and the
 * world, alternating. Click or tap a song for its music video and listening links (no
 * hover: the panel stays until ×, Escape or a press outside).
 */
export function SongTicker({ lang }: { lang: "vi" | "en" }) {
  const vi = lang === "vi";
  return (
    <LiveTicker<Song>
      lang={lang}
      path="/c/showbiz"
      api="/api/songs"
      clickOnly
      ariaLabel={vi ? "Bài hát đang hot" : "Hot songs"}
      keep={() => true}
      isLive={() => false}
      label={(s) => `#${s.rank} ${s.chart === "vn" ? "VN" : vi ? "Thế giới" : "Global"}: ${s.artist} – ${s.title}`}
      Pop={SongPop}
      load={() => import("./SongPop").then((x) => ({ prefetch: x.prefetchSong }))}
      item={(s) => (
        <>
          <span className={`song-rank ${s.chart}`}>#{s.rank}<small>{s.chart === "vn" ? "VN" : "🌐"}</small></span>
          {s.cover ? <img className="song-art" src={s.cover} width={22} height={22} alt="" decoding="async" /> : <span className="song-art" aria-hidden="true" />}
          <b className="song-title">{s.title}</b>
          <span className="song-artist">{s.artist}</span>
        </>
      )}
      pin={() => null}
    />
  );
}

/**
 * Films opening in Vietnamese cinemas this month, on the Film page. Hover or tap a film
 * for its trailer and details.
 */
export function MovieTicker({ lang }: { lang: "vi" | "en" }) {
  const vi = lang === "vi";
  const day = (iso: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
  const out = (iso: string) => Date.parse(iso) <= Date.now();
  return (
    <LiveTicker<MovieItem>
      lang={lang}
      path="/c/phim-anh"
      api="/api/movies"
      ariaLabel={vi ? "Phim ra rạp tháng này" : "In cinemas this month"}
      keep={() => true}
      isLive={() => false}
      label={(m) => `${m.title}, ${vi ? "khởi chiếu" : "release"} ${day(m.release)}`}
      Pop={MoviePop}
      load={() => import("./MoviePop").then((x) => ({ prefetch: x.prefetchMovie }))}
      item={(m) => (
        <>
          {m.poster ? <img className="mv-poster" src={m.poster} width={20} height={30} alt="" decoding="async" /> : <span className="mv-poster" aria-hidden="true" />}
          <b className="mv-name">{m.title}</b>
          <span className={`m-st${out(m.release) ? "" : " soon"}`}>{out(m.release) ? (vi ? "Đang chiếu" : "Showing") : day(m.release)}</span>
        </>
      )}
      pin={() => null}
    />
  );
}

/**
 * Loads article pages before they are opened, so they appear at once:
 * - cards that come into view (a few per page, when the browser is idle),
 * - a card under the mouse for 60ms (desktop), or the moment it is touched (phones).
 * A full prefetch also has the server prepare the article (text and translation).
 * On Save-Data or 2G connections only the hover/touch prefetch runs.
 */
export function CardPrefetch() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const conn = (navigator as any).connection;
    const frugal = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "");
    const MAX_VIEWPORT = 10; // per page, so a long list doesn't fetch everything
    const done = new Set<string>();
    let viewportCount = 0;
    const prefetch = (link: HTMLAnchorElement) => {
      const href = link.getAttribute("href");
      if (!href || done.has(href) || href === location.pathname) return;
      done.add(href);
      router.prefetch(href, { kind: "full" } as any);
      // Warm the picture too (low priority; the browser reuses it for the hero).
      const src = link.querySelector("img")?.getAttribute("src");
      if (src) Object.assign(new Image(), { fetchPriority: "low", src });
    };
    const cards = () => Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/a/"]'));

    // Cards in view, one at a time when the browser is idle.
    const idle = (cb: () => void) => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 300));
    const pending: HTMLAnchorElement[] = [];
    let draining = false;
    const drain = () => {
      if (draining) return;
      draining = true;
      const next = () => {
        const link = pending.shift();
        if (!link || viewportCount >= MAX_VIEWPORT) { draining = false; return; }
        if (!done.has(link.getAttribute("href") ?? "")) { viewportCount++; prefetch(link); }
        idle(next);
      };
      idle(next);
    };
    const io = frugal
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              io!.unobserve(e.target);
              pending.push(e.target as HTMLAnchorElement);
            }
            drain();
          },
          { threshold: 0.6 }
        );
    // Wait a moment so the page's own requests go first.
    const start = setTimeout(() => cards().forEach((c) => io?.observe(c)), 800);

    // Intent: hover (mouse) or touch.
    let hover: ReturnType<typeof setTimeout> | undefined;
    const linkOf = (e: Event) => (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="/a/"]');
    const onOver = (e: PointerEvent) => {
      const link = linkOf(e);
      if (!link) return;
      clearTimeout(hover);
      if (e.pointerType === "mouse") hover = setTimeout(() => prefetch(link), 60);
      else prefetch(link);
    };
    const onDown = (e: Event) => { const link = linkOf(e); if (link) prefetch(link); };
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      clearTimeout(start);
      clearTimeout(hover);
      io?.disconnect();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [router, pathname]);
  return null;
}

/** Re-renders the page every 10 minutes so new stories appear without a reload. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function Thumb({
  src,
  alt,
  color,
  label,
  priority = false,
  srcSet,
  sizes,
}: {
  src?: string;
  alt: string;
  color: string;
  label: string;
  priority?: boolean;
  srcSet?: string;
  sizes?: string;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // The image may have loaded or failed before React attached its handlers.
    const img = ref.current;
    if (img?.complete) img.naturalWidth === 0 ? setBroken(true) : setLoaded(true);
  }, [src]);
  if (!src || broken) {
    return (
      <div className="thumb ph" style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}>
        <span style={{ color }}>{label}</span>
      </div>
    );
  }
  return (
    <div className="thumb" style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}>
      <img
        ref={ref}
        src={imgSrc(src)}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        // The hero shows at once; lazy images fade in when they arrive.
        className={priority ? undefined : `fade${loaded ? " in" : ""}`}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
      />
    </div>
  );
}

/**
 * Shown when a page rendered before its translations were ready: refreshes once a few
 * seconds later, when the background translation has filled the cache. At most twice per page.
 */
export function RefreshSoon({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const key = `refresh:${location.pathname}${location.search}`;
    let tries = 0;
    try {
      tries = Number(sessionStorage.getItem(key) ?? 0);
    } catch {}
    if (tries >= 2) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(key, String(tries + 1));
      } catch {}
      router.refresh();
    }, ms);
    return () => clearTimeout(t);
  }, [router, ms]);
  return null;
}

type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

/**
 * Resolves once test() is true, or after maxMs. Polls with setTimeout: the browser pauses
 * requestAnimationFrame while a view transition waits for the new page.
 */
function waitFor(test: () => boolean, maxMs = 700) {
  const start = performance.now();
  return new Promise<void>((done) => {
    const check = () => (test() || performance.now() - start > maxMs ? done() : setTimeout(check, 16));
    check();
  });
}

/**
 * Card → article transition with the View Transitions API. The list fades away while the
 * clicked card's title moves and grows into the article headline; then the article body
 * fades up. Going back reverses it: the headline shrinks into its card and the list returns.
 * Browsers without the API, modified clicks and reduced motion get a normal navigation.
 */
export function CardTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const target = useRef<string | null>(null);
  // "vt-arrived" swaps the page's own entrance animation for the article body stagger.
  // It goes away on the next navigation that isn't a card transition.
  useEffect(() => {
    if (pathname !== target.current) document.documentElement.classList.remove("vt-arrived");
    target.current = null;
  }, [pathname]);

  useEffect(() => {
    const doc = document as VTDocument;
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let last: { list: string; article: string } | null = null;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a.cover[href^='/a/']");
      if (!link || link.target) return;
      const href = link.getAttribute("href")!;
      if (href === location.pathname) return;
      const title = link.querySelector<HTMLElement>("h3");
      if (!title) return;
      e.preventDefault();
      // Exactly one element may carry the name: the clicked card's title, not the current headline.
      document.querySelector<HTMLElement>(".detail h1")?.style.setProperty("view-transition-name", "none");
      title.style.viewTransitionName = "vt-title";
      last = { list: location.pathname + location.search, article: href };
      target.current = href;
      root.classList.add("vt-arrived");
      root.classList.remove("vt-back");
      doc.startViewTransition!(async () => {
        title.style.viewTransitionName = "";
        router.push(href);
        // The page is frozen while a view transition waits, so wait only briefly: if the
        // article is slow, the transition ends on its loading skeleton instead.
        await waitFor(() => location.pathname === href && !!document.querySelector(".detail h1"), 380);
      });
    };

    // Back from the article to the list it was opened from: the headline shrinks into its card.
    // Next redraws the list before a view transition could capture the article, so this
    // direction is a hand-made FLIP: a copy of the headline flies to the card title.
    type NavEvent = Event & { navigationType: string; destination: { url: string } };
    const nav = (window as any).navigation as EventTarget | undefined;
    const onNavigate = (ev: Event) => {
      const e = ev as NavEvent;
      if (!last || e.navigationType !== "traverse" || location.pathname !== last.article) return;
      const dest = new URL(e.destination.url);
      if (dest.pathname + dest.search !== last.list) return;
      const { article } = last;
      last = null;
      const h1 = document.querySelector<HTMLElement>(".detail h1");
      if (!h1) return;
      const from = h1.getBoundingClientRect();
      const cs = getComputedStyle(h1);
      const ghost = h1.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("class");
      Object.assign(ghost.style, {
        position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, margin: "0",
        font: cs.font, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, color: cs.color,
        transformOrigin: "0 0", zIndex: "100", pointerEvents: "none", viewTransitionName: "none",
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(ghost);
      root.classList.add("vt-back");
      const sel = `a.cover[href='${article}'] h3`;
      void waitFor(() => location.pathname !== article && !!document.querySelector(sel), 800).then(async () => {
        await new Promise((r) => setTimeout(r, 30)); // let Next restore the scroll position
        const card = document.querySelector<HTMLElement>(sel);
        const to = card?.getBoundingClientRect();
        if (!card || !to || to.bottom < 0 || to.top > innerHeight) {
          ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.finally(() => ghost.remove());
          root.classList.remove("vt-back");
          return;
        }
        card.style.opacity = "0";
        const s = to.width / from.width;
        const move = ghost.animate(
          [{ transform: "none" }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${s})` }],
          { duration: 550, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" }
        );
        await move.finished.catch(() => {});
        card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }).finished.finally(() => card.style.removeProperty("opacity"));
        ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).finished.finally(() => ghost.remove());
        root.classList.remove("vt-back");
      });
    };

    // Capture phase: runs before Next's <Link>, which then skips the click (defaultPrevented).
    document.addEventListener("click", onClick, true);
    nav?.addEventListener("navigate", onNavigate);
    return () => {
      document.removeEventListener("click", onClick, true);
      nav?.removeEventListener("navigate", onNavigate);
    };
  }, [router]);
  return null;
}

/**
 * Cursor spotlight on cards (after React Bits' SpotlightCard). One listener for the whole
 * page sets the pointer position on the hovered card; the glow itself is pure CSS.
 */
export function Spotlight() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const card = (e.target as Element | null)?.closest?.<HTMLElement>(".card:not(.compact)");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
    };
  }, []);
  return null;
}

/** An image from the original article; hides itself if it fails to load. */
export function ProseImage({ src, caption, drawing = false }: { src: string; caption?: string; drawing?: boolean }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, [src]);
  if (broken) return null;
  return (
    <figure className={`prose-img${drawing ? " drawing" : ""}`}>
      <img ref={ref} src={imgSrc(src)} alt={caption ?? ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Plays an HLS stream (.m3u8): natively in Safari, with hls.js elsewhere. */
export function HlsVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    let hls: import("hls.js").default | undefined;
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);
  return <video ref={ref} poster={poster} controls preload="none" playsInline />;
}


// The category of the article being read, so the menu can highlight it on /a/ pages.
let articleCat: string | null = null;
const catSubs = new Set<() => void>();
const setArticleCat = (v: string | null) => { articleCat = v; catSubs.forEach((f) => f()); };

/** Rendered by the article page: tells the menu which category to highlight. */
export function ActiveCategory({ slug }: { slug: string }) {
  useEffect(() => {
    setArticleCat(slug);
    return () => setArticleCat(null);
  }, [slug]);
  return null;
}

/**
 * Category menu. It lives in the root layout, so it stays put between pages (no jump back
 * to the start of the row). A tapped tab turns active at once, before the page arrives,
 * and the row glides to keep the active tab in view.
 */
export function CatNav({ items }: { items: { href: string; slug: string; label: string; color?: string; className?: string }[] }) {
  const pathname = usePathname();
  const art = useSyncExternalStore(
    (f) => { catSubs.add(f); return () => { catSubs.delete(f); }; },
    () => articleCat,
    () => null
  );
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [pathname]);
  const current = pathname === "/" ? "" : pathname.startsWith("/c/") ? pathname.split("/")[2] : art;
  const active = tapped ?? current;

  const row = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = row.current;
    const on = el?.querySelector<HTMLElement>("a.on");
    if (!el || !on) return;
    const left = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
    el.scrollTo({ left, behavior: first.current ? ("instant" as ScrollBehavior) : "smooth" });
    first.current = false;
  }, [active]);

  return (
    <nav className="cats">
      <div className="wrap row" ref={row}>
        {items.map((c) => (
          <Link
            key={c.slug}
            href={c.href}
            className={[active === c.slug ? "on" : "", c.className ?? ""].join(" ").trim() || undefined}
            style={c.color ? { ["--c" as any]: c.color } : undefined}
            onClick={() => setTapped(c.slug)}
          >
            {c.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * Thin bar at the top that starts the moment a link is tapped and completes when the new
 * page shows, so every tap gets visible feedback even when the page takes a moment.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
      if (!a || a.target || a.origin !== location.origin) return;
      if (a.pathname + a.search === location.pathname + location.search) return;
      setState("busy");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The URL changes as soon as the loading skeleton shows; finish once the skeleton is gone.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const check = () => {
      if (document.querySelector("main .sk")) { t = setTimeout(check, 100); return; }
      setState((s) => (s === "busy" ? "done" : s));
      t = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 400);
    };
    check();
    return () => clearTimeout(t);
  }, [pathname, search]);

  // Safety net: never leave the bar running (e.g. a navigation that was cancelled).
  useEffect(() => {
    if (state !== "busy") return;
    const t = setTimeout(() => setState("idle"), 10000);
    return () => clearTimeout(t);
  }, [state]);

  return <div className={`navbar ${state}`} aria-hidden="true" />;
}
