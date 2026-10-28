# Magazine · Trang tin tức tổng hợp

Next.js app gom tin từ ~30 nguồn RSS trong nước và quốc tế, chia 7 mục: Công nghệ, Crypto, Tài chính, Thể thao, Design, UI/UX, Nội thất.

- Tự lấy tin mới mỗi 10 phút (bộ nhớ đệm phía server + trang tự làm mới trên trình duyệt).
- Nút **VI / EN**: tin tiếng Anh được dịch sang tiếng Việt và ngược lại (Claude nếu có `ANTHROPIC_API_KEY`, nếu không thì Bing / Google miễn phí).
- Trang chi tiết: lấy toàn văn bài gốc, hiển thị **thời gian đọc** và **tóm tắt nhanh** 3 ý, có nút đọc bài gốc.
- Lọc theo 🇻🇳 Việt Nam / 🌐 Quốc tế trong từng mục. Hỗ trợ giao diện tối và điện thoại.

## Chạy thử

```bash
npm install
npm run dev          # http://localhost:3000, lấy tin thật
npm run dev:mock     # dữ liệu mẫu, không cần mạng
```

## Triển khai lên Vercel

1. Đẩy thư mục này lên một repo GitHub.
2. Vào vercel.com → Add New Project → chọn repo → Deploy. Không cần cấu hình thêm.

### Dịch bằng Claude (khuyên dùng)

Đặt biến môi trường `ANTHROPIC_API_KEY` thì Claude dịch trước; Bing / Google chỉ dùng khi Claude lỗi.

- Trên Vercel: Project → Settings → Environment Variables → thêm `ANTHROPIC_API_KEY`, rồi Redeploy.
- Chạy ở máy: tạo file `.env.local` với dòng `ANTHROPIC_API_KEY=...` (file này không bị đưa lên git).
- `TRANSLATE_MODEL` (tuỳ chọn) chọn model; mặc định `claude-haiku-5-5` (nhanh, rẻ), có thể đổi sang `claude-opus-5-5` nếu muốn bản dịch tốt nhất.

### Lưu bản dịch dùng chung (Vercel)

Kết nối một database Upstash Redis (miễn phí) vào project trên Vercel: tab **Storage** → **Create Database** → **Upstash for Redis** → gói Free → **Connect** với project → **Redeploy**. Vercel tự thêm biến `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Bản dịch được lưu 30 ngày và dùng chung cho mọi máy chủ, F5 không dịch lại. Không có Redis thì vẫn chạy, chỉ lưu tạm trên từng máy chủ.

## Thêm / bớt nguồn

Sửa danh sách `SOURCES` trong `lib/sources.ts`. Nguồn nào lỗi sẽ được bỏ qua.

## Cấu trúc

- `lib/sources.ts` — danh mục và nguồn RSS
- `lib/feeds.ts` — tải, gộp, lọc trùng, dịch tiêu đề
- `lib/fulltext.ts` — lấy toàn văn bài (Readability)
- `lib/text.ts` — thời gian đọc, tóm tắt
- `lib/translate.ts` — dịch theo lô, có cache
- `app/` — trang chủ, trang mục `/c/[slug]`, trang bài `/a/[id]`

## Bản thương mại (starkmagazine_saas)

Bản này giữ nguyên giao diện STARK và thêm:

- **Đăng nhập / đăng ký** bằng số điện thoại hoặc email + mật khẩu (trang `/dang-nhap`), và nút "Tiếp tục với Google".
- **Cá nhân hóa chuyên mục** (trang `/tai-khoan`, hoặc "＋ Tùy chỉnh" cuối menu): bật/tắt, sắp xếp lại. Chưa đăng nhập thì lưu trên thiết bị; đăng nhập thì lưu vào tài khoản và theo người dùng sang thiết bị khác.
- **SEO cơ bản**: tiêu đề/mô tả cho từng trang, `sitemap.xml`, `robots.txt`, Open Graph, dữ liệu cấu trúc (NewsArticle, WebSite).
- **Nút "Ủng hộ"** góc phải dưới, mở mã QR donate.

### Biến môi trường (Vercel → Settings → Environment Variables)

| Biến | Dùng cho |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis: lưu tài khoản (bắt buộc trên Vercel) và cache bản dịch |
| `AUTH_SECRET` | Chuỗi ngẫu nhiên dài để ký phiên đăng nhập (nên đặt; nếu thiếu sẽ suy ra từ token Redis) |
| `NEXT_PUBLIC_SITE_URL` | Tên miền thật, ví dụ `https://stark.vn` (cho sitemap, link chia sẻ) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Bật nút đăng nhập Google. Redirect URI: `<tên miền>/api/auth/google/callback` |
| `DONATE_QR` | Ảnh QR: đường dẫn trong `public/` (vd `/donate-qr.png`) hoặc URL |
| `DONATE_BANK`, `DONATE_ACCOUNT`, `DONATE_NAME`, `DONATE_NOTE` | Thông tin chuyển khoản hiện dưới QR (tùy chọn) |
| `DONATE_ENABLED=0` | Ẩn nút ủng hộ |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | Mã xác minh Google Search Console / Bing |

Chạy local không cần Redis: tài khoản lưu trong `.data/kv.json`.
