// Sample data for local previews without internet access (MOCK_FEEDS=1).
import { SOURCES } from "./sources";
import type { Article } from "./feeds";
import { excerpt, toId } from "./text";

const SAMPLES: Record<string, { vi: string[]; en: string[] }> = {
  "chinh-tri": {
    vi: ["Quốc hội thảo luận dự án luật về chuyển đổi số", "Việt Nam và Nhật Bản ký thỏa thuận hợp tác mới"],
    en: ["Parliament votes on new climate bill", "Leaders gather for regional summit"],
  },
  "xa-hoi": {
    vi: ["Hà Nội mở thêm 3 tuyến xe buýt điện", "TP.HCM thí điểm phố đi bộ cuối tuần mới"],
    en: ["City trials four-day school week"],
  },
  "du-lich": {
    vi: ["Đà Lạt vào mùa hoa dã quỳ", "5 cung đường ven biển đẹp nhất miền Trung"],
    en: ["The best islands to visit this winter", "A food lover's weekend in Bangkok"],
  },
  "suc-khoe": {
    vi: ["Ngủ đủ giấc giúp giảm nguy cơ tim mạch", "Bác sĩ khuyên gì khi trời chuyển lạnh"],
    en: ["Walking 7,000 steps a day linked to longer life"],
  },
  "giao-duc": {
    vi: ["Bộ Giáo dục công bố phương án thi tốt nghiệp mới", "Học sinh Việt Nam giành 4 huy chương vàng Olympic"],
    en: ["Universities expand online degree programmes"],
  },
  "cong-nghe": {
    vi: ["Điện thoại gập mới ra mắt với pin lớn hơn 30%", "Việt Nam thử nghiệm mạng 6G đầu tiên tại Hà Nội", "Trí tuệ nhân tạo giúp bác sĩ đọc phim X-quang nhanh gấp đôi"],
    en: ["Apple unveils new chips focused on on-device AI", "Open-source model tops coding benchmark", "The best laptops for students this year"],
  },
  crypto: {
    vi: ["Bitcoin vượt mốc giá mới sau quyết định của Fed", "Sàn giao dịch lớn ra mắt ví tự lưu ký cho người Việt"],
    en: ["Ethereum ETF inflows hit record week", "Stablecoin regulation bill clears key vote", "Solana network upgrade cuts fees in half"],
  },
  "tai-chinh": {
    vi: ["VN-Index tăng điểm mạnh nhờ nhóm ngân hàng", "Giá vàng trong nước lập đỉnh mới", "Lãi suất tiết kiệm tiếp tục giảm ở nhiều ngân hàng"],
    en: ["Stocks rally as inflation cools", "Oil prices slide on demand concerns"],
  },
  "the-thao": {
    vi: ["Đội tuyển Việt Nam thắng thuyết phục ở vòng loại", "V-League trở lại với nhiều bản hợp đồng mới"],
    en: ["Champions League: late winner seals dramatic comeback", "NBA season preview: five teams to watch"],
  },
  design: {
    vi: ["Bộ nhận diện mới của một thương hiệu cà phê Việt gây sốt"],
    en: ["Studio designs modular furniture from recycled ocean plastic", "Ten typefaces that defined this year", "Inside the redesign of a century-old museum"],
  },
  "ui-ux": {
    vi: [],
    en: ["How to write better microcopy for error states", "Designing accessible color systems", "Why your onboarding flow loses users", "A practical guide to design tokens"],
  },
  showbiz: {
    vi: ["Ca sĩ trẻ ra MV mới đạt top 1 thịnh hành", "Phim Việt cán mốc doanh thu trăm tỷ"],
    en: ["Box office: a quiet weekend for new releases", "Pop star announces world tour dates"],
  },
  esport: {
    vi: ["T1 vào tứ kết CKTG sau loạt Bo3 kịch tính", "Đội tuyển Việt Nam công bố đội hình dự giải quốc tế"],
    en: ["Worlds Swiss stage: day three recap", "The biggest game releases coming this month"],
  },
  "kien-truc": {
    vi: ["Căn hộ 60m² tại Sài Gòn với ánh sáng tự nhiên tràn ngập", "Nhà phố Hà Nội dùng gạch mộc và cây xanh"],
    en: ["A minimalist Kyoto house built around a courtyard", "Warm wood interiors for a Copenhagen apartment", "Seaside villa in Portugal blends concrete and linen"],
  },
};

const BODY_VI =
  "Đây là đoạn văn mẫu dùng để xem trước bố cục khi không có kết nối mạng. Bài viết thật sẽ được lấy từ nguồn RSS của báo. Nội dung này giúp kiểm tra thời gian đọc và phần tóm tắt. Các chuyên gia cho rằng xu hướng này sẽ còn tiếp tục trong thời gian tới. Người dùng được khuyên nên theo dõi thêm các thông tin chính thức. ";
const BODY_EN =
  "This is placeholder text used to preview the layout without network access. Real stories are pulled from each publisher's RSS feed. This content helps check the reading time and the summary box. Experts say the trend is likely to continue over the coming months. Readers are encouraged to follow official announcements for updates. ";

export function mockArticles(): Article[] {
  const out: Article[] = [];
  let n = 0;
  for (const [cat, langs] of Object.entries(SAMPLES)) {
    for (const lang of ["vi", "en"] as const) {
      const src = SOURCES.find((s) => s.category === cat && s.lang === lang) ?? SOURCES.find((s) => s.category === cat)!;
      langs[lang].forEach((title, i) => {
        n++;
        const link = `https://example.com/${cat}/${lang}/${i}`;
        const text = (lang === "vi" ? BODY_VI : BODY_EN).repeat(4 + i * 3);
        out.push({
          id: toId(link),
          title,
          link,
          text,
          excerpt: excerpt(text),
          image: `https://picsum.photos/seed/${cat}${lang}${i}/800/500`,
          source: src.name,
          category: cat,
          lang,
          region: lang === "vi" ? "vn" : "intl",
          published: new Date(Date.now() - n * 17 * 60000).toISOString(),
        });
      });
    }
  }
  return out.sort((a, b) => b.published.localeCompare(a.published));
}
