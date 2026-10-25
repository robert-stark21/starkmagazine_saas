import { getMonthMovies, getMovieDetail } from "@/lib/ent";

/** Films opening this month, for the Film ticker: /api/movies, or /api/movies?slug=<Moveek slug> for one film. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (slug !== null) {
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return Response.json({ error: "bad request" }, { status: 400 });
    try {
      return Response.json(await getMovieDetail(slug), { headers: { "Cache-Control": "public, max-age=21600" } });
    } catch {
      return Response.json({ error: "unavailable" }, { status: 502 });
    }
  }
  const matches = (await getMonthMovies()).map((m) => ({ ...m, id: m.slug }));
  return Response.json({ matches }, { headers: { "Cache-Control": "public, max-age=1800" } });
}
