"use client";
import { useEffect, useRef, useState } from "react";
import type { ExId, LiqPanel } from "@/lib/liq";
import { LiqViews } from "./LiqViews";

/**
 * A BTC or ETH liquidation card with an exchange picker (OKX, HTX, Gate, all of them). The
 * choice is remembered for this browser and shared by both cards; other exchanges load
 * from /api/liq when picked.
 */
const KEY = "liqEx";
const NAMES: Record<ExId, { vi: string; en: string }> = {
  okx: { vi: "OKX", en: "OKX" },
  htx: { vi: "HTX", en: "HTX" },
  gate: { vi: "Gate", en: "Gate" },
  all: { vi: "Tất cả sàn", en: "All exchanges" },
};
const NOTES: Record<ExId, { vi: string; en: string }> = {
  okx: { vi: "Từng lệnh thanh lý", en: "Every liquidation order" },
  htx: { vi: "Từng lệnh thanh lý", en: "Every liquidation order" },
  gate: { vi: "Tổng mỗi 15 phút", en: "15-minute totals" },
  all: { vi: "Cộng các sàn trên", en: "The exchanges above added up" },
};

const usd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
const px = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 3 : 0 }));
const stored = (): ExId | null => {
  try {
    return localStorage.getItem(KEY) as ExId | null;
  } catch {
    return null;
  }
};

export function LiqCard({ initial, available, lang }: { initial: LiqPanel; available: ExId[]; lang: "vi" | "en" }) {
  const vi = lang === "vi";
  const [p, setP] = useState(initial);
  const [ex, setEx] = useState<ExId>(initial.ex);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // The remembered exchange (if it works here), and changes made on the other card.
  useEffect(() => {
    const pick = () => {
      const s = stored();
      if (s && available.includes(s)) setEx(s);
    };
    pick();
    addEventListener("liqex", pick);
    return () => removeEventListener("liqex", pick);
  }, [available]);

  useEffect(() => {
    if (ex === p.ex) return;
    let stop = false;
    setBusy(true);
    fetch(`/api/liq?coin=${initial.coin}&ex=${ex}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: LiqPanel) => !stop && setP(d))
      .catch(() => {})
      .finally(() => !stop && setBusy(false));
    return () => { stop = true; };
  }, [ex, p.ex, initial.coin]);

  // Close the list on a press outside or Escape.
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("pointerdown", down);
    addEventListener("keydown", key);
    return () => { removeEventListener("pointerdown", down); removeEventListener("keydown", key); };
  }, [open]);

  const choose = (id: ExId) => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
    setEx(id);
    dispatchEvent(new Event("liqex"));
  };

  const max = Math.max(1, ...p.bins.map((b) => Math.max(b.long, b.short)));
  const time = (ms: number) => new Intl.DateTimeFormat(vi ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(ms));
  return (
    <section className={`chart liq${busy ? " busy" : ""}`} aria-label={`${p.coin} ${vi ? "thanh lý" : "liquidations"}`} aria-busy={busy}>
      <div className="chart-h" role="heading" aria-level={2}>
        {p.coin} <b className="liq-px">${p.price.toLocaleString("en-US", { maximumFractionDigits: p.price > 1000 ? 0 : 2 })}</b>
        <div className="ex-pick" ref={box}>
          <button type="button" className="ex-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {vi ? "Thanh lý" : "Liquidations"} · <b>{NAMES[ex][lang]}</b> {p.hours}h <span aria-hidden="true">▾</span>
          </button>
          {open && (
            <ul className="ex-list" role="listbox" aria-label={vi ? "Chọn sàn" : "Exchange"}>
              {available.map((id) => (
                <li key={id}>
                  <button type="button" role="option" aria-selected={id === ex} onClick={() => choose(id)}>
                    <b>{NAMES[id][lang]}</b>
                    <small>{NOTES[id][lang]}</small>
                    {id === ex && <i aria-hidden="true">✓</i>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <a className="chart-more" href={`https://www.coinglass.com/pro/futures/LiquidationHeatMap?coin=${p.coin}`} target="_blank" rel="noopener noreferrer">
          Coinglass ↗
        </a>
      </div>
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
        {p.bins.length > 0 ? (
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
        ) : (
          <p className="liq-note">{vi ? "Chưa có lệnh thanh lý trong 24 giờ qua." : "No liquidations in the last 24 hours."}</p>
        )}
        {!p.orders && p.bins.length > 0 && (
          <p className="liq-note">{vi ? "Gate chỉ công bố tổng mỗi 15 phút: mỗi vùng là số đã thanh lý khi giá ở vùng đó." : "Gate only publishes 15-minute totals: each band is what was liquidated while price was there."}</p>
        )}
      </LiqViews>
      <div className="liq-lev">
        <span className="liq-lab">{vi ? "Mức thanh lý ước tính" : "Estimated liquidation levels"}</span>
        <span className="lg">Long {p.levels.map((l) => `${l.lev}x ${px(l.long)}`).join(" · ")}</span>
        <span className="sh">Short {p.levels.map((l) => `${l.lev}x ${px(l.short)}`).join(" · ")}</span>
      </div>
      {p.biggest && (
        <p className="liq-big">
          {vi ? "Lệnh lớn nhất" : "Biggest"}: <b className={p.biggest.side === "long" ? "lg" : "sh"}>{p.biggest.side === "long" ? "Long" : "Short"} {usd(p.biggest.usd)}</b> @ {px(p.biggest.price)} · {time(p.biggest.ts)}
        </p>
      )}
    </section>
  );
}
