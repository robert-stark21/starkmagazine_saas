import Link from "next/link";

const TABS = [
  { href: "/tai-khoan", vi: "Chuyên mục", en: "Sections" },
  { href: "/tai-khoan/nguon", vi: "Nguồn tin", en: "Sources" },
  { href: "/tai-khoan/tien-ich", vi: "Tiện ích", en: "Widgets" },
  { href: "/giao-dien", vi: "Giao diện", en: "Theme" },
];

/** Tabs across the settings pages. */
export function SettingsTabs({ lang, active }: { lang: "vi" | "en"; active: string }) {
  return (
    <nav className="settings-tabs" aria-label={lang === "vi" ? "Cài đặt" : "Settings"}>
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={active === t.href ? "on" : ""} aria-current={active === t.href ? "page" : undefined}>
          {t[lang]}
        </Link>
      ))}
    </nav>
  );
}
