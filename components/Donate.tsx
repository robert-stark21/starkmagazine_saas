"use client";

import { useEffect, useRef, useState } from "react";
import type { DonateInfo } from "@/lib/donate";

/**
 * "Support STARK" button fixed in the bottom-right corner. Opens a small card with the QR
 * code to scan and the transfer details; closes with ×, Escape or a press outside.
 */
export function Donate({ info, lang }: { info: DonateInfo; lang: "vi" | "en" }) {
  const vi = lang === "vi";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
    };
  }, [open]);

  const copy = async () => {
    if (!info.account) return;
    try {
      await navigator.clipboard.writeText(info.account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={`donate${open ? " open" : ""}`} ref={box}>
      {open && (
        <div className="donate-card" role="dialog" aria-label={vi ? "Ủng hộ STARK" : "Support STARK"}>
          <button className="donate-x" onClick={() => setOpen(false)} aria-label={vi ? "Đóng" : "Close"}>×</button>
          <b className="donate-t">{vi ? "Ủng hộ STARK" : "Support STARK"}</b>
          <p className="donate-s">{vi ? "Quét mã để mời STARK một ly cà phê ☕" : "Scan to buy STARK a coffee ☕"}</p>
          <img className="donate-qr" src={info.qr} width={200} height={200} alt={vi ? "Mã QR ủng hộ" : "Donation QR code"} />
          {info.placeholder && <p className="donate-s">{vi ? "(Ảnh QR mẫu)" : "(Sample QR)"}</p>}
          {(info.bank || info.account || info.name) && (
            <dl className="donate-info">
              {info.bank && (<><dt>{vi ? "Ngân hàng" : "Bank"}</dt><dd>{info.bank}</dd></>)}
              {info.account && (
                <>
                  <dt>{vi ? "Số TK" : "Account"}</dt>
                  <dd>
                    <button className="donate-copy" onClick={copy} title={vi ? "Sao chép" : "Copy"}>
                      {info.account} <small>{copied ? (vi ? "đã chép ✓" : "copied ✓") : vi ? "chép" : "copy"}</small>
                    </button>
                  </dd>
                </>
              )}
              {info.name && (<><dt>{vi ? "Chủ TK" : "Name"}</dt><dd>{info.name}</dd></>)}
              {info.note && (<><dt>{vi ? "Nội dung" : "Note"}</dt><dd>{info.note}</dd></>)}
            </dl>
          )}
        </div>
      )}
      <button className="donate-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
          <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4h2c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
        </svg>
        <span>{vi ? "Ủng hộ" : "Donate"}</span>
      </button>
    </div>
  );
}
