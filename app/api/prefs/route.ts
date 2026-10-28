import { NextResponse, type NextRequest } from "next/server";
import { getUser, readToken, saveUser, SESSION_COOKIE } from "@/lib/auth";
import { formatPrefs, parsePrefs, prefsCookie } from "@/lib/prefs";

/** Saves the reader's sections: always in the cookie, and on the account when signed in. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { sec?: string };
  const value = formatPrefs(parsePrefs(String(body.sec ?? "")));
  const res = NextResponse.json({ ok: true, sec: value });
  res.cookies.set(prefsCookie(value));
  const s = readToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (s) {
    try {
      const user = await getUser(s.uid);
      if (user) {
        user.prefs = value;
        await saveUser(user);
      }
    } catch (e) {
      console.warn("[prefs] could not save to account:", String(e));
      return NextResponse.json({ ok: true, sec: value, synced: false }, { headers: res.headers });
    }
  }
  return res;
}
