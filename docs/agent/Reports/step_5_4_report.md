# STEP REPORT: STEP 5.4 — FRONTEND UX REDESIGN & E2E SMOKE TEST

- **Date / Time:** 2026-11-25 16:23 (UTC+7)
- **Phase / Step:** Phase 5 — Step 5.4
- **Status:** `PASS (Build, API/DB E2E & QR SVG Verified; Interactive Chrome DevTools Inspection Deferred to User)`

---

## 1. Goals & Scope Recap

- Tái cấu trúc hoàn toàn dashboard `apps/web` theo phân tầng thông tin lấy người trồng và người theo dõi thị trường làm trung tâm, đồng bộ dữ liệu trực tiếp từ NestJS APIs (`http://localhost:3001`):
  1. **Header (`Header.tsx`):** Bổ sung nút CTA **"Nhận tin Telegram"** mở hộp thoại hướng dẫn kết nối ngay trên màn hình bên cạnh nút làm mới và kích hoạt dự báo mới.
  2. **Tầng 1 — Giá Cà phê Hôm nay (`TodayCoffeePriceHero.tsx`):** Làm nổi bật giá chuẩn Đắk Lắk (`đ/kg`), biến động theo ngày (`DoD`) / 7 ngày (`WoW`), dải 4 tỉnh Tây Nguyên (Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông) và thông tin tham chiếu cần thiết (London Robusta M1, USD/VND, trung bình Tây Nguyên).
  3. **Tầng 2 — Thời tiết Tây Nguyên Hôm nay (`WeatherTodaySection.tsx`):** Đặt ngay dưới giá hôm nay; chọn linh hoạt 4 tỉnh Tây Nguyên, hiển thị nhiệt độ hiện tại & biên min–max, lượng mưa (`mm`), xác suất mưa (`%`), độ ẩm, tốc độ gió, icon điều kiện thời tiết (`weather_code`) và khuyến nghị phơi sấy/thu hoạch (`farming_impact_vi`).
  4. **Tầng 3 — Nhận định Thị trường & Dự báo Minh bạch (`MarketInsightsPanel.tsx` + `ForecastFanChart.tsx`):** Hiển thị nhận định tổng quan (`overall_stance`, `executive_summary`), 4 thẻ yếu tố chính (Giá dầu Brent, Tồn kho ICE & Cung–Cầu Robusta, Tỷ giá USD/VND, Thời tiết & Khí hậu) và khối **"Minh bạch Dự báo"** ngay trên biểu đồ Fan Chart 26 tuần kèm 3 mốc 1T / 3T / 6T.
  5. **Tầng 4 — Kết nối Bot Telegram Điểm tin 06:00 Sáng (`TelegramConnectSection.tsx`):** Hướng dẫn 3 bước, deep link `@minhmh_coffee_tracker_bot`, mã QR `<svg>` quét được tạo động bằng thư viện `qrcode`, danh sách lệnh `/start`, `/today`, `/stop` và khung xem trước bản tin mẫu trực tiếp (`sampleMessagePreview`).
  6. **Tầng 5 — Lịch sử Giá, Tín hiệu & Kiểm định Mô hình (`PriceHistoryChart.tsx`, `SignalsTable.tsx`, `AuditTrailSection.tsx`):** Đồng bộ giao diện sáng Light Editorial và sửa lỗi hiển thị đơn vị `wf_mape_4w/12w/26w` (hiển thị trực tiếp `%` như `1.36%`, `2.45%`, `5.68%` thay vì nhân thêm 100).

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Chủ đề Giao diện:** **Lựa chọn B (Light Editorial)** — ưu tiên hiển thị thông tin thiết yếu, thoáng và rõ chữ để thuận tiện cho User tinh chỉnh thêm giao diện ở Phase 6.
- **Vị trí Hướng dẫn Telegram:** **Cả hai vị trí** — nút **"Nhận tin Telegram"** mở modal ở `Header.tsx` VÀ thẻ `TelegramConnectSection` riêng ở Tầng 4 trên trang chính.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/web/package.json` | `MODIFY` | Bổ sung `qrcode` và `@types/qrcode` để sinh mã QR SVG thật cho deep link Telegram |
| `apps/web/src/app/globals.css` | `MODIFY` | Chuyển nền & chữ mặc định sang Light Editorial (`#fafaf9` / `#1c1917`) |
| `apps/web/src/app/layout.tsx` | `MODIFY` | Gỡ class `dark`, áp dụng nền `bg-stone-50 text-stone-900` |
| `apps/web/src/types/index.ts` | `MODIFY` | Thêm type contracts cho Weather Today, ICE Robusta Stocks, Insights, Forecast Transparency & Telegram Onboarding |
| `apps/web/src/lib/api.ts` | `MODIFY` | Thêm `fetchWeatherToday`, `fetchRobustaStockLatest`, `fetchInsightsLatest`, `fetchTelegramInfo` |
| `apps/web/src/components/TodayCoffeePriceHero.tsx` | `CREATE` | Tầng 1: Hero giá cà phê hôm nay chuẩn Đắk Lắk + 4 tỉnh + London M1 & tỷ giá |
| `apps/web/src/components/WeatherTodaySection.tsx` | `CREATE` | Tầng 2: Thời tiết Tây Nguyên 4 tỉnh trực quan với tab chuyển tỉnh & khuyến nghị nông vụ |
| `apps/web/src/components/MarketInsightsPanel.tsx` | `CREATE` | Tầng 3a: Tổng quan stance + 4 thẻ phân tích Dầu, Tồn kho ICE, Tỷ giá & Thời tiết |
| `apps/web/src/components/TelegramConnectSection.tsx` | `CREATE` | Tầng 4 & Modal: Hướng dẫn 3 bước, mã QR SVG từ `qrcode`, lệnh bot & bản tin mẫu |
| `apps/web/src/components/Header.tsx` | `MODIFY` | Thiết kế lại Light Editorial + thêm nút "Nhận tin Telegram" |
| `apps/web/src/components/ForecastFanChart.tsx` | `MODIFY` | Light Editorial SVG Fan Chart + khối "Minh bạch Dự báo" + delta `%` theo mốc |
| `apps/web/src/components/PriceHistoryChart.tsx` | `MODIFY` | Chuyển sang Light Editorial (lưới, series toggle, tooltip) |
| `apps/web/src/components/SignalsTable.tsx` | `MODIFY` | Chuyển sang Light Editorial dễ đọc |
| `apps/web/src/components/AuditTrailSection.tsx` | `MODIFY` | Chuyển Light Editorial + sửa bug nhân `100` ở `wf_mape_4w/12w/26w` |
| `apps/web/src/app/page.tsx` | `MODIFY` | Gắn kết đầy đủ 5 tầng thông tin + modal Telegram hỗ trợ phím `Escape` |

---

## 4. Verification & Smoke Test Results

### 4.1 Frontend Build, QR SVG & Style Scan

1. **`pnpm --filter @coffee-tracker/web build`** (sau khi dọn cache `.next`):
   - **Exit code:** `0` (`Next.js 15.5.29`, `Compiled successfully in 10.6s`, `Linting and checking validity of types`, `Generating static pages (4/4)`).
   - **Bundle `/`:** `25.3 kB` route JS, `128 kB` First Load JS.
2. **Production server (`pnpm --filter @coffee-tracker/web start`):**
   - Khởi động thành công trên `http://localhost:3000` (`✓ Ready in 807ms`).
3. **QR SVG Verification:**
   - Chạy `qrcode.toString('https://t.me/minhmh_coffee_tracker_bot?start=subscribe', { type: 'svg', width: 172, margin: 2 })` trả chuỗi SVG hợp lệ (`length=2005`, mở đầu `<svg xmlns="http://www.w3.org/`).
4. **Dark-class / MAPE Regression Scan:**
   - Kiểm tra 12 file UI đang hoạt động với pattern `bg-gray-9|text-gray-950|className="dark"|wf_mape_4w * 100` -> `STALE_DARK_OR_MAPE_HITS=0`.

### 4.2 End-to-End Stack Verification (Docker + REST APIs + DB)

- **Containers Healthy:** `coffee_tracker_postgres`, `coffee_tracker_redis` (`PONG`), `coffee_tracker_ml_service` (`GET /health` -> `{"status":"ok","service":"coffee-tracker-ml"}`), `coffee_tracker_orchestrator` (`Up, healthy`).
- **Live API Smoke Check (`http://localhost:3001`):**
  - `GET /api/market/latest` -> HTTP 200 (`286 bytes`, Đắk Lắk `71800` đ/kg, ngày `2026-11-22`, London M1 `$4565`, USD/VND `25600`)
  - `GET /api/weather/today` -> HTTP 200 (`2142 bytes`, ngày `2026-11-25`, `4` tỉnh, Đắk Lắk `28.4°C`, `"Trời quang, nắng ráo"`)
  - `GET /api/stocks/robusta/latest` -> HTTP 200 (`699 bytes`)
  - `GET /api/insights/latest` -> HTTP 200 (`5323 bytes`, stance `TÍCH CỰC`, `4` factor cards, WF MAPE `1.36%` / `2.45%` / `5.68%`)
  - `GET /api/forecast/latest` -> HTTP 200 (`4412 bytes`)
  - `GET /api/alerts/telegram-info` -> HTTP 200 (`3954 bytes`, `@minhmh_coffee_tracker_bot`, deep link `https://t.me/minhmh_coffee_tracker_bot?start=subscribe`)
- **PostgreSQL Table Row Counts:**
  - `raw_market_prices`: `3248`
  - `daily_weather`: `4`
  - `ice_robusta_stocks`: `1`
  - `forecast_runs`: `3`
  - `telegram_subscribers`: `0`

### 4.3 Automated Browser Inspection Note

- Đã điều phối `browser` subagent để mở và kiểm tra trực quan `http://localhost:3000`, nhưng máy chủ MCP `chrome_devtools` chưa được bật/cài trong phiên này (`Unable to complete the browser verification ... because the chrome_devtools MCP server is not available`). Do đó kiểm tra hiển thị trực tiếp trên trình duyệt Chrome (desktop + mobile `375px`) cần người dùng mở `http://localhost:3000` kiểm tra trực quan (hoặc bật plugin Chrome DevTools để agent tự kiểm tra sau này).

---

## 5. Notes for Phase 6

- Legacy file `apps/web/src/components/KpiCards.tsx` hiện không còn được import trên `page.tsx` (đã thay bằng `TodayCoffeePriceHero.tsx` + `WeatherTodaySection.tsx`) và có thể xoá sạch khi tinh chỉnh UI ở Phase 6.
- Toàn bộ bảng màu được tập trung quanh `stone-*` (trắng/xám ấm), `amber-*` (nâu cà phê), `emerald-*` (tăng/tích cực), `rose-*` (giảm/thận trọng), `sky-*` (mưa/Telegram), rất dễ tinh chỉnh tiếp ở Phase 6.
