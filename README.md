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

## Thêm / bớt nguồn

Sửa danh sách `SOURCES` trong `lib/sources.ts`. Nguồn nào lỗi sẽ được bỏ qua.

## Cấu trúc

- `lib/sources.ts` — danh mục và nguồn RSS
- `lib/feeds.ts` — tải, gộp, lọc trùng, dịch tiêu đề
- `lib/fulltext.ts` — lấy toàn văn bài (Readability)
- `lib/text.ts` — thời gian đọc, tóm tắt
- `lib/translate.ts` — dịch theo lô, có cache
- `app/` — trang chủ, trang mục `/c/[slug]`, trang bài `/a/[id]`
