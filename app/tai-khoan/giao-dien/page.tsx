import type { Metadata } from "next";
import { Section, ThemeSettings } from "@/components/Settings";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/prefs";
import { BG_PRESETS, PATTERNS, THEMES } from "@/lib/themes";

export const metadata: Metadata = { title: "Giao diện", robots: { index: false, follow: false } };

export default async function ThemePage() {
  const [lang, { theme, scheme, bg }] = await Promise.all([getLang(), getSettings()]);
  const vi = lang === "vi";
  return (
    <Section title={vi ? "Giao diện" : "Theme"}>
      <p className="muted small">{vi ? "Xem trước ngay trên trang, bấm Lưu để giữ lại." : "Previewed on the page as you choose; press Save to keep it."}</p>
      <ThemeSettings
        lang={lang}
        initial={{ theme, scheme, bg }}
        themes={THEMES.map((t) => ({ id: t.id, name: t[lang], desc: vi ? t.descVi : t.descEn, font: t.font, radius: t.radius, light: t.light, dark: t.dark }))}
        presets={BG_PRESETS.map((p) => ({ id: p.id, label: p[lang], light: p.light, dark: p.dark }))}
        patterns={PATTERNS.map((p) => ({ id: p.id, label: p[lang] }))}
      />
    </Section>
  );
}
