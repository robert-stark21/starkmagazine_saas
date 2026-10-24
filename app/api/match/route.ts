import { getMatchDetail } from "@/lib/match";
import type { Match } from "@/lib/scores";

/** Details of one match for the Sports ticker popup: /api/match?id=espn-123&league=EPL */
export const dynamic = "force-dynamic";

const LEAGUES = new Set<Match["league"]>(["C1", "C2", "EPL", "LALIGA", "SERIEA", "VLEAGUE"]);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  const league = q.get("league") as Match["league"];
  if (!/^(espn|tsdb)-\d+$/.test(id) || !LEAGUES.has(league)) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    const d = await getMatchDetail(id, league);
    const age = d.state === "live" ? 15 : d.state === "pre" ? 300 : 3600;
    return Response.json(d, { headers: { "Cache-Control": `public, max-age=${age}` } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
