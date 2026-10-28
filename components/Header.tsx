import Link from "next/link";
import type { Lang } from "@/lib/sources";
import { visibleCategories } from "@/lib/prefs";
import { getSession } from "@/lib/auth";
import { AccountButton } from "./Account";
import { UI } from "@/lib/lang";
import { getQuotes } from "@/lib/prices";
import { CatNav, KindleToggle, LangToggle, LolTicker, MovieTicker, PriceTicker, ScoreTicker, SongTicker } from "./client";
import { Logo } from "./Logo";

export async function Header({ lang, updated, kindle }: { lang: Lang; updated: Date; kindle: boolean }) {
  const t = UI[lang];
  // Prices for the ticker, so it shows with the first paint. Cached in memory; right after
  // a restart we wait at most 1.5s and the ticker fills in on the client otherwise.
  const [quotes, cats, session] = await Promise.all([getQuotes(1500), visibleCategories(), getSession()]);
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
        </Link>
        <div className="tag">{t.tagline}</div>
        <div className="right">
          <span className="date"><span className="cap">{today}</span> · {t.updated} {time}</span>
          <KindleToggle on={kindle} lang={lang} />
          <LangToggle lang={lang} />
          <AccountButton lang={lang} name={session?.name ?? null} />
        </div>
      </div>
      <CatNav
        items={[
          { href: "/", slug: "", label: t.home },
          ...cats.map((c) => ({ href: `/c/${c.slug}`, slug: c.slug, label: c[lang], color: c.color })),
          // Pick which sections show here.
          { href: "/tai-khoan#muc", slug: "__edit", label: lang === "vi" ? "＋ Tùy chỉnh" : "＋ Customise", className: "cat-edit" },
        ]}
      />
    </header>
    {/* Outside the sticky header: it scrolls away (fading out) while the header stays. */}
    <PriceTicker initial={quotes} lang={lang} />
    <ScoreTicker lang={lang} />
    <LolTicker lang={lang} />
    <SongTicker lang={lang} />
    <MovieTicker lang={lang} />
    </>
  );
}
