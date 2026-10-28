import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getKindle, getLang } from "@/lib/lang";
import { Suspense } from "react";
import { AutoRefresh, CardPrefetch, CardTransitions, Grain, NavProgress, Spotlight } from "@/components/client";
import { Header } from "@/components/Header";
import { lastUpdated, REFRESH_SECONDS } from "@/lib/feeds";
import { Anton, Be_Vietnam_Pro, Grenze_Gotisch, JetBrains_Mono, Literata, Manrope, Nunito, Old_Standard_TT, Oswald, Playfair_Display, Space_Grotesk } from "next/font/google";
import { bgVars, themeCss } from "@/lib/themes";
import { getSettings } from "@/lib/prefs";
import { Analytics } from "@vercel/analytics/next";
import { Donate } from "@/components/Donate";
import { donateInfo } from "@/lib/donate";
import { jsonLd as toJsonLd, SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

// Self-hosted at build time (no request to Google at runtime), with Vietnamese glyphs.
// latin-ext holds ă, đ, ơ, ư: preloading it avoids a layout shift when it arrives late.
const manrope = Manrope({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-sans" });
// Book face for article text in Kindle mode (close to Kindle's Bookerly). Not preloaded:
// the browser only fetches it when Kindle mode actually uses it.
const literata = Literata({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-reading", preload: false });
// Theme fonts (lib/themes.ts). Not preloaded: a browser only downloads the one its theme uses.
const bevn = Be_Vietnam_Pro({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "500", "600", "700", "800"], display: "swap", variable: "--font-bevn", preload: false });
const nunito = Nunito({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-nunito", preload: false });
const oswald = Oswald({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-oswald", preload: false });
const grotesk = Space_Grotesk({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-grotesk", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-mono", preload: false });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-playfair", preload: false });
// "Báo xưa": blackletter masthead, condensed banner headlines, old book face for the text.
const gothic = Grenze_Gotisch({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["600", "800"], display: "swap", variable: "--font-gothic", preload: false });
const anton = Anton({ subsets: ["latin", "latin-ext", "vietnamese"], weight: "400", display: "swap", variable: "--font-anton", preload: false });
const oldStd = Old_Standard_TT({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "700"], style: ["normal", "italic"], display: "swap", variable: "--font-oldstd", preload: false });
const FONT_VARS = [bevn, nunito, oswald, grotesk, mono, playfair, gothic, anton, oldStd].map((f) => f.variable).join(" ");
const THEME_CSS = themeCss();

export const metadata: Metadata = {
  // Absolute base for share links (Open Graph); set NEXT_PUBLIC_SITE_URL to the real domain.
  metadataBase: new URL(SITE_URL),
  // Pages give their own title; "· STARK" is added after it.
  title: { default: `${SITE_NAME} · Tin tức tổng hợp`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["tin tức", "tin tức tổng hợp", "công nghệ", "crypto", "tài chính", "thể thao", "esport", "design", "UI/UX", "kiến trúc", "phim ảnh", "showbiz"],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "vi_VN",
    url: "/",
    title: `${SITE_NAME} · Tin tức tổng hợp`,
    description: SITE_DESCRIPTION,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: { card: "summary" },
  // Google Search Console / Bing Webmaster: paste the verification codes as env variables.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
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
  const donate = donateInfo();
  const { theme, scheme, bg } = await getSettings();
  // Search engines: who publishes the site, and its search box.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png` },
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, inLanguage: lang === "vi" ? "vi-VN" : "en", publisher: { "@id": `${SITE_URL}/#org` } },
    ],
  };
  return (
    <html
      lang={lang}
      data-theme={theme}
      data-scheme={scheme}
      data-pattern={bg.pattern || undefined}
      style={bgVars(bg) as React.CSSProperties}
      className={`${manrope.variable} ${literata.variable} ${FONT_VARS}${kindle ? " kindle" : ""}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
        <Grain />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Header lang={lang} updated={lastUpdated()} kindle={kindle} scheme={scheme} />
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
        {donate && <Donate info={donate} lang={lang} />}
        <Analytics />
      </body>
    </html>
  );
}
