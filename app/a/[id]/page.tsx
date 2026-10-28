import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle, localize, type Article } from "@/lib/feeds";
import type { Block } from "@/lib/fulltext";
import { prepareBody } from "@/lib/article";
import { getCategory, type Lang } from "@/lib/sources";
import { getLang, timeAgo, UI } from "@/lib/lang";
import { ArticleCard } from "@/components/ArticleCard";
import { ActiveCategory, ProseImage } from "@/components/client";
import { VideoEmbed } from "@/components/VideoEmbed";
import { ArticleBodySkeleton } from "@/components/Skeletons";
import { BlurText } from "@/components/BlurText";
import { imageSrcSet, imgSrc, SIZES } from "@/lib/img";
import { jsonLd, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
// Room for translations and warm-ups to finish after the page is sent (see lib/background.ts).
export const maxDuration = 60;

/**
 * Share preview (Open Graph / Twitter card): when the link is pasted into Messenger, Zalo,
 * Facebook, Slack… it shows the article's title, a short description and its thumbnail.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  // Unknown story: answering here (before the page starts streaming) gives a real 404 status.
  if (!article) notFound();
  const lang = await getLang();
  const [a] = await localize([article], lang, 1500);
  const title = a.title;
  const description = (a.excerpt || "").slice(0, 200) || undefined;
  const images = article.image ? [{ url: article.image, alt: title }] : undefined;
  return {
    title,
    description,
    openGraph: {
      type: "article",
      siteName: "STARK",
      locale: lang === "vi" ? "vi_VN" : "en_US",
      url: `/a/${id}`,
      title,
      description,
      publishedTime: article.published,
      ...(images ? { images } : {}),
    },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
    alternates: { canonical: `/a/${id}` },
  };
}

/**
 * Editorial layout: a large headline and hero image on top, then a narrow meta column
 * beside a comfortable reading column. The top renders at once from the feed data; the
 * full text (original page + translation) streams in below.
 */
export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();
  const lang = await getLang();
  const cat = getCategory(article.category)!;
  // The title is usually already translated by the list page; wait briefly otherwise.
  const [top] = await localize([article], lang, 2500);
  // The feed excerpt as a short standfirst, when it says more than the title.
  const dek = top.excerpt && top.excerpt.length > 40 && !top.title.includes(top.excerpt.slice(0, 30)) ? top.excerpt : "";

  // Search engines: this page is a news article (headline, date, picture, original source).
  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: top.title.slice(0, 110),
    description: (top.excerpt || "").slice(0, 300) || undefined,
    datePublished: article.published,
    image: article.image ? [article.image] : undefined,
    inLanguage: lang === "vi" ? "vi-VN" : "en",
    articleSection: cat[lang],
    mainEntityOfPage: `${SITE_URL}/a/${id}`,
    isBasedOn: article.link,
    author: { "@type": "Organization", name: article.source },
    publisher: { "@type": "Organization", name: "STARK", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` } },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <ActiveCategory slug={article.category} />
      <div className="progress" style={{ ["--c" as any]: cat.color }} aria-hidden="true" />
      <main className="wrap">
        <article className="detail" style={{ ["--c" as any]: cat.color }}>
          <header className="d-head">
            <Link href={`/c/${cat.slug}`} className="crumb">
              {cat[lang]}
            </Link>
            <BlurText as="h1" text={top.title} />
            {dek && <p className="dek">{dek}</p>}
            <div className="d-byline">
              <span className="src">{article.source}</span>
              <span className="dot">·</span>
              <time dateTime={article.published}>{timeAgo(article.published, lang)}</time>
            </div>
          </header>

          {article.image && (
            <figure className="d-hero">
              <img
                src={imgSrc(article.image)}
                srcSet={imageSrcSet(article.image)}
                sizes={SIZES.hero}
                alt=""
                fetchPriority="high"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </figure>
          )}

          <Suspense fallback={<ArticleBodySkeleton />}>
            <ArticleBody article={article} lang={lang} />
          </Suspense>
        </article>

        <Suspense fallback={null}>
          <Related article={article} lang={lang} color={cat.color} />
        </Suspense>
      </main>
    </>
  );
}

/** Meta column and reading column. Streams in after the top. */
async function ArticleBody({ article, lang }: { article: Article; lang: Lang }) {
  const t = UI[lang];
  // Full text, summary and translation (usually ready in the caches thanks to the warm-up).
  const { full, blocks, summary, minutes } = await prepareBody(article, lang);

  // When the feed had no picture, use the page's main image.
  const hero = !article.image && full?.image;
  const host = new URL(article.link).hostname.replace(/^www\./, "");
  const date = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(article.published));

  return (
    <div className="d-grid">
      <aside className="d-side">
        <dl>
          <div>
            <dt>{t.sourceLabel}</dt>
            <dd>{article.region === "vn" ? "🇻🇳" : "🌐"} {article.source}</dd>
          </div>
          <div>
            <dt>{t.publishedLabel}</dt>
            <dd>{date}</dd>
          </div>
          <div>
            <dt>{t.readingLabel}</dt>
            <dd>{minutes} {t.minRead}</dd>
          </div>
        </dl>
        {article.lang !== lang && <p className="d-note">🌐 {t.translatedFrom}</p>}
        <a className="d-orig" href={article.link} target="_blank" rel="noopener noreferrer">
          {t.openOriginal} ↗<span>{host}</span>
        </a>
      </aside>

      <div className="d-main">
        {summary.length > 0 && (
          <section className="summary" lang={lang}>
            <h2>{t.summary}</h2>
            <ul>
              {summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        )}
        {hero && (
          <figure className="d-hero inline">
            <img src={imgSrc(hero)} alt="" referrerPolicy="no-referrer" />
          </figure>
        )}
        {/* lang matches the shown (translated) text, so hyphenation uses the right language. */}
        <div className="prose" lang={lang}>
          {!full && <p className="muted small">{t.fullUnavailable}</p>}
          {renderBlocks(blocks)}
        </div>
        <a className="orig" href={article.link} target="_blank" rel="noopener noreferrer">
          {t.readOriginal} {host} ↗
        </a>
      </div>
    </div>
  );
}

/** Plans, sections and elevations: shown whole on a light background, never cropped. */
const DRAWING = /\b(plan|plans|section|elevation|drawing|diagram|axonometric|layout|site ?plan|floor)\b|mặt bằng|mặt cắt|mặt đứng|bản vẽ|sơ đồ/i;
const isDrawing = (b: Extract<Block, { type: "image" }>) => DRAWING.test(`${b.src.split("/").pop()} ${b.caption ?? ""}`.replace(/[_-]/g, " "));

/** Text, images and videos in order; two or more images in a row become a gallery. */
function renderBlocks(blocks: Block[]): ReactNode[] {
  const out: ReactNode[] = [];
  // The drop cap goes on the first real paragraph, not on a short fact line.
  const lead = blocks.findIndex((b) => b.type === "text" && !b.heading && b.text.length >= 140);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "image") {
      let j = i;
      while (j + 1 < blocks.length && blocks[j + 1].type === "image") j++;
      const run = blocks.slice(i, j + 1) as Extract<Block, { type: "image" }>[];
      if (run.length === 1) {
        out.push(<ProseImage key={i} src={b.src} caption={b.caption} drawing={isDrawing(b)} />);
      } else {
        out.push(
          <div key={i} className={`gallery${run.length % 2 ? " odd" : ""}`}>
            {run.map((r, k) => (
              <ProseImage key={k} src={r.src} caption={r.caption} drawing={isDrawing(r)} />
            ))}
          </div>
        );
      }
      i = j;
    } else if (b.type === "video") {
      out.push(<VideoEmbed key={i} {...b} />);
    } else if (b.heading) {
      out.push(<h2 key={i}>{b.text}</h2>);
    } else {
      out.push(
        <p key={i} className={i === lead ? "lead" : undefined}>
          {b.text}
        </p>
      );
    }
  }
  return out;
}

async function Related({ article, lang, color }: { article: Article; lang: Lang; color: string }) {
  const t = UI[lang];
  const related = await localize(
    (await getAllArticles()).filter((a) => a.category === article.category && a.id !== article.id).slice(0, 4),
    lang
  );
  if (!related.length) return null;
  return (
    <section className="sec related">
      <div className="sec-h" style={{ ["--c" as any]: color }}>
        <h2>{t.related}</h2>
      </div>
      <div className="grid">
        {related.map((a) => (
          <ArticleCard key={a.id} a={a} lang={lang} showCat={false} />
        ))}
      </div>
    </section>
  );
}
