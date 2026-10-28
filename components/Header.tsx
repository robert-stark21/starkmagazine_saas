import Link from "next/link";
import type { Lang } from "@/lib/sources";
import { getSettings, visibleCategories } from "@/lib/prefs";
import { getAccount, getSession } from "@/lib/auth";
import { ownCategories } from "@/lib/own";
import type { Scheme } from "@/lib/themes";
import { AccountButton, SchemeToggle } from "./Account";
import { UI } from "@/lib/lang";
import { getQuotes } from "@/lib/prices";
import { CatNav, KindleToggle, LangToggle, LolTicker, MovieTicker, PriceTicker, ScoreTicker, SongTicker } from "./client";
import { Logo } from "./Logo";
import { issueLine } from "./Newspaper";

export async function Header({ lang, updated, kindle, scheme }: { lang: Lang; updated: Date; kindle: boolean; scheme: Scheme }) {
  const t = UI[lang];
  // Prices for the ticker, so it shows with the first paint. Cached in memory; right after
  // a restart we wait at most 1.5s and the ticker fills in on the client otherwise.
  const [session, account, { widgetsOff }] = await Promise.all([getSession(), getAccount(), getSettings()]);
  const on = (id: string) => !widgetsOff.has(id);
  const [quotes, cats] = await Promise.all([on("prices") ? getQuotes(1500) : [], visibleCategories(ownCategories(account))]);
  const today = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(updated);
  return (
    <>
    <header className="site">
      <div className="wrap top">
        <Link href="/" className="brand" aria-label="STARK">
          <Logo className="logo" />
          {/* Masthead name, shown only by the "Báo xưa" theme. */}
          <span className="np-name" aria-hidden="true">Stark</span>
        </Link>
        <div className="tag">{t.tagline}</div>
        {/* Issue line and motto of the "Báo xưa" masthead (hidden in other themes). */}
        <div className="np-ear" aria-hidden="true">{issueLine(lang)}</div>
        <div className="np-motto" aria-hidden="true">{lang === "vi" ? "Nhựt báo · Thông tin · Nghị luận" : "Daily · News · Opinion"}</div>
        <div className="right">
          <span className="date"><span className="cap">{today}</span> · {t.updated} {time}</span>
          <SchemeToggle scheme={scheme} lang={lang} />
          <KindleToggle on={kindle} lang={lang} />
          <LangToggle lang={lang} />
          <AccountButton lang={lang} name={session?.name ?? null} />
        </div>
      </div>
      <CatNav
        items={[
          { href: "/", slug: "", label: t.home },
          ...cats.map((c) => ({ href: `/c/${c.slug}`, slug: c.slug, label: c[lang], color: c.color })),
        ]}
      />
    </header>
    {/* Outside the sticky header: it scrolls away (fading out) while the header stays. */}
    {/* Each can be switched off in Settings → Widgets. */}
    {on("prices") && <PriceTicker initial={quotes} lang={lang} />}
    {on("scores") && <ScoreTicker lang={lang} />}
    {on("lol") && <LolTicker lang={lang} />}
    {on("songs") && <SongTicker lang={lang} />}
    {on("movies") && <MovieTicker lang={lang} />}
    </>
  );
}
