import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionsEditor } from "@/components/Settings";
import { getAccount, getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { ownCategories } from "@/lib/own";
import { getPrefs } from "@/lib/prefs";
import { CATEGORIES } from "@/lib/sources";

export const metadata: Metadata = { title: "Cài đặt chuyên mục", robots: { index: false, follow: false } };

/** Sections: on/off and order (works without an account too, saved on the device). */
export default async function SectionsPage() {
  const [lang, session, account] = await Promise.all([getLang(), getSession(), getAccount()]);
  const own = ownCategories(account);
  const prefs = await getPrefs(own.map((c) => c.slug));
  const vi = lang === "vi";
  const bySlug = new Map([...CATEGORIES, ...own].map((c) => [c.slug, c]));
  const initial = prefs.map((p) => {
    const c = bySlug.get(p.slug)!;
    return { slug: p.slug, hidden: p.hidden, label: p.slug.startsWith("u-") ? `★ ${c[lang]}` : c[lang], color: c.color };
  });
  return (
    <Section title={vi ? "Chuyên mục" : "Sections"}>
      <SectionsEditor lang={lang} initial={initial} defaults={[...own.map((c) => c.slug), ...CATEGORIES.map((c) => c.slug)]} signedIn={!!session} />
      <p className="muted small">
        {vi ? "Muốn thêm nguồn tin hoặc tạo mục riêng? " : "Want to add sources or make your own section? "}
        <Link className="link" href="/tai-khoan/nguon">{vi ? "Vào Nguồn tin" : "Go to Sources"}</Link>
      </p>
    </Section>
  );
}
