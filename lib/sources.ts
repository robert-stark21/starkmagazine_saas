export type Lang = "vi" | "en";

export type Category = {
  slug: string;
  vi: string;
  en: string;
  color: string;
};

export type Source = {
  name: string;
  url: string;
  category: string;
  lang: Lang;
  region: "vn" | "intl";
  /** The feed has no pictures: take each article's og:image from its page. */
  pageImages?: boolean;
  /** No usable feed: url is a listing page read by this scraper (lib/scrapers.ts). */
  scrape?: import("./scrapers").ScraperName;
};

export const CATEGORIES: Category[] = [
  { slug: "cong-nghe", vi: "Công nghệ", en: "Tech", color: "#2563eb" },
  { slug: "crypto", vi: "Crypto", en: "Crypto", color: "#f59e0b" },
  { slug: "tai-chinh", vi: "Tài chính", en: "Finance", color: "#059669" },
  { slug: "chinh-tri", vi: "Chính trị", en: "Politics", color: "#991b1b" },
  { slug: "xa-hoi", vi: "Xã hội", en: "Society", color: "#64748b" },
  { slug: "the-thao", vi: "Thể thao", en: "Sports", color: "#dc2626" },
  { slug: "esport", vi: "E-sport", en: "Esports", color: "#65a30d" },
  { slug: "du-lich", vi: "Du lịch", en: "Travel", color: "#0ea5e9" },
  { slug: "suc-khoe", vi: "Sức khỏe", en: "Health", color: "#14b8a6" },
  { slug: "giao-duc", vi: "Giáo dục", en: "Education", color: "#ca8a04" },
  { slug: "design", vi: "Design", en: "Design", color: "#9333ea" },
  { slug: "ui-ux", vi: "UI/UX", en: "UI/UX", color: "#db2777" },
  { slug: "kien-truc", vi: "Kiến trúc", en: "Architecture", color: "#a16207" },
  { slug: "phim-anh", vi: "Phim ảnh", en: "Film", color: "#0891b2" },
  { slug: "showbiz", vi: "Showbiz", en: "Showbiz", color: "#be123c" },
  { slug: "inspiration", vi: "Inspiration", en: "Inspiration", color: "#ea580c" },
  { slug: "quang-cao", vi: "Quảng cáo", en: "Advertising", color: "#4f46e5" },
];

// Add or remove sources here. Feeds that fail are skipped silently.
export const SOURCES: Source[] = [
  // Chính trị: thời sự trong nước, chính trị thế giới.
  { name: "VnExpress Thời sự", url: "https://vnexpress.net/rss/thoi-su.rss", category: "chinh-tri", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Thời sự", url: "https://tuoitre.vn/rss/thoi-su.rss", category: "chinh-tri", lang: "vi", region: "vn" },
  { name: "Thanh Niên Chính trị", url: "https://thanhnien.vn/rss/chinh-tri.rss", category: "chinh-tri", lang: "vi", region: "vn" },
  { name: "VnExpress Thế giới", url: "https://vnexpress.net/rss/the-gioi.rss", category: "chinh-tri", lang: "vi", region: "vn" },
  { name: "BBC Politics", url: "https://feeds.bbci.co.uk/news/politics/rss.xml", category: "chinh-tri", lang: "en", region: "intl" },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "chinh-tri", lang: "en", region: "intl" },
  { name: "The Guardian Politics", url: "https://www.theguardian.com/politics/rss", category: "chinh-tri", lang: "en", region: "intl" },
  { name: "Politico", url: "https://rss.politico.com/politics-news.xml", category: "chinh-tri", lang: "en", region: "intl" },
  // Xã hội: đời sống, pháp luật.
  { name: "Dân trí Xã hội", url: "https://dantri.com.vn/rss/xa-hoi.rss", category: "xa-hoi", lang: "vi", region: "vn" },
  { name: "VnExpress Pháp luật", url: "https://vnexpress.net/rss/phap-luat.rss", category: "xa-hoi", lang: "vi", region: "vn" },
  { name: "Thanh Niên Đời sống", url: "https://thanhnien.vn/rss/doi-song.rss", category: "xa-hoi", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Pháp luật", url: "https://tuoitre.vn/rss/phap-luat.rss", category: "xa-hoi", lang: "vi", region: "vn" },
  { name: "The Guardian Society", url: "https://www.theguardian.com/society/rss", category: "xa-hoi", lang: "en", region: "intl" },
  // Du lịch
  { name: "VnExpress Du lịch", url: "https://vnexpress.net/rss/du-lich.rss", category: "du-lich", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Du lịch", url: "https://tuoitre.vn/rss/du-lich.rss", category: "du-lich", lang: "vi", region: "vn" },
  { name: "Dân trí Du lịch", url: "https://dantri.com.vn/rss/du-lich.rss", category: "du-lich", lang: "vi", region: "vn" },
  { name: "The Guardian Travel", url: "https://www.theguardian.com/travel/rss", category: "du-lich", lang: "en", region: "intl" },
  { name: "Condé Nast Traveler", url: "https://www.cntraveler.com/feed/rss", category: "du-lich", lang: "en", region: "intl" },
  // Sức khỏe
  { name: "VnExpress Sức khỏe", url: "https://vnexpress.net/rss/suc-khoe.rss", category: "suc-khoe", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Sức khỏe", url: "https://tuoitre.vn/rss/suc-khoe.rss", category: "suc-khoe", lang: "vi", region: "vn" },
  { name: "Dân trí Sức khỏe", url: "https://dantri.com.vn/rss/suc-khoe.rss", category: "suc-khoe", lang: "vi", region: "vn" },
  { name: "BBC Health", url: "https://feeds.bbci.co.uk/news/health/rss.xml", category: "suc-khoe", lang: "en", region: "intl" },
  { name: "NYT Well", url: "https://rss.nytimes.com/services/xml/rss/nyt/Well.xml", category: "suc-khoe", lang: "en", region: "intl" },
  // Giáo dục
  { name: "VnExpress Giáo dục", url: "https://vnexpress.net/rss/giao-duc.rss", category: "giao-duc", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Giáo dục", url: "https://tuoitre.vn/rss/giao-duc.rss", category: "giao-duc", lang: "vi", region: "vn" },
  { name: "Dân trí Giáo dục", url: "https://dantri.com.vn/rss/giao-duc.rss", category: "giao-duc", lang: "vi", region: "vn" },
  { name: "BBC Education", url: "https://feeds.bbci.co.uk/news/education/rss.xml", category: "giao-duc", lang: "en", region: "intl" },
  { name: "The Guardian Education", url: "https://www.theguardian.com/education/rss", category: "giao-duc", lang: "en", region: "intl" },
  // Công nghệ
  { name: "VnExpress Số hóa", url: "https://vnexpress.net/rss/so-hoa.rss", category: "cong-nghe", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Nhịp sống số", url: "https://tuoitre.vn/rss/nhip-song-so.rss", category: "cong-nghe", lang: "vi", region: "vn" },
  // RGB (rgb.vn): one feed per RGB section, filed under the matching section here.
  { name: "RGB", url: "https://rgb.vn/category/tech/feed/", category: "cong-nghe", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/howto/feed/", category: "cong-nghe", lang: "vi", region: "vn" },
  { name: "Thanh Niên Công nghệ", url: "https://thanhnien.vn/rss/cong-nghe.rss", category: "cong-nghe", lang: "vi", region: "vn" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "cong-nghe", lang: "en", region: "intl" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "cong-nghe", lang: "en", region: "intl" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "cong-nghe", lang: "en", region: "intl" },

  // Crypto
  { name: "Tạp chí Bitcoin", url: "https://tapchibitcoin.io/feed", category: "crypto", lang: "vi", region: "vn" },
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "crypto", lang: "en", region: "intl" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto", lang: "en", region: "intl" },
  { name: "Decrypt", url: "https://decrypt.co/feed", category: "crypto", lang: "en", region: "intl" },

  // Tài chính
  { name: "VnExpress Kinh doanh", url: "https://vnexpress.net/rss/kinh-doanh.rss", category: "tai-chinh", lang: "vi", region: "vn" },
  { name: "CafeF Chứng khoán", url: "https://cafef.vn/thi-truong-chung-khoan.rss", category: "tai-chinh", lang: "vi", region: "vn" },
  { name: "Thanh Niên Kinh tế", url: "https://thanhnien.vn/rss/kinh-te.rss", category: "tai-chinh", lang: "vi", region: "vn" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "tai-chinh", lang: "en", region: "intl" },
  { name: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", category: "tai-chinh", lang: "en", region: "intl" },

  // Thể thao
  { name: "VnExpress Thể thao", url: "https://vnexpress.net/rss/the-thao.rss", category: "the-thao", lang: "vi", region: "vn" },
  { name: "Thanh Niên Thể thao", url: "https://thanhnien.vn/rss/the-thao.rss", category: "the-thao", lang: "vi", region: "vn" },
  { name: "Bongda.com.vn", url: "https://bongda.com.vn/feed.rss", category: "the-thao", lang: "vi", region: "vn", pageImages: true },
  // Foreign football outlets, chosen because their pages give the full article text.
  { name: "The Guardian Football", url: "https://www.theguardian.com/football/rss", category: "the-thao", lang: "en", region: "intl" },
  { name: "Sky Sports Football", url: "https://www.skysports.com/rss/11095", category: "the-thao", lang: "en", region: "intl" },
  { name: "FourFourTwo", url: "https://www.fourfourtwo.com/feeds/all", category: "the-thao", lang: "en", region: "intl" },
  { name: "The Independent Football", url: "https://www.independent.co.uk/sport/football/rss", category: "the-thao", lang: "en", region: "intl" },
  { name: "Daily Mail Football", url: "https://www.dailymail.co.uk/sport/football/index.rss", category: "the-thao", lang: "en", region: "intl" },
  { name: "Football Italia", url: "https://football-italia.net/feed/", category: "the-thao", lang: "en", region: "intl" },

  // E-sport: esports and gaming news (IGN, Dot Esports and GameSpot block bots).
  // GameK: its Esport and PC-Console feeds; the home and Mobile-Social feeds are mostly gossip.
  { name: "GameK", url: "https://gamek.vn/esport.rss", category: "esport", lang: "vi", region: "vn" },
  { name: "GameK", url: "https://gamek.vn/pc-console.rss", category: "esport", lang: "vi", region: "vn" },
  { name: "Dexerto", url: "https://www.dexerto.com/feed/", category: "esport", lang: "en", region: "intl" },
  { name: "Esports Insider", url: "https://esportsinsider.com/feed", category: "esport", lang: "en", region: "intl" },
  { name: "PC Gamer", url: "https://www.pcgamer.com/rss/", category: "esport", lang: "en", region: "intl" },
  { name: "The Verge", url: "https://www.theverge.com/rss/games/index.xml", category: "esport", lang: "en", region: "intl" },
  { name: "Eurogamer", url: "https://www.eurogamer.net/feed", category: "esport", lang: "en", region: "intl" },
  { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed", category: "esport", lang: "en", region: "intl" },
  { name: "Thanh Niên Game", url: "https://thanhnien.vn/rss/cong-nghe/game.rss", category: "esport", lang: "vi", region: "vn" },
  { name: "Gamelade", url: "https://gamelade.vn/feed/", category: "esport", lang: "vi", region: "vn" },

  // Showbiz: Vietnamese and international entertainment news (People blocks bots; E! is mostly photo credits)
  { name: "VnExpress Giải trí", url: "https://vnexpress.net/rss/giai-tri.rss", category: "showbiz", lang: "vi", region: "vn" },
  { name: "Thanh Niên Giải trí", url: "https://thanhnien.vn/rss/giai-tri.rss", category: "showbiz", lang: "vi", region: "vn" },
  { name: "Tuổi Trẻ Giải trí", url: "https://tuoitre.vn/rss/giai-tri.rss", category: "showbiz", lang: "vi", region: "vn" },
  { name: "Kenh14 Star", url: "https://kenh14.vn/star.rss", category: "showbiz", lang: "vi", region: "vn" },
  { name: "Variety", url: "https://variety.com/feed/", category: "showbiz", lang: "en", region: "intl" },
  { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", category: "showbiz", lang: "en", region: "intl" },
  { name: "Billboard", url: "https://www.billboard.com/feed/", category: "showbiz", lang: "en", region: "intl" },
  { name: "Deadline", url: "https://deadline.com/feed/", category: "showbiz", lang: "en", region: "intl" },
  { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", category: "showbiz", lang: "en", region: "intl" },

  // Design
  { name: "Dezeen", url: "https://www.dezeen.com/feed/", category: "kien-truc", lang: "en", region: "intl" },
  { name: "designboom", url: "https://www.designboom.com/feed/", category: "design", lang: "en", region: "intl" },
  { name: "Creative Bloq", url: "https://www.creativebloq.com/feeds/all", category: "design", lang: "en", region: "intl" },
  { name: "Tạp chí Kiến trúc", url: "https://www.tapchikientruc.com.vn/feed", category: "kien-truc", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/inspiration/design/feed/", category: "design", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/inspiration/typography/feed/", category: "design", lang: "vi", region: "vn" },
  // ColorME: each post goes to Design or UI/UX by its title (see scrapers.ts); course ads are skipped.
  { name: "ColorME", url: "https://colorme.vn/blog", category: "design", lang: "vi", region: "vn", scrape: "colorme" },

  // UI/UX
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", category: "ui-ux", lang: "en", region: "intl" },
  { name: "Interaction Design Foundation", url: "https://ixdf.org/rss/site_news.xml", category: "ui-ux", lang: "en", region: "intl", pageImages: true },
  { name: "UX Collective", url: "https://uxdesign.cc/feed", category: "ui-ux", lang: "en", region: "intl" },
  { name: "Nielsen Norman Group", url: "https://www.nngroup.com/feed/rss/", category: "ui-ux", lang: "en", region: "intl" },
  { name: "UX Planet", url: "https://uxplanet.org/feed", category: "ui-ux", lang: "en", region: "intl" },
  // No usable feed (UXmatters' feeds stopped in 2024): read from the listing pages.
  { name: "UXmatters", url: "https://www.uxmatters.com/", category: "ui-ux", lang: "en", region: "intl", scrape: "uxmatters" },
  { name: "ColorME", url: "https://colorme.vn/blog?category=12", category: "ui-ux", lang: "vi", region: "vn", scrape: "colorme" }, // chuyên mục "UI UX"
  { name: "UX Foundation", url: "https://uxfoundation.vn/case-study", category: "ui-ux", lang: "vi", region: "vn", scrape: "uxfoundation" },

  // Kiến trúc (kiến trúc và nội thất)
  { name: "Kiến trúc Việt Nam", url: "https://kientrucvietnam.org.vn/feed/", category: "kien-truc", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/arcvibes/feed/", category: "kien-truc", lang: "vi", region: "vn" },
  { name: "Dezeen Interiors", url: "https://www.dezeen.com/interiors/feed/", category: "kien-truc", lang: "en", region: "intl" },
  { name: "ArchDaily", url: "https://feeds.feedburner.com/Archdaily", category: "kien-truc", lang: "en", region: "intl" },
  { name: "Architectural Digest", url: "https://www.architecturaldigest.com/feed/rss", category: "kien-truc", lang: "en", region: "intl" },

  // Phim ảnh
  // Moveek: film news and reviews from its listing pages (no feed).
  { name: "Moveek", url: "https://moveek.com/tin-tuc/", category: "phim-anh", lang: "vi", region: "vn", scrape: "moveek" },
  { name: "Moveek", url: "https://moveek.com/danh-gia-phim/", category: "phim-anh", lang: "vi", region: "vn", scrape: "moveek" },
  { name: "Tuổi Trẻ Điện ảnh", url: "https://tuoitre.vn/rss/dien-anh.rss", category: "phim-anh", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/news/entertaiment/feed/", category: "phim-anh", lang: "vi", region: "vn" },
  { name: "Thanh Niên Phim", url: "https://thanhnien.vn/rss/giai-tri/phim.rss", category: "phim-anh", lang: "vi", region: "vn" },
  { name: "Variety Film", url: "https://variety.com/v/film/feed/", category: "phim-anh", lang: "en", region: "intl" },
  { name: "The Guardian Film", url: "https://www.theguardian.com/film/rss", category: "phim-anh", lang: "en", region: "intl" },
  { name: "/Film", url: "https://www.slashfilm.com/feed/", category: "phim-anh", lang: "en", region: "intl" },
  { name: "Little White Lies", url: "https://lwlies.com/feed/", category: "phim-anh", lang: "en", region: "intl" },

  // Inspiration: beautiful work and cool tech for moodboards
  { name: "Đẹp Online", url: "https://dep.com.vn/feed/", category: "inspiration", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/showcase/feed/", category: "inspiration", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/news/art-news/feed/", category: "inspiration", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/news/thoi-trang/feed/", category: "inspiration", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/creative-library/feed/", category: "inspiration", lang: "vi", region: "vn" },
  { name: "Colossal", url: "https://www.thisiscolossal.com/feed/", category: "inspiration", lang: "en", region: "intl" },
  { name: "Booooooom", url: "https://www.booooooom.com/feed/", category: "inspiration", lang: "en", region: "intl" },
  { name: "Abduzeedo", url: "https://abduzeedo.com/rss.xml", category: "inspiration", lang: "en", region: "intl" },
  { name: "Behance", url: "https://www.behance.net/feeds/projects", category: "inspiration", lang: "en", region: "intl" },
  // Award-winning websites; no usable feeds, so their listings are read (lib/scrapers.ts).
  { name: "Awwwards", url: "https://www.awwwards.com/websites/sites_of_the_day/", category: "inspiration", lang: "en", region: "intl", scrape: "awwwards" },
  { name: "CSS Design Awards", url: "https://www.cssdesignawards.com/wotd-award-winners", category: "inspiration", lang: "en", region: "intl", scrape: "cssda" },
  { name: "Creative Boom", url: "https://www.creativeboom.com/feed/", category: "inspiration", lang: "en", region: "intl" },
  { name: "Yanko Design", url: "https://www.yankodesign.com/feed/", category: "inspiration", lang: "en", region: "intl" },
  { name: "designboom Tech", url: "https://www.designboom.com/technology/feed/", category: "inspiration", lang: "en", region: "intl" },
  { name: "Design Milk", url: "https://design-milk.com/feed/", category: "inspiration", lang: "en", region: "intl" },
  { name: "Minimalissimo", url: "https://minimalissimo.com/feed", category: "inspiration", lang: "en", region: "intl" },
  // Advertising: creative campaigns and ad films.
  { name: "Campaign Brief", url: "https://campaignbrief.com/feed/", category: "quang-cao", lang: "en", region: "intl" },
  { name: "Muse by Clios", url: "https://musebyclios.com/feed/", category: "quang-cao", lang: "en", region: "intl", pageImages: true },
  { name: "RGB", url: "https://rgb.vn/category/advertising/commercial-film/feed/", category: "quang-cao", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/advertising/campaign/feed/", category: "quang-cao", lang: "vi", region: "vn" },
  { name: "RGB", url: "https://rgb.vn/category/advertising/feed/", category: "quang-cao", lang: "vi", region: "vn" },
];

/** Categories shown as an image-first moodboard instead of a news grid. */
export const MOODBOARD = new Set(["inspiration"]);

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

/**
 * Short stable key for a source within a section (several feeds of one publisher, like
 * RGB, share it): readers switch sources off by this key.
 */
export function sourceKey(category: string, name: string): string {
  let h = 2166136261;
  for (const ch of `${category}|${name}`) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return (h >>> 0).toString(36).padStart(7, "0").slice(-7);
}
