import { getLiqPanel, type Coin, type ExId } from "@/lib/liq";

/** One liquidation card's data: /api/liq?coin=BTC&ex=okx (ex: okx, htx, gate, all). */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const coin = q.get("coin") as Coin, ex = q.get("ex") as ExId;
  if (!["BTC", "ETH"].includes(coin) || !["okx", "htx", "gate", "all"].includes(ex)) return Response.json({ error: "bad request" }, { status: 400 });
  const p = await getLiqPanel(coin, ex);
  return p ? Response.json(p, { headers: { "Cache-Control": "public, max-age=300" } }) : Response.json({ error: "unavailable" }, { status: 502 });
}
