import type { Metadata } from "next";
import { ThemePicker } from "@/components/Account";
import { SettingsTabs } from "@/components/SettingsTabs";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/prefs";
import { THEMES } from "@/lib/themes";

export const metadata: Metadata = { title: "Giao diện", robots: { index: false, follow: true } };

export default async function ThemePage() {
  const [lang, { theme, scheme }] = await Promise.all([getLang(), getSettings()]);
  const vi = lang === "vi";
  return (
    <main className="wrap theme-page">
      <SettingsTabs lang={lang} active="/giao-dien" />
      <h1>{vi ? "Giao diện" : "Theme"}</h1>
      <p className="muted">{vi ? "Chọn kiểu giao diện hợp với bạn. Mỗi kiểu đều có chế độ sáng và tối." : "Pick the look that suits you. Each comes in light and dark."}</p>
      <ThemePicker
        lang={lang}
        theme={theme}
        scheme={scheme}
        themes={THEMES.map((t) => ({ id: t.id, name: t[lang], desc: vi ? t.descVi : t.descEn, font: t.font, radius: t.radius, light: t.light, dark: t.dark }))}
      />
    </main>
  );
}
