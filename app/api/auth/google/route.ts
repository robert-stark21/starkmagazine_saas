import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { googleEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/http";

/**
 * "Continue with Google": sends the reader to Google's sign-in page. Needs GOOGLE_CLIENT_ID
 * and GOOGLE_CLIENT_SECRET, with <site>/api/auth/google/callback as an authorised redirect URI.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!googleEnabled()) return NextResponse.redirect(new URL("/dang-nhap?error=google_off", origin));
  const state = randomBytes(16).toString("base64url");
  const next = safeNext(req.nextUrl.searchParams.get("next"), "/tai-khoan");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set({ name: "g_state", value: `${state}|${next}`, httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
