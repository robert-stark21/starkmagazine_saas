"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { AdSlot, AdsInfo } from "@/lib/ads";

/** Tall ad banners beside the page (wide screens only), not on account and sign-in pages. */
export function AdRails({ ads, lang }: { ads: AdsInfo; lang: "vi" | "en" }) {
  const path = usePathname();
  // Start the banners just under the header and tickers, and keep them under the header
  // while scrolling (it is sticky in most themes, scrolls away in "Báo xưa").
  useEffect(() => {
    let raf = 0;
    const place = () => {
      raf = 0;
      const header = document.querySelector("header.site")?.getBoundingClientRect().bottom ?? 0;
      const main = document.querySelector("main")?.getBoundingClientRect().top ?? 0;
      const top = Math.max(16, header + 16, main + 16);
      document.documentElement.style.setProperty("--ad-top", `${Math.round(top)}px`);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    return () => { removeEventListener("scroll", queue); removeEventListener("resize", queue); cancelAnimationFrame(raf); };
  }, [path]);
  if (path.startsWith("/tai-khoan") || path.startsWith("/dang-nhap")) return null;
  return (
    <>
      <Rail side="left" slot={ads.left} contact={ads.contact} lang={lang} />
      <Rail side="right" slot={ads.right} contact={ads.contact} lang={lang} />
    </>
  );
}

function Rail({ side, slot, contact, lang }: { side: "left" | "right"; slot: AdSlot; contact?: string; lang: "vi" | "en" }) {
  const vi = lang === "vi";
  if (slot.image) {
    const img = <img src={slot.image} alt={vi ? "Quảng cáo" : "Advertisement"} />;
    return (
      <aside className={`ad-rail ${side}`} aria-label={vi ? "Quảng cáo" : "Advertisement"}>
        <span className="ad-tag">{vi ? "Quảng cáo" : "Ad"}</span>
        {slot.url ? <a href={slot.url} target="_blank" rel="sponsored noopener">{img}</a> : img}
      </aside>
    );
  }
  // Empty slot: a frame offering the space.
  const href = contact ? (contact.includes("@") ? `mailto:${contact}` : `tel:${contact.replace(/[^\d+]/g, "")}`) : undefined;
  const body = (
    <div className="ad-empty">
      <b>{vi ? "Đặt quảng cáo" : "Advertise"}</b>
      <span>{vi ? "tại đây" : "here"}</span>
      <small>160 × 600</small>
      {contact && <em>{contact}</em>}
    </div>
  );
  return (
    <aside className={`ad-rail ${side}`} aria-label={vi ? "Chỗ đặt quảng cáo" : "Ad space"}>
      <span className="ad-tag">{vi ? "Quảng cáo" : "Ad"}</span>
      {href ? <a href={href}>{body}</a> : body}
    </aside>
  );
}
