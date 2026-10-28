import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, getUser, rateLimit, readToken, saveUser, SESSION_COOKIE, type User } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { discoverFeed, MAX_SECTIONS, MAX_SOURCES, SECTION_COLORS, sourceId, SourceError } from "@/lib/own";
import { getCategory } from "@/lib/sources";

/**
 * A signed-in reader's own sources and sections.
 *   GET                                  → { sections, sources }
 *   POST { action: "add", url, cat }     → finds the feed and adds it to a section
 *   POST { action: "remove", id }
 *   POST { action: "move", id, cat }     → puts a source in another section
 *   POST { action: "section-add", name, color? }
 *   POST { action: "section-rename", id, name }
 *   POST { action: "section-remove", id } (its sources are removed too)
 */
async function account(req: NextRequest): Promise<User | null> {
  const s = readToken(req.cookies.get(SESSION_COOKIE)?.value);
  return s ? getUser(s.uid) : null;
}

const view = (u: User) => ({ sections: u.sections ?? [], sources: u.sources ?? [] });
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const validCat = (u: User, cat: string) => !!getCategory(cat) || (u.sections ?? []).some((s) => `u-${s.id}` === cat);
const cleanName = (n: unknown) => String(n ?? "").trim().replace(/\s+/g, " ").slice(0, 40);

export async function GET(req: NextRequest) {
  const u = await account(req);
  return u ? NextResponse.json(view(u)) : err("auth", 401);
}

export async function POST(req: NextRequest) {
  const u = await account(req);
  if (!u) return err("auth", 401);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  u.sections ??= [];
  u.sources ??= [];
  try {
    switch (body.action) {
      case "add": {
        await rateLimit(clientIp(req), "source", 20);
        const cat = String(body.cat ?? "");
        if (!validCat(u, cat)) return err("bad_cat");
        if (u.sources.length >= MAX_SOURCES) return err("too_many");
        const found = await discoverFeed(String(body.url ?? ""));
        const id = sourceId(found.url);
        if (u.sources.some((s) => s.id === id)) return err("exists");
        u.sources.push({ id, ...found, cat, added: new Date().toISOString() });
        break;
      }
      case "remove":
        u.sources = u.sources.filter((s) => s.id !== body.id);
        break;
      case "move": {
        const cat = String(body.cat ?? "");
        if (!validCat(u, cat)) return err("bad_cat");
        u.sources = u.sources.map((s) => (s.id === body.id ? { ...s, cat } : s));
        break;
      }
      case "section-add": {
        const name = cleanName(body.name);
        if (!name) return err("name");
        if (u.sections.length >= MAX_SECTIONS) return err("too_many_sections");
        const color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : SECTION_COLORS[u.sections.length % SECTION_COLORS.length];
        u.sections.push({ id: randomBytes(4).toString("hex"), name, color });
        break;
      }
      case "section-rename": {
        const name = cleanName(body.name);
        if (!name) return err("name");
        u.sections = u.sections.map((s) => (s.id === body.id ? { ...s, name } : s));
        break;
      }
      case "section-remove":
        u.sections = u.sections.filter((s) => s.id !== body.id);
        u.sources = u.sources.filter((s) => s.cat !== `u-${body.id}`);
        break;
      default:
        return err("action");
    }
  } catch (e) {
    if (e instanceof SourceError) return err(e.code);
    if (e instanceof AuthError) return err(e.code, 429);
    console.error("[sources]", e);
    return err("server", 500);
  }
  await saveUser(u);
  return NextResponse.json(view(u));
}
