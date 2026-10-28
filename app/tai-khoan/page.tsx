import type { Metadata } from "next";
import Link from "next/link";
import { SectionsEditor } from "@/components/Account";
import { AccountCard } from "@/components/AccountCard";
import { SettingsTabs } from "@/components/SettingsTabs";
import { getAccount, getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { ownCategories } from "@/lib/own";
import { getPrefs } from "@/lib/prefs";
import { CATEGORIES } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Tài khoản & chuyên mục",
  robots: { index: false, follow: false },
};

/** Account card and section settings (these work without an account too, saved on the device). */
export default async function AccountPage() {
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
    <main className="wrap acct-page">
      <AccountCard lang={lang} session={session} />
      <SettingsTabs lang={lang} active="/tai-khoan" />
      <section id="muc" className="sec-settings">
        <h2>{vi ? "Chuyên mục của bạn" : "Your sections"}</h2>
        <SectionsEditor lang={lang} initial={initial} defaults={[...own.map((c) => c.slug), ...CATEGORIES.map((c) => c.slug)]} signedIn={!!session} />
        <p className="muted small">
          {vi ? "Muốn thêm nguồn tin hoặc tạo mục riêng? " : "Want to add sources or make your own section? "}
          <Link className="link" href="/tai-khoan/nguon">{vi ? "Vào Nguồn tin" : "Go to Sources"}</Link>
        </p>
      </section>
    </main>
  );
}
