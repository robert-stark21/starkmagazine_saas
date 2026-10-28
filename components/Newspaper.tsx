import Link from "next/link";
import type { Article } from "@/lib/feeds";
import type { Category, Lang } from "@/lib/sources";
import { timeAgo } from "@/lib/lang";
import { imageSrcSet, SIZES } from "@/lib/img";
import { Thumb } from "./client";
import { catOf } from "./ArticleCard";

/**
 * Layout for the "Báo xưa" theme: the page set like a printed front page.
 * A headline across the whole page, three ruled columns under it, a box of
 * short news, then each section under a dark label bar.
 */

type Variant = "text" | "photo" | "feature" | "brief";

function Byline({ a, lang }: { a: Article; lang: Lang }) {
  return (
    <p className="np-by">
      {lang === "vi" ? "Theo" : "From"} {a.source} · <time dateTime={a.published}>{timeAgo(a.published, lang)}</time>
    </p>
  );
}

export function PaperStory({ a, lang, variant = "text", kicker = true, priority = false }: { a: Article; lang: Lang; variant?: Variant; kicker?: boolean; priority?: boolean }) {
  const cat = catOf(a);
  const photo = (variant === "photo" || variant === "feature") && a.image;
  return (
    <article className={`np-story np-${variant}`}>
      <Link href={`/a/${a.id}`} className="cover">
        {kicker && variant !== "brief" && <span className="np-kick">{cat[lang]}</span>}
        {photo && (
          <figure className="np-fig">
            <Thumb src={a.image} srcSet={imageSrcSet(a.image)} sizes={variant === "feature" ? SIZES.hero : SIZES.card} priority={priority} alt="" color={cat.color} label={cat[lang]} />
          </figure>
        )}
        <h3>{a.title}</h3>
        {variant !== "brief" && a.excerpt && <p className="np-ex">{a.excerpt}</p>}
        {variant !== "brief" && <Byline a={a} lang={lang} />}
      </Link>
    </article>
  );
}

/** Picks the stories for a front page out of a list, newest first. */
export function pickFront(list: Article[]) {
  const hero = list.find((a) => a.image) ?? list[0];
  const rest = list.filter((a) => a !== hero);
  const right = rest.filter((a) => a.image).slice(0, 2);
  const left = rest.filter((a) => !right.includes(a)).slice(0, 3);
  const center = rest.filter((a) => !right.includes(a) && !left.includes(a)).slice(0, 2);
  const used = new Set([hero, ...right, ...left, ...center]);
  const wire = rest.filter((a) => !used.has(a)).slice(0, 6);
  wire.forEach((a) => used.add(a));
  return { hero, left, right, center, wire, used };
}

export function PaperFront({ front, lang, kicker = true }: { front: ReturnType<typeof pickFront>; lang: Lang; kicker?: boolean }) {
  const { hero, left, right, center, wire } = front;
  if (!hero) return null;
  const vi = lang === "vi";
  const cat = catOf(hero);
  return (
    <>
      <h2 className="np-banner">
        <Link href={`/a/${hero.id}`}>{hero.title}</Link>
      </h2>
      <div className="np-front">
        <div className="np-col np-l">
          {left.map((a, i) => (
            <PaperStory key={a.id} a={a} lang={lang} kicker={kicker} variant={i === 1 && a.image ? "photo" : "text"} />
          ))}
        </div>
        <div className="np-c">
        <article className="np-story np-lead">
          <Link href={`/a/${hero.id}`} className="cover">
            <figure className="np-fig">
              <Thumb src={hero.image} srcSet={imageSrcSet(hero.image)} sizes={SIZES.hero} priority alt="" color={cat.color} label={cat[lang]} />
              <figcaption>
                {kicker && <>{cat[lang]} · </>}
                {hero.source}
              </figcaption>
            </figure>
            {hero.excerpt && <p className="np-ex np-drop">{hero.excerpt}</p>}
            <p className="np-more">{vi ? "Đọc tiếp →" : "Continued inside →"}</p>
          </Link>
        </article>
        {center.length > 0 && (
          <div className="np-under">
            {center.map((a) => (
              <PaperStory key={a.id} a={a} lang={lang} kicker={kicker} />
            ))}
          </div>
        )}
        </div>
        <div className="np-col np-r">
          {right.map((a) => (
            <PaperStory key={a.id} a={a} lang={lang} kicker={kicker} variant="photo" />
          ))}
        </div>
      </div>
      {wire.length > 0 && (
        <section className="np-wire" aria-label={vi ? "Tin vắn" : "In brief"}>
          <h2>{vi ? "Tin vắn" : "In brief"}</h2>
          <div className="np-wire-list">
            {wire.map((a) => (
              <PaperStory key={a.id} a={a} lang={lang} variant="brief" />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** One section: a dark label bar, a big story with its photo, smaller ones beside it. */
export function PaperSection({ c, items, lang, seeAll }: { c: Category; items: Article[]; lang: Lang; seeAll: string }) {
  const [first, ...more] = items;
  return (
    <section className="np-sec">
      <div className="np-label">
        <h2>
          <Link href={`/c/${c.slug}`}>{c[lang]}</Link>
        </h2>
        <Link href={`/c/${c.slug}`} className="np-all">{seeAll} →</Link>
      </div>
      <div className="np-sgrid">
        {first && <PaperStory a={first} lang={lang} kicker={false} variant={first.image ? "feature" : "text"} />}
        {more.map((a) => (
          <PaperStory key={a.id} a={a} lang={lang} kicker={false} />
        ))}
      </div>
    </section>
  );
}

/** The rest of a section page: ruled columns of stories, a photo on every third one. */
export function PaperColumns({ items, lang }: { items: Article[]; lang: Lang }) {
  return (
    <div className="np-cols">
      {items.map((a, i) => (
        <PaperStory key={a.id} a={a} lang={lang} kicker={false} variant={i % 3 === 0 && a.image ? "photo" : "text"} />
      ))}
    </div>
  );
}

/** "Năm thứ I · Số 7": the issue line in the masthead, counted from the first issue. */
export function issueLine(lang: Lang) {
  const day = Math.floor((Date.now() - Date.UTC(2026, 9, 22)) / 86400000) + 1;
  const year = Math.floor((day - 1) / 365) + 1;
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][year - 1] ?? String(year);
  return lang === "vi" ? `Năm thứ ${roman} · Số ${day}` : `Year ${roman} · No. ${day}`;
}
