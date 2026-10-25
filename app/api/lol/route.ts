import { getLolDetail, getLolMatches } from "@/lib/lol";

/**
 * LoL Esports for the E-sport page ticker: /api/lol (match list, polled every 30 seconds)
 * or /api/lol?id=<match id> (one match for the popup).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id !== null) {
    if (!/^\d{6,25}$/.test(id)) return Response.json({ error: "bad request" }, { status: 400 });
    try {
      const d = await getLolDetail(id);
      return Response.json(d, { headers: { "Cache-Control": `public, max-age=${d.state === "live" ? 15 : d.state === "pre" ? 300 : 3600}` } });
    } catch {
      return Response.json({ error: "unavailable" }, { status: 502 });
    }
  }
  const { matches, live } = await getLolMatches();
  return Response.json({ matches, live }, { headers: { "Cache-Control": `public, max-age=${live ? 15 : 120}` } });
}
