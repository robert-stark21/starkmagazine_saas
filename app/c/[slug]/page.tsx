import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAllArticles, hasUntranslated, localize } from "@/lib/feeds";
import { RefreshSoon } from "@/components/client";
import { warm } from "@/lib/warm";
import { getCategory, MOODBOARD, SOURCES } from "@/lib/sources";
import { getLang, UI } from "@/lib/lang";
import { ArticleCard } from "@/components/ArticleCard";
import { PaperColumns, PaperFront, pickFront } from "@/components/Newspaper";
import { Charts } from "@/components/Charts";
import { EconPanels, LiquidationPanels } from "@/components/MarketPanels";
import { WeatherStrip } from "@/components/WeatherStrip";
import { getAccount } from "@/lib/auth";
import { categoryFor, ownArticles } from "@/lib/own";
import { getSettings, withoutHiddenSources } from "@/lib/prefs";

export const dynamic = "force-dynamic";
// Room for translations and warm-ups to finish after the page is sent (see lib/background.ts).
export const maxDuration = 60;

const CAT_DESC: Record<string, { vi: string; en: string }> = {
  "cong-nghe": { vi: "Tin công nghệ mới nhất: AI, điện thoại, máy tính, phần mềm và startup.", en: "Latest tech news: AI, phones, computers, software and startups." },
  crypto: { vi: "Tin crypto, Bitcoin, Ethereum, thị trường tiền mã hóa và dữ liệu thanh lý.", en: "Crypto news, Bitcoin, Ethereum, markets and liquidation data." },
  "tai-chinh": { vi: "Tin tài chính, chứng khoán, vàng, lịch kinh tế trong nước và quốc tế.", en: "Finance, stocks, gold and the economic calendar." },
  "chinh-tri": { vi: "Tin chính trị, thời sự trong nước và thế giới.", en: "Politics and current affairs from Vietnam and the world." },
  "xa-hoi": { vi: "Tin xã hội, đời sống, pháp luật.", en: "Society, everyday life and law." },
  "du-lich": { vi: "Tin du lịch, điểm đến, ẩm thực và kinh nghiệm đi chơi.", en: "Travel news, destinations, food and tips." },
  "suc-khoe": { vi: "Tin sức khỏe, dinh dưỡng, y tế và lối sống lành mạnh.", en: "Health, nutrition, medicine and wellbeing." },
  "giao-duc": { vi: "Tin giáo dục, tuyển sinh, du học và học tập.", en: "Education, admissions, study abroad and learning." },
  "the-thao": { vi: "Tin thể thao, bóng đá Việt Nam và thế giới, tỷ số trực tiếp.", en: "Sports and football news with live scores." },
  esport: { vi: "Tin esport, Liên Minh Huyền Thoại, game PC và console.", en: "Esports, League of Legends, PC and console games." },
  design: { vi: "Tin thiết kế đồ họa, thương hiệu, typography.", en: "Graphic design, branding and typography." },
  "ui-ux": { vi: "Bài viết UI/UX, thiết kế sản phẩm và trải nghiệm người dùng.", en: "UI/UX, product design and user experience." },
  "kien-truc": { vi: "Tin kiến trúc, nội thất và công trình nổi bật.", en: "Architecture, interiors and notable buildings." },
  "phim-anh": { vi: "Tin phim ảnh, phim chiếu rạp và trailer.", en: "Film news, cinema releases and trailers." },
  showbiz: { vi: "Tin showbiz Việt Nam và thế giới, bảng xếp hạng âm nhạc.", en: "Showbiz news and music charts." },
  inspiration: { vi: "Cảm hứng thiết kế: website, sản phẩm và tác phẩm đẹp.", en: "Design inspiration: websites, products and creative work." },
  "quang-cao": { vi: "Quảng cáo sáng tạo, chiến dịch và phim quảng cáo.", en: "Creative advertising, campaigns and ad films." },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) {
    // The reader's own section: its name in the tab, never indexed.
    const own = slug.startsWith("u-") ? categoryFor(slug, await getAccount()) : undefined;
    return own ? { title: own.vi, robots: { index: false } } : {};
  }
  const lang = await getLang();
  const title = lang === "vi" ? `Tin ${cat.vi}` : `${cat.en} news`;
  const description = CAT_DESC[slug]?.[lang] ?? title;
  return {
    title,
    description,
    alternates: { canonical: `/c/${slug}` },
    openGraph: { type: "website", url: `/c/${slug}`, title, description, locale: lang === "vi" ? "vi_VN" : "en_US" },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { slug } = await params;
  const { r } = await searchParams;
  // A site section, or (signed in) one the reader made.
  const account = await getAccount();
  const cat = categoryFor(slug, account);
  if (!cat) notFound();
  const mine = slug.startsWith("u-");
  const { widgetsOff, theme } = await getSettings();
  const on = (id: string) => !widgetsOff.has(id);
  const lang = await getLang();
  const t = UI[lang];
  const moodboard = MOODBOARD.has(slug);

  const [site, own] = await Promise.all([mine ? [] : getAllArticles(), ownArticles(account)]);
  const items = [...own.filter((a) => a.category === slug), ...(await withoutHiddenSources(site.filter((a) => a.category === slug)))]
    .sort((a, b) => b.published.localeCompare(a.published))
    .filter((a) => (r === "vn" || r === "intl" ? a.region === r : true))
    .filter((a) => (moodboard ? a.image : true))
    .slice(0, moodboard ? 120 : 60);
  const loc = await localize(items, lang);
  // Prepare the stories on the first screens in the background, so they open at once.
  warm(items.slice(0, 16), lang, true);
  // Distinct publishers: RGB has several section feeds in one category.
  const sourceCount = new Set([
    ...SOURCES.filter((s) => s.category === slug).map((s) => s.name),
    ...(account?.sources ?? []).filter((s) => s.cat === slug).map((s) => s.name),
  ]).size;

  const chip = (key: string | undefined, label: string) => (
    <Link href={key ? `/c/${slug}?r=${key}` : `/c/${slug}`} className={`chip ${r === key ? "on" : ""}`}>
      {label}
    </Link>
  );

  return (
    <>
      {hasUntranslated(loc, lang) && <RefreshSoon />}
      <main className="wrap">
        <div className="page-h" style={{ ["--c" as any]: cat.color }}>
          <h1>{cat[lang]}</h1>
          <span className="muted">{sourceCount} {t.sources}</span>
          <div className="chips">
            {chip(undefined, t.all)}
            {chip("vn", `🇻🇳 ${t.vn}`)}
            {/* Showbiz splits into Vietnam and the world. */}
            {chip("intl", `🌐 ${slug === "showbiz" ? (lang === "vi" ? "Thế giới" : "World") : t.intl}`)}
          </div>
        </div>
        {mine && !items.length && (
          <p className="empty">
            {lang === "vi" ? "Mục này chưa có nguồn tin. " : "This section has no sources yet. "}
            <Link href="/tai-khoan/nguon" className="link">{lang === "vi" ? "Thêm nguồn" : "Add a source"}</Link>
          </p>
        )}
        {slug === "du-lich" && on("weather") && (
          <Suspense fallback={<div className="charts charts-wait" aria-hidden="true" />}>
            <WeatherStrip lang={lang} region={r} />
          </Suspense>
        )}
        {slug === "showbiz" && on("charts") && (
          <Suspense fallback={<div className="charts charts-wait" aria-hidden="true" />}>
            <Charts lang={lang} region={r} />
          </Suspense>
        )}
        {slug === "crypto" && on("liq") && (
          <Suspense fallback={<div className="charts charts-wait" aria-hidden="true" />}>
            <LiquidationPanels lang={lang} />
          </Suspense>
        )}
        {slug === "tai-chinh" && on("econ") && (
          <Suspense fallback={<div className="charts charts-wait" aria-hidden="true" />}>
            <EconPanels lang={lang} />
          </Suspense>
        )}
        {loc.length && theme === "bao-xua" && !moodboard ? (
          // "Báo xưa": the section set like a newspaper page.
          (() => {
            const front = pickFront(loc);
            return (
              <div className="np">
                <PaperFront front={front} lang={lang} kicker={false} />
                <PaperColumns items={loc.filter((a) => !front.used.has(a))} lang={lang} />
              </div>
            );
          })()
        ) : loc.length ? (
          <div className={moodboard ? "masonry" : "grid cat-grid"}>
            {loc.map((a, i) => (
              <ArticleCard key={a.id} a={a} lang={lang} showCat={false} variant={moodboard ? "tile" : "default"} priority={i < 2} />
            ))}
          </div>
        ) : (
          !mine && <p className="empty">{t.noArticles}</p>
        )}
      </main>
    </>
  );
}
