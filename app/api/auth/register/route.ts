import { NextResponse, type NextRequest } from "next/server";
import { AuthError, rateLimit, register, sessionCookie, sessionToken } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { formatPrefs, parsePrefs, PREFS_COOKIE } from "@/lib/prefs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { login?: string; password?: string; name?: string };
    await rateLimit(clientIp(req), "register", 5);
    // A new account keeps the sections the visitor already picked on this device.
    const prefs = formatPrefs(parsePrefs(req.cookies.get(PREFS_COOKIE)?.value));
    const user = await register(String(body.login ?? ""), String(body.password ?? ""), String(body.name ?? ""), prefs);
    const res = NextResponse.json({ ok: true, name: user.name });
    res.cookies.set(sessionCookie(sessionToken(user)));
    return res;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.code === "rate" ? 429 : 400 });
    console.error("[auth] register:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
