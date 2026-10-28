import { decodeHTML } from "entities";

export function stripHtml(html: string): string {
  const text = (html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  // Decode all HTML entities (&agrave;, &#7897;, &#x1EA1;...), twice for double-escaped feeds.
  return decodeHTML(decodeHTML(text))
    .normalize("NFC")
    // WordPress-style shortcodes left in some feeds: [rsn-live-v2], [caption id="…"], [/embed].
    .replace(/\[\/?(?:[a-z][a-z0-9]*[-_][\w-]*|caption|embed|gallery|video|audio|playlist)(?:\s[^\]]*)?\]/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function excerpt(text: string, max = 180): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Minutes to read, at about 220 words per minute. */
export function readingTime(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 220));
}

const STOP = new Set(
  (
    "the a an and or of to in on for with is are was were be been it this that as at by from has have had " +
    "but not they their its will would can could said says about into more than also which who what when " +
    "và của là có được cho các những một trong với này đã không người khi đến từ để như về theo cũng tại " +
    "thì sẽ đang ra lại nhiều vào nên rằng bị năm nhưng do làm"
  ).split(" ")
);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ỵ"“0-9])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 400);
}

/** Simple extractive summary: picks the most representative sentences. */
export function summarize(text: string, count = 3): string[] {
  const sentences = splitSentences(text);
  if (sentences.length <= count) return sentences;
  const freq = new Map<string, number>();
  const words = (s: string) =>
    s.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((w) => w.length > 1 && !STOP.has(w)) ?? [];
  for (const s of sentences) for (const w of words(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scored = sentences.map((s, i) => {
    const ws = words(s);
    const score = ws.reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.max(4, ws.length);
    const position = i === 0 ? 1.5 : i < 3 ? 1.2 : 1;
    return { s, i, score: score * position };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

export function toId(link: string): string {
  return Buffer.from(link).toString("base64url");
}

export function fromId(id: string): string {
  return Buffer.from(id, "base64url").toString("utf8");
}
