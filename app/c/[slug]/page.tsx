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

export const dynamic = "force-dynamic";

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
            <Charts lang={lang} />
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
