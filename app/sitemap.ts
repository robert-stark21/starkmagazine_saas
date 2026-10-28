import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/feeds";
import { CATEGORIES } from "@/lib/sources";
import { SITE_URL } from "@/lib/site";

// Built on request: the article list changes every 10 minutes.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/c/${c.slug}`, lastModified: now, changeFrequency: "hourly" as const, priority: 0.8 })),
  ];
  // Recent stories; don't hold the sitemap up for more than 8s on a cold start.
  const articles = await Promise.race([getAllArticles(), new Promise<[]>((r) => setTimeout(() => r([]), 8000))]).catch(() => []);
  for (const a of articles.slice(0, 1000)) {
    pages.push({
      url: `${SITE_URL}/a/${a.id}`,
      lastModified: new Date(a.published),
      changeFrequency: "daily",
      priority: 0.6,
      ...(a.image ? { images: [a.image] } : {}),
    });
  }
  return pages;
}
