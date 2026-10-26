"use client";
import { useEffect, useRef, useState } from "react";
import type { LiqHeat } from "@/lib/markets";

/**
 * The switch between the two views of a liquidation card: bars by price band (actual
 * liquidations) or the estimated heatmap. The choice is remembered for this browser and
 * shared by the BTC and ETH cards.
 */
const KEY = "liqView";
type View = "bars" | "heat";
const read = (): View => {
  try {
    return localStorage.getItem(KEY) === "heat" ? "heat" : "bars";
  } catch {
    return "bars";
  }
};

export function LiqViews({ heat, lang, children }: { heat?: LiqHeat | null; lang: "vi" | "en"; children: React.ReactNode }) {
  const [view, setView] = useState<View>("bars");
  useEffect(() => {
    setView(read());
    const sync = () => setView(read());
    addEventListener("liqview", sync);
    return () => removeEventListener("liqview", sync);
  }, []);
  const pick = (v: View) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    setView(v);
    dispatchEvent(new Event("liqview"));
  };
  const vi = lang === "vi";
  const shown = heat ? view : "bars";
  return (
    <div className="liq-views">
      {heat && (
        <div className="seg" role="tablist" aria-label={vi ? "Kiểu xem" : "View"}>
          <button type="button" role="tab" aria-selected={shown === "bars"} onClick={() => pick("bars")}>{vi ? "Cột" : "Bars"}</button>
          <button type="button" role="tab" aria-selected={shown === "heat"} onClick={() => pick("heat")}>Heatmap</button>
        </div>
      )}
      {shown === "heat" && heat ? <Heatmap h={heat} vi={vi} /> : children}
    </div>
  );
}

// Viridis-like scale (dark purple → blue → teal → green → yellow), like Coinglass.
const STOPS: [number, [number, number, number]][] = [
  [0, [42, 10, 74]], [0.2, [68, 1, 84]], [0.4, [59, 82, 139]], [0.6, [33, 145, 140]], [0.8, [94, 201, 98]], [1, [253, 231, 37]],
];
function color(v: number): string {
  const x = Math.max(0, Math.min(1, v));
  let i = 0;
  while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) i++;
  const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1];
  const k = (x - a) / (b - a || 1);
  return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`;
}

function Heatmap({ h, vi }: { h: LiqHeat; vi: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const w = cv.clientWidth, ht = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(ht * dpr);
      const g = cv.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const axis = 44; // price labels on the right
      const legend = 10; // colour scale on the left
      const pw = w - axis - legend - 6, ph = ht - 16; // plot area; time labels below
      const x0 = legend + 6;
      g.fillStyle = color(0);
      g.fillRect(x0, 0, pw, ph);
      const cw = pw / h.cols, rh = ph / h.rows;
      for (let r = 0; r < h.rows; r++)
        for (let c = 0; c < h.cols; c++) {
          const v = h.cells[r * h.cols + c];
          if (!v) continue;
          g.fillStyle = color(v / 100);
          g.fillRect(x0 + c * cw, r * rh, Math.ceil(cw), Math.ceil(rh));
        }
      // Price line on top.
      const y = (p: number) => ((h.hi - p) / (h.hi - h.lo)) * ph;
      g.strokeStyle = "#ff5a5f";
      g.lineWidth = 1.5;
      g.beginPath();
      h.close.forEach((p, c) => (c ? g.lineTo(x0 + (c + 0.5) * cw, y(p)) : g.moveTo(x0 + 0.5 * cw, y(p))));
      g.stroke();
      // Axes: four prices on the right, three times below (Vietnam time).
      const css = getComputedStyle(cv);
      g.fillStyle = css.color;
      g.font = "10px " + css.fontFamily;
      g.textBaseline = "middle";
      for (let i = 0; i <= 4; i++) {
        const p = h.hi - ((h.hi - h.lo) * i) / 4;
        g.fillText(p >= 10000 ? `${(p / 1000).toFixed(1)}k` : p.toFixed(0), x0 + pw + 4, Math.min(ph - 5, Math.max(5, (ph * i) / 4)));
      }
      g.textBaseline = "alphabetic";
      const fmt = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
      [0, 0.5, 1].forEach((f, i) => {
        const c = Math.round(f * (h.cols - 1));
        const label = fmt.format(new Date(h.t0 + c * h.step));
        g.textAlign = i === 0 ? "left" : i === 2 ? "right" : "center";
        g.fillText(label, x0 + (i === 2 ? pw : f * pw), ht - 3);
      });
      g.textAlign = "left";
      // Colour scale on the left (high on top).
      const grad = g.createLinearGradient(0, 0, 0, ph);
      STOPS.slice().reverse().forEach(([s, c]) => grad.addColorStop(1 - s, `rgb(${c.join(",")})`));
      g.fillStyle = grad;
      g.fillRect(0, 0, legend, ph);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [h]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget, r = cv.getBoundingClientRect();
    const x0 = 16, pw = r.width - 44 - 16, ph = r.height - 16;
    const x = e.clientX - r.left - x0, y = e.clientY - r.top;
    if (x < 0 || x > pw || y < 0 || y > ph) return setTip(null);
    const c = Math.min(h.cols - 1, Math.floor((x / pw) * h.cols)), row = Math.min(h.rows - 1, Math.floor((y / ph) * h.rows));
    const price = h.hi - ((row + 0.5) / h.rows) * (h.hi - h.lo);
    const t = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(h.t0 + c * h.step));
    const v = h.cells[row * h.cols + c];
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: `${t} · ${price >= 10000 ? price.toFixed(0) : price.toFixed(1)} · ${vi ? "mức" : "level"} ${v}/100` });
  };
  return (
    <div className="liq-heat">
      <canvas ref={ref} onPointerMove={onMove} onPointerLeave={() => setTip(null)} aria-label={vi ? "Heatmap thanh lý ước tính 24 giờ" : "Estimated liquidation heatmap, 24 hours"} role="img" />
      {tip && <span className="liq-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</span>}
      <p className="liq-note">{vi ? "Ước tính từ open interest và giá trên OKX (đòn bẩy giả định 5–100x), không phải dữ liệu Coinglass." : "Estimated from OKX open interest and price (assumed 5–100x leverage), not Coinglass data."}</p>
    </div>
  );
}
