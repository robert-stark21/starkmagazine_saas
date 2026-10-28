import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { CATEGORIES, type Category } from "./sources";
import { getTheme, parseScheme, type Scheme } from "./themes";
import { WIDGETS } from "./widgets";

/**
 * Reader settings, each kept in its own cookie so pages render right on the first byte.
 * Signed-in readers also have them saved on their account (User.settings): they are
 * restored on login on any device.
 *
 *   sec     sections in reading order, hidden ones prefixed with "-": "crypto,-showbiz,…".
 *           Sections the reader made themselves are "u-<id>". New site sections go last.
 *   theme   theme id (lib/themes.ts)
 *   scheme  auto | light | dark
 *   wg      widgets switched off: "prices,scores"
 */
export const SETTING_KEYS = ["sec", "theme", "scheme", "wg"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export type Settings = Partial<Record<SettingKey, string>>;
export const PREFS_COOKIE = "sec";

export type SectionPref = { slug: string; hidden: boolean };

/** Sections in the reader's order. `extra` are the slugs of the reader's own sections. */
export function parsePrefs(raw: string | undefined | null, extra: string[] = []): SectionPref[] {
  const all = [...CATEGORIES.map((c) => c.slug), ...extra];
  const known = new Set(all);
  const out: SectionPref[] = [];
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const hidden = part.startsWith("-");
    const slug = hidden ? part.slice(1) : part;
    if (!known.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, hidden });
  }
  // Sections the reader hasn't placed yet: their own new sections first, new site sections last.
  for (const s of extra) if (!seen.has(s)) out.unshift({ slug: s, hidden: false }), seen.add(s);
  for (const s of all) if (!seen.has(s)) out.push({ slug: s, hidden: false });
  return out;
}

export const formatPrefs = (list: SectionPref[]) => list.map((p) => (p.hidden ? "-" : "") + p.slug).join(",");

/** Cleans a value before it goes into a cookie or an account. Unknown sections are kept only if they look like the reader's own ("u-…"). */
export function cleanSetting(key: SettingKey, v: string): string {
  switch (key) {
    case "sec":
      return v
        .split(",")
        .filter((p) => /^-?[a-z0-9-]{1,40}$/.test(p))
        .slice(0, 80)
        .join(",");
    case "theme":
      return getTheme(v).id;
    case "scheme":
      return parseScheme(v);
    case "wg": {
      const ids = new Set<string>(WIDGETS.map((w) => w.id));
      return [...new Set(v.split(","))].filter((w) => ids.has(w)).join(",");
    }
  }
}

export const settingCookie = (key: SettingKey, value: string) => ({ name: key, value, path: "/", sameSite: "lax" as const, maxAge: 31536000 });
/** Back-compat name used by the auth routes. */
export const prefsCookie = (value: string) => settingCookie("sec", value);

export function settingsFromRequest(req: NextRequest): Settings {
  const out: Settings = {};
  for (const k of SETTING_KEYS) {
    const v = req.cookies.get(k)?.value;
    if (v !== undefined) out[k] = cleanSetting(k, v);
  }
  return out;
}

/** After login: the account's settings come to this device; a first login saves this device's. Returns true when the account changed. */
export function syncOnLogin(res: NextResponse, req: NextRequest, user: { settings?: Settings }): boolean {
  if (user.settings && Object.keys(user.settings).length) {
    for (const k of SETTING_KEYS) {
      const v = user.settings[k];
      if (v !== undefined) res.cookies.set(settingCookie(k, v));
    }
    return false;
  }
  user.settings = settingsFromRequest(req);
  return true;
}

// ---------- Reading settings while rendering ----------
export async function getSettings() {
  const c = await cookies();
  return {
    sec: c.get("sec")?.value,
    theme: getTheme(c.get("theme")?.value).id,
    scheme: parseScheme(c.get("scheme")?.value) as Scheme,
    widgetsOff: new Set((c.get("wg")?.value ?? "").split(",").filter(Boolean)),
  };
}

export async function getPrefs(extra: string[] = []): Promise<SectionPref[]> {
  return parsePrefs((await cookies()).get("sec")?.value, extra);
}

/** Is this widget switched on (all are, by default)? */
export async function widgetOn(id: string): Promise<boolean> {
  return !(await getSettings()).widgetsOff.has(id);
}

/** The sections to show, in the reader's order (site sections plus the reader's own). */
export async function visibleCategories(own: Category[] = []): Promise<Category[]> {
  const bySlug = new Map([...CATEGORIES, ...own].map((c) => [c.slug, c]));
  return (await getPrefs(own.map((c) => c.slug))).filter((p) => !p.hidden).map((p) => bySlug.get(p.slug)!);
}
