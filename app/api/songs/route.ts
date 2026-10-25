import { getHotSongs, songLinks, youtubeId } from "@/lib/ent";

/**
 * Hot songs for the Showbiz ticker: /api/songs (list), or /api/songs?id=<Spotify id>&q=<artist title>
 * for one song's popup (YouTube video and listening links).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id");
  if (id !== null) {
    const query = (q.get("q") ?? "").slice(0, 160);
    const title = q.get("title") ?? "", artist = q.get("artist") ?? "";
    if (!/^[A-Za-z0-9]{10,30}$/.test(id) || !query) return Response.json({ error: "bad request" }, { status: 400 });
    const video = await youtubeId(query);
    return Response.json({ video, links: songLinks({ id, title, artist }) }, { headers: { "Cache-Control": "public, max-age=86400" } });
  }
  const matches = await getHotSongs();
  return Response.json({ matches }, { headers: { "Cache-Control": "public, max-age=1800" } });
}
