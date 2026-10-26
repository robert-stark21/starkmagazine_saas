import Link from "next/link";
import { getLang } from "@/lib/lang";

/** Shown for links that lead nowhere (a story removed by its source, a mistyped address). */
export default async function NotFound() {
  const vi = (await getLang()) === "vi";
  return (
    <main className="wrap nf">
      <p className="nf-code">404</p>
      <h1>{vi ? "Không tìm thấy bài viết" : "Story not found"}</h1>
      <p className="muted">
        {vi ? "Bài này có thể đã bị nguồn gốc gỡ xuống hoặc đường dẫn không đúng." : "The source may have taken it down, or the link is wrong."}
      </p>
      <Link href="/" className="chip on">{vi ? "Về trang chủ" : "Back to the front page"}</Link>
    </main>
  );
}
