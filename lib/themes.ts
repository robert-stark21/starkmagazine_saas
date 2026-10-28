/**
 * Reader themes. "default" is the original STARK look (its colours live in globals.css);
 * the others override the colour variables here, and globals.css adds their shapes and
 * fonts under [data-theme="…"]. Each theme has a light and a dark palette; the reader picks
 * Light, Dark or Auto (follows the device).
 */
export type Palette = { bg: string; surface: string; text: string; muted: string; line: string; accent: string; brand: string };
export type Theme = {
  id: string;
  vi: string;
  en: string;
  descVi: string;
  descEn: string;
  /** CSS font variable for body text (from next/font in app/layout.tsx). */
  font?: string;
  radius: string;
  light: Palette;
  dark: Palette;
};

export const THEMES: Theme[] = [
  {
    id: "default",
    vi: "Mặc định",
    en: "Default",
    descVi: "Giao diện STARK gốc: gọn, hiện đại.",
    descEn: "The original STARK look: clean and modern.",
    radius: "14px",
    light: { bg: "#fafaf9", surface: "#ffffff", text: "#18181b", muted: "#71717a", line: "#e7e5e4", accent: "#111827", brand: "#cefe0c" },
    dark: { bg: "#0c0c0e", surface: "#16161a", text: "#f4f4f5", muted: "#a1a1aa", line: "#27272a", accent: "#fafafa", brand: "#cefe0c" },
  },
  {
    id: "tre",
    vi: "Trẻ trung",
    en: "Fresh",
    descVi: "Màu tím hồng rực rỡ, bo tròn, năng động.",
    descEn: "Vivid violet and pink, rounded and lively.",
    font: "var(--font-bevn)",
    radius: "20px",
    light: { bg: "#f7f5ff", surface: "#ffffff", text: "#1e1b4b", muted: "#6b6b8f", line: "#e6e1fb", accent: "#7c3aed", brand: "#f472b6" },
    dark: { bg: "#110d24", surface: "#1b1636", text: "#f5f3ff", muted: "#a5a1c9", line: "#2e2852", accent: "#c4b5fd", brand: "#f472b6" },
  },
  {
    id: "de-doc",
    vi: "Dễ đọc",
    en: "Easy read",
    descVi: "Chữ to, tương phản cao, nút lớn. Hợp người lớn tuổi.",
    descEn: "Larger text, high contrast, big buttons. Easy on the eyes.",
    radius: "10px",
    light: { bg: "#fbfaf6", surface: "#ffffff", text: "#0a0a0a", muted: "#3f3f46", line: "#d4d4d8", accent: "#1d4ed8", brand: "#facc15" },
    dark: { bg: "#000000", surface: "#121212", text: "#ffffff", muted: "#d4d4d8", line: "#3f3f46", accent: "#93c5fd", brand: "#facc15" },
  },
  {
    id: "cute",
    vi: "Cute",
    en: "Cute",
    descVi: "Pastel hồng, bo tròn mềm mại, dễ thương.",
    descEn: "Soft pastel pink, extra round and sweet.",
    font: "var(--font-nunito)",
    radius: "24px",
    light: { bg: "#fff6f9", surface: "#ffffff", text: "#4a2b3a", muted: "#a07a8c", line: "#fbdbe6", accent: "#ec4899", brand: "#fbcfe8" },
    dark: { bg: "#1f1419", surface: "#2a1c23", text: "#fde7f0", muted: "#c9a3b5", line: "#45303a", accent: "#f9a8d4", brand: "#f9a8d4" },
  },
  {
    id: "ngau",
    vi: "Ngầu",
    en: "Bold",
    descVi: "Đen đỏ, góc cạnh, chữ in hoa mạnh mẽ.",
    descEn: "Black and red, sharp edges, strong capitals.",
    radius: "2px",
    light: { bg: "#f2f0ed", surface: "#ffffff", text: "#0a0a0a", muted: "#57534e", line: "#1c1917", accent: "#dc2626", brand: "#dc2626" },
    dark: { bg: "#050505", surface: "#0f0f0f", text: "#fafafa", muted: "#a8a29e", line: "#292524", accent: "#ef4444", brand: "#ef4444" },
  },
  {
    id: "cong-nghe",
    vi: "Công nghệ",
    en: "Tech",
    descVi: "Xanh neon trên nền tối, font kỹ thuật, lưới mờ.",
    descEn: "Neon cyan, technical fonts and a faint grid.",
    font: "var(--font-grotesk)",
    radius: "6px",
    light: { bg: "#f3f7fa", surface: "#ffffff", text: "#0b1220", muted: "#5b6b80", line: "#d9e2ec", accent: "#0891b2", brand: "#22d3ee" },
    dark: { bg: "#060b14", surface: "#0c1422", text: "#e2f3ff", muted: "#7f93ad", line: "#1a2a40", accent: "#22d3ee", brand: "#22d3ee" },
  },
];

export type Scheme = "auto" | "light" | "dark";
export const THEME_COOKIE = "theme";
export const SCHEME_COOKIE = "scheme";

export const getTheme = (id?: string | null) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const parseScheme = (s?: string | null): Scheme => (s === "light" || s === "dark" ? s : "auto");

const vars = (p: Palette, scheme: "light" | "dark") =>
  `--bg:${p.bg};--surface:${p.surface};--text:${p.text};--muted:${p.muted};--line:${p.line};--accent:${p.accent};--brand:${p.brand};color-scheme:${scheme};`;

/** CSS for every theme except the default (whose colours are in globals.css). Kindle mode wins. */
export function themeCss(): string {
  return THEMES.filter((t) => t.id !== "default")
    .map((t) => {
      const sel = `:root[data-theme="${t.id}"]:not(.kindle)`;
      const base = `${sel}{${vars(t.light, "light")}--radius:${t.radius};${t.font ? `--font-sans:${t.font};` : ""}}`;
      const dark = vars(t.dark, "dark");
      return `${base}${sel}[data-scheme="dark"]{${dark}}@media (prefers-color-scheme: dark){${sel}:not([data-scheme="light"]){${dark}}}`;
    })
    .join("\n");
}
