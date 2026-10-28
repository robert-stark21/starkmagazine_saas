import { NextResponse, type NextRequest } from "next/server";
import { getUser, readToken, saveUser, SESSION_COOKIE } from "@/lib/auth";
import { cleanSetting, SETTING_KEYS, settingCookie, type Settings } from "@/lib/prefs";

/**
 * Saves reader settings ({ sec?, theme?, scheme?, wg? }): always in cookies, and on the
 * account when signed in.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const changed: Settings = {};
  for (const k of SETTING_KEYS) if (typeof body[k] === "string") changed[k] = cleanSetting(k, body[k] as string);
  const res = NextResponse.json({ ok: true, ...changed });
  for (const [k, v] of Object.entries(changed)) res.cookies.set(settingCookie(k as keyof Settings, v!));
  const s = readToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (s && Object.keys(changed).length) {
    try {
      const user = await getUser(s.uid);
      if (user) {
        user.settings = { ...user.settings, ...changed };
        await saveUser(user);
      }
    } catch (e) {
      console.warn("[prefs] could not save to account:", String(e));
    }
  }
  return res;
}
