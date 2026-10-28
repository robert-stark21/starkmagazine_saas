import type { Metadata } from "next";
import Link from "next/link";
import { imageSrcSet, imgSrc, SIZES } from "@/lib/img";
import { ShinyText } from "@/components/BlurText";
import { getAllArticles, hasUntranslated, localize } from "@/lib/feeds";
import { RefreshSoon } from "@/components/client";
import { warm } from "@/lib/warm";
import { getSettings, visibleCategories, withoutHiddenSources } from "@/lib/prefs";
import { getAccount } from "@/lib/auth";
import { ownArticles, ownCategories } from "@/lib/own";
import { getLang, UI } from "@/lib/lang";
import { ArticleCard } from "@/components/ArticleCard";
import { PaperFront, PaperSection, pickFront } from "@/components/Newspaper";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export const dynamic = "force-dynamic";
// Room for translations and warm-ups to finish after the page is sent (see lib/background.ts).
export const maxDuration = 60;

export default async function Home() {
  const lang = await getLang();
  const t = UI[lang];
  // Only the sections this reader reads (all of them by default), in their order.
  // The reader's own sections and sources (signed in) come in alongside the site's.
  const account = await getAccount();
  const cats = await visibleCategories(ownCategories(account));
  const shownCats = new Set(cats.map((c) => c.slug));
  const [site, own] = await Promise.all([getAllArticles(), ownArticles(account)]);
  const all = [...own, ...(await withoutHiddenSources(site))]
    .filter((a) => shownCats.has(a.category))
    .sort((a, b) => b.published.localeCompare(a.published));

  // The "Báo xưa" theme sets the page like a printed front page (components/Newspaper.tsx).
  const paper = (await getSettings()).theme === "bao-xua";
  const front = paper ? pickFront(all) : undefined;
  const withImg = all.filter((a) => a.image);
  const hero = front?.hero ?? withImg[0] ?? all[0];
  const side = paper ? [] : all.filter((a) => a !== hero).slice(0, 5);
  const sections = cats.map((c) => ({
    c,
    items: all.filter((a) => a.category === c.slug && !(front ? front.used.has(a) : a === hero)).slice(0, paper ? 5 : 4),
  })).filter((s) => s.items.length);

  const shown = [hero, ...(front ? [...front.used] : []), ...side, ...sections.flatMap((s) => s.items)].filter(Boolean);
  const loc = new Map((await localize(shown, lang)).map((a) => [a.id, a]));
  // Prepare the stories on screen in the background, so they open at once.
  warm(shown.slice(0, 16), lang, true);
  const L = (a: (typeof all)[number]) => loc.get(a.id) ?? a;
  const pending = hasUntranslated([...loc.values()], lang);

  return (
    <>
      {/* Start the hero image download with the HTML (React moves this into <head>). */}
      {hero?.image && (
        <link rel="preload" as="image" href={imgSrc(hero.image)} imageSrcSet={imageSrcSet(hero.image)} imageSizes={SIZES.hero} fetchPriority="high" />
      )}
      {pending && <RefreshSoon />}
      {paper ? (
        <main className="wrap np">
          {!hero ? (
            <p className="empty">{t.noArticles}</p>
          ) : (
            <PaperFront
              lang={lang}
              front={{ hero: L(hero), left: front!.left.map(L), right: front!.right.map(L), center: front!.center.map(L), wire: front!.wire.map(L), used: front!.used }}
            />
          )}
          {sections.map(({ c, items }) => (
            <PaperSection key={c.slug} c={c} items={items.map(L)} lang={lang} seeAll={t.seeAll} />
          ))}
        </main>
      ) : (
      <main className="wrap">
        {!hero ? (
          <p className="empty">{t.noArticles}</p>
        ) : (
          <section className="lead">
            <ArticleCard a={L(hero)} lang={lang} variant="hero" />
            <aside>
              <h2 className="h live">
                <ShinyText text={t.latest} />
              </h2>
              {side.map((a) => (
                <ArticleCard key={a.id} a={L(a)} lang={lang} variant="compact" />
              ))}
            </aside>
          </section>
        )}

        {sections.map(({ c, items }) => (
          <section key={c.slug} className="sec reveal">
            <div className="sec-h" style={{ ["--c" as any]: c.color }}>
              <h2>{c[lang]}</h2>
              <Link href={`/c/${c.slug}`}>{t.seeAll} →</Link>
            </div>
            <div className="grid">
              {items.map((a) => (
                <ArticleCard key={a.id} a={L(a)} lang={lang} showCat={false} />
              ))}
            </div>
          </section>
        ))}
      </main>
      )}
    </>
  );
}
