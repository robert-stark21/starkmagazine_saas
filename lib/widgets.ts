/** Widgets readers can switch off (Settings → Widgets). `where` is the section they appear on. */
export const WIDGETS = [
  { id: "prices", vi: "Thanh giá coin & vàng", en: "Coin & gold prices", where: ["", "crypto", "tai-chinh"] },
  { id: "liq", vi: "Bảng thanh lý BTC/ETH", en: "BTC/ETH liquidations", where: ["crypto"] },
  { id: "econ", vi: "Lịch kinh tế", en: "Economic calendar", where: ["tai-chinh"] },
  { id: "scores", vi: "Thanh tỉ số bóng đá", en: "Football scores", where: ["the-thao"] },
  { id: "lol", vi: "Lịch thi đấu LMHT", en: "LoL esports matches", where: ["esport"] },
  { id: "weather", vi: "Thời tiết điểm du lịch", en: "Weather at destinations", where: ["du-lich"] },
  { id: "movies", vi: "Phim đang chiếu", en: "In cinemas", where: ["phim-anh"] },
  { id: "songs", vi: "Thanh bài hát hot", en: "Hot songs", where: ["showbiz"] },
  { id: "charts", vi: "Bảng xếp hạng nhạc", en: "Music charts", where: ["showbiz"] },
] as const;

export type WidgetId = (typeof WIDGETS)[number]["id"];
