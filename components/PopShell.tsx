"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The floating panel of the ticker popups (football, LoL). Like Aceternity's navbar menu, it
 * springs in under the hovered item and, when another item is hovered, slides and resizes
 * to it instead of closing and reopening. Solid surface, full width on phones.
 */
export type PopProps<T> = {
  match: T;
  anchor: HTMLElement;
  below: number; // bottom of the ticker row, in viewport pixels
  lang: "vi" | "en";
  closing: boolean;
  onEnter: () => void;
  onLeave: (e: React.PointerEvent) => void;
  onClose: () => void;
  onGone: () => void;
};

const WIDTH = 400;
const GAP = 8;

export default function PopShell({
  id, label, closeLabel, anchor, below, closing, onEnter, onLeave, onClose, onGone, children,
}: Omit<PopProps<unknown>, "match" | "lang"> & { id: string; label: string; closeLabel: string; children: React.ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; w: number; origin: number } | null>(null);
  const [h, setH] = useState<number | null>(null);
  const moved = useRef(false); // false until the first position is on screen: no slide in

  // Under the anchor, kept inside the window; full width on phones.
  useLayoutEffect(() => {
    const place = () => {
      const vw = document.documentElement.clientWidth;
      const r = anchor.getBoundingClientRect();
      const w = vw <= 760 ? vw - 16 : Math.min(WIDTH, vw - 24);
      const x = vw <= 760 ? 8 : Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12));
      setPos({ x, w, origin: Math.max(16, Math.min(w - 16, r.left + r.width / 2 - x)) });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [anchor]);

  // The panel follows the height of its content (details load after it opens).
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
    return () => ro.disconnect();
  }, [pos === null]);
  useEffect(() => {
    if (!pos) return;
    const f = requestAnimationFrame(() => (moved.current = true));
    return () => cancelAnimationFrame(f);
  }, [pos]);

  useEffect(() => {
    if (closing) {
      const t = setTimeout(onGone, 170);
      return () => clearTimeout(t);
    }
  }, [closing, onGone]);

  if (!pos) return null;
  return createPortal(
    <div
      className={`mp-wrap${moved.current ? " can-move" : ""}`}
      style={{ transform: `translate3d(${pos.x}px, ${below + GAP}px, 0)`, width: pos.w }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div
        className={`mp${closing ? " out" : ""}`}
        style={{ transformOrigin: `${pos.origin}px 0`, height: h ?? undefined, maxHeight: `calc(100dvh - ${below + GAP + 12}px)` }}
        role="dialog"
        aria-label={label}
      >
        <div className="mp-scroll">
          <div ref={content} className="mp-in">
            <div key={id} className="mp-fade">
              {children}
            </div>
          </div>
        </div>
        <button type="button" className="mp-x" onClick={onClose} aria-label={closeLabel}>×</button>
      </div>
    </div>,
    document.body
  );
}
