import type { Metadata } from "next";
import Link from "next/link";
import { SourcesManager } from "@/components/Account";
import { Section, SiteSources } from "@/components/Settings";
import { getAccount } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/prefs";
import { CATEGORIES, SOURCES, sourceKey } from "@/lib/sources";

export const metadata: Metadata = { title: "Nguồn tin", robots: { index: false, follow: false } };

export default async function SourcesPage() {
  const [lang, account, { sourcesOff }] = await Promise.all([getLang(), getAccount(), getSettings()]);
  const vi = lang === "vi";
  // Site sources by section; several feeds of one publisher in a section count as one.
  const groups = CATEGORIES.map((c) => {
    const seen = new Map<string, { key: string; name: string; host: string; region: "vn" | "intl" }>();
    for (const s of SOURCES.filter((x) => x.category === c.slug)) {
      const key = sourceKey(c.slug, s.name);
      if (!seen.has(key)) seen.set(key, { key, name: s.name, host: new URL(s.url).hostname.replace(/^www\./, ""), region: s.region });
    }
    return { slug: c.slug, label: c[lang], color: c.color, sources: [...seen.values()] };
  });
  return (
    <>
      <Section title={vi ? "Nguồn của tôi" : "My sources"}>
        {account ? (
          <SourcesManager
            lang={lang}
            siteSections={CATEGORIES.map((c) => ({ slug: c.slug, label: c[lang], color: c.color }))}
            initialSections={account.sections ?? []}
            initialSources={account.sources ?? []}
          />
        ) : (
          <p className="muted">
            {vi ? "Đăng nhập để thêm nguồn tin riêng và tạo chuyên mục của bạn. " : "Sign in to add your own sources and sections. "}
            <Link className="link" href="/dang-nhap?next=/tai-khoan/nguon">{vi ? "Đăng nhập" : "Sign in"}</Link>
          </p>
        )}
      </Section>
      <Section title={vi ? "Nguồn có sẵn" : "Site sources"}>
        <SiteSources lang={lang} groups={groups} off={[...sourcesOff]} />
      </Section>
    </>
  );
}
