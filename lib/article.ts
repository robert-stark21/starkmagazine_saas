import type { Article } from "./feeds";
import { getFullText, type Block, type FullText } from "./fulltext";
import type { Lang } from "./sources";
import { readingTime, splitSentences, summarize } from "./text";
import { preferFor, translateMany } from "./translate";

/** Everything the article page needs below the headline, already translated. */
export type PreparedBody = { full: FullText | null; blocks: Block[]; summary: string[]; minutes: number };

/**
 * Full text, quick summary and translation of one article. Used by the article page and by
 * the warm-up (lib/warm.ts), so a warmed article renders from the caches at once.
 */
export async function prepareBody(article: Article, lang: Lang): Promise<PreparedBody> {
  const full = process.env.MOCK_FEEDS === "1" ? null : await getFullText(article.link);
  let blocks: Block[] = limitText(full?.blocks ?? splitParagraphs(article.text).map((text) => ({ type: "text", text })), 60);
  // A video from the feed goes first when the page itself had none.
  if (article.video && !blocks.some((b) => b.type === "video")) blocks = [{ type: "video", ...article.video }, ...blocks];
  const plain = blocks.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
  const minutes = readingTime(plain);
  let summary = summarize(plain, 3);

  if (article.lang !== lang) {
    // Translate summary, paragraphs and captions in one go.
    const parts = blocks.map((b) => (b.type === "text" ? b.text : b.caption ?? ""));
    const tr = await translateMany([...summary, ...parts], lang, { prefer: preferFor(article.category) });
    summary = tr.slice(0, summary.length);
    const out = tr.slice(summary.length);
    blocks = blocks.map((b, i) => (b.type === "text" ? { ...b, text: out[i] } : b.caption ? { ...b, caption: out[i] } : b));
  }
  return { full, blocks, summary, minutes };
}

/** Keeps at most `max` text blocks (images in between are kept). */
function limitText(blocks: Block[], max: number): Block[] {
  let n = 0;
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.type === "text" && ++n > max) break;
    out.push(b);
  }
  return out;
}

function splitParagraphs(text: string): string[] {
  const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  // One long block: group sentences into paragraphs of three.
  const s = splitSentences(text);
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 3) out.push(s.slice(i, i + 3).join(" "));
  return out.length ? out : parts;
}
