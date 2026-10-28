import type { Metadata } from "next";
import { Section, WidgetToggles } from "@/components/Settings";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/prefs";
import { CATEGORIES } from "@/lib/sources";
import { WIDGETS } from "@/lib/widgets";

export const metadata: Metadata = { title: "Tiện ích", robots: { index: false, follow: false } };

export default async function WidgetsPage() {
  const [lang, { widgetsOff }] = await Promise.all([getLang(), getSettings()]);
  const names: Record<string, string> = { "": lang === "vi" ? "Trang chủ" : "Home", ...Object.fromEntries(CATEGORIES.map((c) => [c.slug, c[lang]])) };
  return (
    <Section title={lang === "vi" ? "Tiện ích" : "Widgets"}>
      <WidgetToggles lang={lang} widgets={WIDGETS.map((w) => ({ id: w.id, label: w[lang], where: [...w.where] }))} off={[...widgetsOff]} sectionNames={names} />
    </Section>
  );
}
