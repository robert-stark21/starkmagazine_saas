import { NextResponse, type NextRequest } from "next/server";
import { authenticate, AuthError, rateLimit, saveUser, sessionCookie, sessionToken } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { syncOnLogin } from "@/lib/prefs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { login?: string; password?: string };
    await rateLimit(clientIp(req), "login", 10);
    const user = await authenticate(String(body.login ?? ""), String(body.password ?? ""));
    const res = NextResponse.json({ ok: true, name: user.name });
    res.cookies.set(sessionCookie(sessionToken(user)));
    // The account's settings follow the reader to this device; a first login saves this device's.
    if (syncOnLogin(res, req, user)) await saveUser(user);
    return res;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "rate" ? 429 : 401 });
    console.error("[auth] login:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
