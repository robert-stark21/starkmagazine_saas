import { cookies } from "next/headers";
import { CATEGORIES, type Category } from "./sources";

/**
 * Which sections a reader sees, and in what order. Kept in the "sec" cookie so pages render
 * right on the first byte (signed-in readers also have it saved on their account, see
 * /api/prefs). Format: slugs in reading order, hidden ones prefixed with "-", e.g.
 * "crypto,cong-nghe,-showbiz". Sections added to the site later show up at the end.
 */
export const PREFS_COOKIE = "sec";

export type SectionPref = { slug: string; hidden: boolean };

export function parsePrefs(raw: string | undefined | null): SectionPref[] {
  const known = new Set(CATEGORIES.map((c) => c.slug));
  const out: SectionPref[] = [];
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const hidden = part.startsWith("-");
    const slug = hidden ? part.slice(1) : part;
    if (!known.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, hidden });
  }
  for (const c of CATEGORIES) if (!seen.has(c.slug)) out.push({ slug: c.slug, hidden: false });
  return out;
}

export function formatPrefs(list: SectionPref[]): string {
  return parsePrefs(list.map((p) => (p.hidden ? "-" : "") + p.slug).join(",")).map((p) => (p.hidden ? "-" : "") + p.slug).join(",");
}

export async function getPrefs(): Promise<SectionPref[]> {
  return parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
}

/** The sections to show, in the reader's order. */
export async function visibleCategories(): Promise<Category[]> {
  const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));
  return (await getPrefs()).filter((p) => !p.hidden).map((p) => bySlug.get(p.slug)!);
}

export const prefsCookie = (value: string) => ({
  name: PREFS_COOKIE,
  value,
  path: "/",
  sameSite: "lax" as const,
  maxAge: 31536000,
});
