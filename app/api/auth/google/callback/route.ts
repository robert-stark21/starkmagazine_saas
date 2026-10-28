import { NextResponse, type NextRequest } from "next/server";
import { googleEnabled, googleUser, saveUser, sessionCookie, sessionToken } from "@/lib/auth";
import { safeNext } from "@/lib/http";
import { formatPrefs, parsePrefs, PREFS_COOKIE, prefsCookie } from "@/lib/prefs";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (code = "google") => {
    const res = NextResponse.redirect(new URL(`/dang-nhap?error=${code}`, origin));
    res.cookies.delete("g_state");
    return res;
  };
  if (!googleEnabled()) return fail("google_off");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [want, next] = (req.cookies.get("g_state")?.value ?? "").split("|");
  if (!code || !state || state !== want) return fail();

  try {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    }).then((r) => r.json() as Promise<{ access_token?: string }>);
    if (!tok.access_token) return fail();
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tok.access_token}` },
    }).then((r) => r.json() as Promise<{ sub?: string; email?: string; email_verified?: boolean; name?: string }>);
    if (!info.sub) return fail();

    // Only a verified Google email may link to an existing account with that email.
    const user = await googleUser(info.sub, info.email_verified ? info.email : undefined, info.name ?? "");
    const res = NextResponse.redirect(new URL(safeNext(next, "/tai-khoan"), origin));
    res.cookies.delete("g_state");
    res.cookies.set(sessionCookie(sessionToken(user)));
    if (user.prefs) res.cookies.set(prefsCookie(user.prefs));
    else {
      user.prefs = formatPrefs(parsePrefs(req.cookies.get(PREFS_COOKIE)?.value));
      await saveUser(user);
    }
    return res;
  } catch (e) {
    console.error("[auth] google:", e);
    return fail();
  }
}
