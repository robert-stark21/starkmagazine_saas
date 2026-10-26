import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getKindle, getLang } from "@/lib/lang";
import { Suspense } from "react";
import { AutoRefresh, CardPrefetch, CardTransitions, Grain, NavProgress, Spotlight } from "@/components/client";
import { Header } from "@/components/Header";
import { lastUpdated, REFRESH_SECONDS } from "@/lib/feeds";
import { Literata, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

// Self-hosted at build time (no request to Google at runtime), with Vietnamese glyphs.
// latin-ext holds ă, đ, ơ, ư: preloading it avoids a layout shift when it arrives late.
const manrope = Manrope({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-sans" });
// Book face for article text in Kindle mode (close to Kindle's Bookerly). Not preloaded:
// the browser only fetches it when Kindle mode actually uses it.
const literata = Literata({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-reading", preload: false });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  // Absolute base for share links (Open Graph); set NEXT_PUBLIC_SITE_URL to the real domain.
  metadataBase: new URL(SITE_URL),
  title: "STARK · Tin tức tổng hợp",
  description: "Công nghệ, crypto, tài chính, thể thao, design, UI/UX và kiến trúc, cập nhật mỗi 10 phút.",
  openGraph: {
    siteName: "STARK",
    type: "website",
    locale: "vi_VN",
    title: "STARK · Tin tức tổng hợp",
    description: "Công nghệ, crypto, tài chính, thể thao, design, UI/UX và kiến trúc, cập nhật mỗi 10 phút.",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "STARK" }],
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16161a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const kindle = await getKindle();
  return (
    <html lang={lang} className={`${manrope.variable} ${literata.variable}${kindle ? " kindle" : ""}`}>
      <body>
        <Grain />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Header lang={lang} updated={lastUpdated()} kindle={kindle} />
        {children}
        <AutoRefresh seconds={REFRESH_SECONDS} />
        <Spotlight />
        <CardTransitions />
        <CardPrefetch />
        <footer className="foot-site">
          <div className="wrap">
            © STARK · {lang === "vi" ? "Nội dung thuộc về các nguồn báo gốc." : "All content belongs to the original publishers."}
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
