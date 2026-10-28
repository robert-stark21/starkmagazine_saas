/** Public address of the site, for share links, the sitemap and search engines. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "STARK";
export const SITE_DESCRIPTION =
  "Tin tức tổng hợp: công nghệ, crypto, tài chính, thể thao, esport, design, UI/UX, kiến trúc, phim ảnh và showbiz, cập nhật mỗi 10 phút.";

/** JSON-LD for a <script> tag; "<" is escaped so feed text can't close the tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
