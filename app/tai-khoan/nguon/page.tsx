import type { Metadata } from "next";
import Link from "next/link";
import { SourcesManager } from "@/components/Account";
import { SettingsTabs } from "@/components/SettingsTabs";
import { getAccount, getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { CATEGORIES } from "@/lib/sources";
import { AccountCard } from "@/components/AccountCard";

export const metadata: Metadata = { title: "Nguồn tin của tôi", robots: { index: false, follow: false } };

export default async function SourcesPage() {
  const [lang, session, account] = await Promise.all([getLang(), getSession(), getAccount()]);
  const vi = lang === "vi";
  return (
    <main className="wrap acct-page">
      <AccountCard lang={lang} session={session} />
      <SettingsTabs lang={lang} active="/tai-khoan/nguon" />
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
    </main>
  );
}
