import type { Metadata } from "next";
import { WidgetToggles } from "@/components/Account";
import { SettingsTabs } from "@/components/SettingsTabs";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/prefs";
import { CATEGORIES } from "@/lib/sources";
import { WIDGETS } from "@/lib/widgets";
import { AccountCard } from "@/components/AccountCard";

export const metadata: Metadata = { title: "Tiện ích", robots: { index: false, follow: false } };

export default async function WidgetsPage() {
  const [lang, session, { widgetsOff }] = await Promise.all([getLang(), getSession(), getSettings()]);
  const names: Record<string, string> = { "": lang === "vi" ? "Trang chủ" : "Home", ...Object.fromEntries(CATEGORIES.map((c) => [c.slug, c[lang]])) };
  return (
    <main className="wrap acct-page">
      <AccountCard lang={lang} session={session} />
      <SettingsTabs lang={lang} active="/tai-khoan/tien-ich" />
      <WidgetToggles
        lang={lang}
        widgets={WIDGETS.map((w) => ({ id: w.id, label: w[lang], where: [...w.where] }))}
        off={[...widgetsOff]}
        sectionNames={names}
      />
    </main>
  );
}
