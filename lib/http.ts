import type { NextRequest } from "next/server";

export const clientIp = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";

/** Only same-site relative paths, so ?next= can't send people to another site. */
export const safeNext = (n: string | null | undefined, fallback = "/") =>
  n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;
