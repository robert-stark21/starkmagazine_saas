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
import { Charts } from "@/components/Charts";
import { EconPanels, LiquidationPanels } from "@/components/MarketPanels";

export const dynamic = "force-dynamic";
// Room for translations and warm-ups to finish after the page is sent (see lib/background.ts).
export const maxDuration = 60;

const CAT_DESC: Record<string, { vi: string; en: string }> = {
  "cong-nghe": { vi: "Tin công nghệ mới nhất: AI, điện thoại, máy tính, phần mềm và startup.", en: "Latest tech news: AI, phones, computers, software and startups." },
  crypto: { vi: "Tin crypto, Bitcoin, Ethereum, thị trường tiền mã hóa và dữ liệu thanh lý.", en: "Crypto news, Bitcoin, Ethereum, markets and liquidation data." },
  "tai-chinh": { vi: "Tin tài chính, chứng khoán, vàng, lịch kinh tế trong nước và quốc tế.", en: "Finance, stocks, gold and the economic calendar." },
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
  if (!cat) return {};
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
  const cat = getCategory(slug);
  if (!cat) notFound();
  const lang = await getLang();
  const t = UI[lang];
  const moodboard = MOODBOARD.has(slug);

  const items = (await getAllArticles())
    .filter((a) => a.category === slug)
    .filter((a) => (r === "vn" || r === "intl" ? a.region === r : true))
    .filter((a) => (moodboard ? a.image : true))
    .slice(0, moodboard ? 120 : 60);
  const loc = await localize(items, lang);
  // Prepare the stories on the first screens in the background, so they open at once.
  warm(items.slice(0, 16), lang, true);
  // Distinct publishers: RGB has several section feeds in one category.
  const sourceCount = new Set(SOURCES.filter((s) => s.category === slug).map((s) => s.name)).size;

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
        {slug === "showbiz" && (
          <Suspense fallback={<div className="charts charts-wait" aria-hidden="true" />}>
            <Charts lang={lang} region={r} />
          </Suspense>
        )}
        {slug === "crypto" && (
          <Suspense fallback={<div className="charts charts-wait" aria-hidden="true" />}>
            <LiquidationPanels lang={lang} />
          </Suspense>
        )}
        {slug === "tai-chinh" && (
          <Suspense fallback={<div className="charts charts-wait" aria-hidden="true" />}>
            <EconPanels lang={lang} />
          </Suspense>
        )}
        {loc.length ? (
          <div className={moodboard ? "masonry" : "grid cat-grid"}>
            {loc.map((a, i) => (
              <ArticleCard key={a.id} a={a} lang={lang} showCat={false} variant={moodboard ? "tile" : "default"} priority={i < 2} />
            ))}
          </div>
        ) : (
          <p className="empty">{t.noArticles}</p>
        )}
      </main>
    </>
  );
}
