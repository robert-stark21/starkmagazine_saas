import Link from "next/link";
import type { Article } from "@/lib/feeds";
import { getCategory, type Lang } from "@/lib/sources";
import { timeAgo, UI } from "@/lib/lang";
import { readingTime } from "@/lib/text";
import { imageSrcSet, SIZES } from "@/lib/img";
import { Thumb } from "./client";
import { BlurText } from "./BlurText";

/** The card's section: a site section, the reader's own (carried on the article), or a plain fallback. */
function catOf(a: Article) {
  if (a.own) return { slug: a.category, vi: a.own.name, en: a.own.name, color: a.own.color };
  return getCategory(a.category) ?? { slug: a.category, vi: "Nguồn riêng", en: "Own source", color: "#64748b" };
}

export function Meta({ a, lang, showCat = true }: { a: Article; lang: Lang; showCat?: boolean }) {
  const cat = catOf(a);
  return (
    <div className="meta">
      {showCat && (
        <span className="badge" style={{ ["--bc" as any]: cat.color }}>
          {cat[lang]}
        </span>
      )}
      <span className="src">{a.region === "vn" ? "🇻🇳" : "🌐"} {a.source}</span>
      <span className="dot">·</span>
      <time dateTime={a.published}>{timeAgo(a.published, lang)}</time>
    </div>
  );
}

export function ArticleCard({
  a,
  lang,
  variant = "default",
  showCat = true,
  priority = false,
}: {
  a: Article;
  lang: Lang;
  variant?: "hero" | "default" | "compact" | "tile";
  showCat?: boolean;
  priority?: boolean; // above the fold: load at once, no fade
}) {
  const cat = catOf(a);
  return (
    <article className={`card ${variant}`}>
      <Link href={`/a/${a.id}`} className="cover">
        {variant !== "compact" && (
          <Thumb
            src={a.image}
            srcSet={imageSrcSet(a.image)}
            sizes={variant === "hero" ? SIZES.hero : SIZES.card}
            priority={priority || variant === "hero"}
            alt=""
            color={cat.color}
            label={cat[lang]}
          />
        )}
        <div className="body">
          <Meta a={a} lang={lang} showCat={showCat} />
          {variant === "hero" ? <BlurText as="h3" text={a.title} /> : <h3>{a.title}</h3>}
          {variant !== "compact" && variant !== "tile" && a.excerpt && <p>{a.excerpt}</p>}
          <div className="foot">
            {readingTime(a.text)} {UI[lang].minRead}
            {a.translated && <span className="tr">{lang === "vi" ? "Đã dịch" : "Translated"}</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
