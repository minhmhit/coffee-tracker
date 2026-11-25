# STEP REPORT: STEP 6.2 — TECHNICAL SEO AUDIT, RICH SOCIAL PREVIEWS & CORE WEB VITALS

- **Date / Time:** 2026-11-25 17:02 (UTC+7)
- **Phase / Step:** Phase 6 — Step 6.2
- **Status:** `PASS (SEO 100, Accessibility 100, Best Practices 100, CLS 0)`

---

## 1. Goals & Scope Recap

- Tối ưu hóa `apps/web` (Next.js 15 App Router) phục vụ tìm kiếm tự nhiên tại Việt Nam (nhóm từ khóa *"giá cà phê hôm nay"*, *"giá cà phê Đắk Lắk"*, *"giá cà phê Tây Nguyên"*, *"dự báo giá cà phê"*) và hiển thị thẻ xem trước phong phú khi chia sẻ link qua Zalo, Facebook, Telegram.
- Chuẩn hóa phân cấp HTML5 ngữ nghĩa (`<h1> -> <h2> -> <h3>`), ARIA labels, `robots.txt`, `sitemap.xml`, `opengraph-image.tsx` (`1200x630`), dữ liệu có cấu trúc JSON-LD (`WebApplication` + `Dataset`) và triệt tiêu dịch chuyển bố cục (`CLS`).

---

## 2. Clarifications Resolved (Ambiguity Check)

1. **`NEXT_PUBLIC_SITE_URL`:** Tạo helper động `apps/web/src/lib/site-url.ts` đọc `process.env.NEXT_PUBLIC_SITE_URL` (fallback mặc định `https://coffee-tracker.vercel.app`, tuyệt đối không hardcode `localhost:3000` vào canonical/OG/sitemap) và ghi mẫu trong `.env.example` để người dùng cập nhật vào `.env` khi deploy.
2. **Ảnh OpenGraph:** Tạo ảnh PNG động `1200x630` bằng `apps/web/src/app/opengraph-image.tsx` theo phong cách Light Editorial (`#FDFBF7`, `#166534`).

---

## 3. Enhancements & Critical Bugs Resolved During Audit

1. **Nâng cấp `page.tsx` sang Server Component SSR (`force-dynamic`):**
   - Lần chạy Lighthouse đầu tiên trên mô hình client-only fetch cho thấy `CLS = 0.608` (skeleton thay đổi chiều cao khi dữ liệu tải xong) và crawler chỉ thấy khung chờ thay vì giá thật.
   - Chuyển `apps/web/src/app/page.tsx` thành Async Server Component nạp song song dữ liệu từ NestJS (`INTERNAL_API_URL || NEXT_PUBLIC_API_URL`) rồi truyền xuống `DashboardClient.tsx` -> dữ liệu giá cà phê Đắk Lắk, 4 tỉnh, thời tiết, nhận định và dự báo xuất hiện ngay trong HTML SSR đầu tiên và **`CLS` giảm từ `0.608` xuống `0`**.
2. **Sửa lỗi hiển thị `dod_pct` / `wow_pct` trong `TodayCoffeePriceHero.tsx`:**
   - Khi kiểm tra node CLS của Chrome thực tế, phát hiện `/api/market/latest` trả `changes.dod_pct` dạng hệ số thập phân (`-0.0042` = `-0.42%`) nên hiển thị cũ in nhầm `-0.00%`. Đã sửa thành `(dodPct * 100).toFixed(2)%` -> hiển thị chính xác **`-0.42%`**.
3. **Chuẩn hóa phân cấp Heading & Accessibility (`100/100`):**
   - Đảm bảo duy nhất 1 thẻ `<h1>` (kể cả khi đang tải fallback), tất cả 7 khối chính dùng `<h2>` (`PriceHistoryChart`, `SignalsTable`, `AuditTrailSection`, `WeatherTodaySection`, `MarketInsightsPanel`, `ForecastFanChart`, `TelegramConnectSection`), các tiêu đề phụ bên trong dùng `<h3>`, và thêm `aria-label` cho dialog modal Telegram.

---

## 4. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/web/src/lib/site-url.ts` | `CREATE` | Helper đọc động `NEXT_PUBLIC_SITE_URL` với fallback `https://coffee-tracker.vercel.app` |
| `apps/web/src/lib/date-format.ts` | `CREATE` | Dùng chung hàm định dạng giờ `Asia/Ho_Chi_Minh` giữa Server và Client Component |
| `apps/web/src/lib/api.ts` | `MODIFY` | Hỗ trợ `INTERNAL_API_URL` khi SSR đồng thời giữ `NEXT_PUBLIC_API_URL` ở browser |
| `apps/web/src/app/robots.ts` | `CREATE` | Sinh `/robots.txt` động trỏ tới `${siteUrl}/sitemap.xml` |
| `apps/web/src/app/sitemap.ts` | `CREATE` | Sinh `/sitemap.xml` động trỏ tới `${siteUrl}/` |
| `apps/web/src/app/opengraph-image.tsx` | `CREATE` | Sinh ảnh OpenGraph PNG `1200x630` phong cách Light Editorial |
| `apps/web/src/app/layout.tsx` | `MODIFY` | Hoàn thiện `Metadata` SEO tiếng Việt, OpenGraph/Twitter card, canonical & JSON-LD (`WebApplication` + `Dataset`) |
| `apps/web/src/components/DashboardClient.tsx` | `CREATE` | Tách phần tương tác client giữ trọn UI Step 6.1 và nhận initial SSR props |
| `apps/web/src/app/page.tsx` | `MODIFY` | Async Server Component (`force-dynamic`) nạp sẵn dữ liệu SSR không gây CLS |
| `apps/web/src/components/TodayCoffeePriceHero.tsx` | `MODIFY` | Luôn render `<h1>` ổn định & sửa hiển thị `(dodPct * 100).toFixed(2)%` (`-0.42%`) |
| `apps/web/src/components/WeatherTodaySection.tsx` | `MODIFY` | Thêm skeleton cố định chiều cao khi fallback loading |
| `apps/web/src/components/MarketInsightsPanel.tsx` | `MODIFY` | Thêm skeleton cố định chiều cao khi fallback loading |
| `apps/web/src/components/ForecastFanChart.tsx` | `MODIFY` | Thêm skeleton cố định chiều cao khi fallback loading |
| `apps/web/src/components/PriceHistoryChart.tsx` | `MODIFY` | Chuẩn hóa heading `<h2>` và thêm skeleton loading |
| `apps/web/src/components/SignalsTable.tsx` | `MODIFY` | Chuẩn hóa heading `<h2>` theo đúng cấu trúc `h1 -> h2` |
| `apps/web/src/components/AuditTrailSection.tsx` | `MODIFY` | Chuẩn hóa heading `<h2> -> <h3>` |
| `.env.example` | `MODIFY` | Ghi chú biến `NEXT_PUBLIC_SITE_URL=https://coffee-tracker.vercel.app` |

---

## 5. Verification Results

1. **Typecheck, Lint & Build:**
   - `pnpm --filter @coffee-tracker/web exec tsc --noEmit`: **PASS** (`exit 0`)
   - `pnpm --filter @coffee-tracker/web lint`: **PASS** (`✔ No ESLint warnings or errors`)
   - `pnpm --filter @coffee-tracker/web build`: **PASS** (`Compiled successfully in 6.5s`, `/`: `ƒ Dynamic SSR` `31.5 kB` / `134 kB`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml`, `/icon.svg` đều xuất thành công).
2. **Live Endpoint Inspection (`http://localhost:3000`):**
   - `GET /robots.txt`: `HTTP 200` (`Sitemap: https://coffee-tracker.vercel.app/sitemap.xml`).
   - `GET /sitemap.xml`: `HTTP 200` (XML chuẩn với `<loc>https://coffee-tracker.vercel.app/</loc>`).
   - `GET /opengraph-image`: `HTTP 200` (`image/png`, `61.212 bytes`).
   - `GET /`: `HTTP 200`, HTML SSR chứa `<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:title`, `og:image`, `<script type="application/ld+json">` (`WebApplication`, `Dataset`), kèm giá Đắk Lắk `71.800` và `-0.42%` hiển thị ngay trên bản HTML đầu tiên (không chứa `localhost` trong URL SEO).
3. **Lighthouse Mobile Audit (`npx lighthouse http://localhost:3000`):**
   - **SEO:** `100 / 100` (yêu cầu `>= 95`) — **PASS**
   - **Accessibility:** `100 / 100` (yêu cầu `>= 92`) — **PASS**
   - **Best Practices:** `100 / 100` (yêu cầu `>= 95`) — **PASS**
   - **Performance:** `79 / 100` (`CLS = 0`, `LCP = 2.9s`) — không có console errors.
