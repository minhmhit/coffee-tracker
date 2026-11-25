# STEP REPORT: STEP 6.1 — STITCH AI LIGHT-EDITORIAL INTEGRATION & SENIOR HARD OVERRIDES

- **Date / Time:** 2026-11-25 16:43 (UTC+7)
- **Phase / Step:** Phase 6 — Step 6.1
- **Status:** `PASS (Typecheck, Zero-Warning ESLint, Next Build & Backend APIs Verified; Visual Browser Review Awaits User Check)`

---

## 1. Goals & Scope Recap

- Tích hợp hệ thống thiết kế Light-Editorial từ bộ file Stitch AI (`docs/design/stitch/stitch_vietnamese_coffee_market_dashboard/`):
  - Nền giấy ngà ấm (`#FDFBF7` / `#FBF9F5`), thẻ trắng tinh (`#FFFFFF`), đường viền mảnh `1px solid #E5E7EB`, các hộp chỉ số phụ `#F5F3EF`.
  - Màu ngữ nghĩa tương phản cao chuẩn WCAG AA: xanh rừng trầm (`#166534` / `#3F6A52` kèm tint `#ECF3EF` / `#DCFCE7`) và đỏ thẫm (`#991B1B` kèm tint `#FEE2E2`).
  - Nạp font chuẩn tiếng Việt qua `next/font/google` (`Newsreader` tiêu đề serif, `Inter` thân bài, `JetBrains_Mono` số liệu `tabular-nums`, `display: 'swap'`).
  - Tối ưu cho người dùng lớn tuổi (50–70 tuổi): chữ nội dung `>= 16px`, nhãn & trục biểu đồ `>= 14px`, chữ giá chuẩn Đắk Lắk `44px–52px`, tương tác chạm được trên biểu đồ SVG.
- Áp dụng nghiêm ngặt **4 Hard Overrides**:
  1. **Loại bỏ UI giả & nút quản trị gây nhiễu ở Header:** Không avatar, không chuông thông báo, không thanh điều hướng 5 tab ở đáy mobile; chuyển `"Yêu cầu chạy lại dự báo thủ công"` xuống cuối `AuditTrailSection.tsx`; Header giữ duy nhất thương hiệu, thời gian cập nhật và 1 nút **"Nhận tin Telegram"** (`sticky top-0` tránh chồng lấn).
  2. **Tiếng Việt dễ hiểu, bỏ thuật ngữ ML/tiếng Anh nổi bật:** Đổi `"BAYESIAN VECM"` -> `"Dự báo Giá Cà phê 6 Tháng"`, `"P50 Trung vị"` -> `"Mức giá dự kiến"`, `"P10 - P90"` -> `"Khoảng giá có thể dao động"`, `"BACKWARDATION"` -> `"Hàng giao ngay khan hiếm"` (giữ `(Backwardation)` làm chú thích nhỏ thứ cấp); khung **"Công bố Tính minh bạch"** dùng 3 gạch đầu dòng ngắn gọn `>= 16px`.
  3. **100% dữ liệu thật từ Backend (Zero Fabricated Copy):** Loại bỏ toàn bộ chuỗi mockup của Stitch (`"Mã: VN-DLK-ROB"`, `"Độ ẩm đất: 61%"`, `"42 điểm chốt giá"`, `"24 đại lý"`, `"Cước FOB Cảng Cát Lái"`, `"18.400 tấn"`, `"Áp suất 1.012 hPa"`, `"88% diện tích thu hái"`). Thẻ thứ 4 trong nhận định sử dụng dữ liệu khí hậu thật từ `InsightsService` (**Khí hậu & Lượng mưa Tây Nguyên** — `Open-Meteo + NOAA ONI`). Thống kê dưới biểu đồ lịch sử tính động từ dữ liệu thật trả về bởi `/api/market/history`.
  4. **Giữ đầy đủ `SignalsTable` & `AuditTrailSection` (mở sẵn theo Choice B):** Hiển thị nguyên vẹn ở cuối trang với bảng cuộn ngang `overflow-x-auto` trên mobile và `WF MAPE` chính xác (`1.36%`, `2.45%`, `5.68%` — khớp trực tiếp DB `forecast_runs`).

---

## 2. Clarifications Resolved (Ambiguity Check)

1. **Đường dẫn Stitch AI:** `docs/design/stitch/stitch_vietnamese_coffee_market_dashboard/` (`DESIGN.md`, desktop & mobile `code.html` / `screen.png`) — Đã xác nhận.
2. **Hiển thị phần phân tích chuyên sâu cuối trang:** **Lựa chọn B** — Luôn mở sẵn hoàn toàn ở cuối trang với bảng cuộn ngang sạch sẽ.
3. **Đơn vị `WF MAPE` trong DB:** Kiểm tra trực tiếp `forecast_runs.metrics` trong PostgreSQL xác nhận đang lưu sẵn theo phần trăm (`1.36`, `2.45`, `5.68`) — hiển thị trực tiếp `${val.toFixed(2)}%`.

---

## 3. Issues Diagnosed & Fixed

1. **Loại bỏ nguyên nhân cảnh báo Next.js Dev Overlay (`1 Issue`) & console 404:**
   - Thêm biểu tượng ứng dụng `apps/web/src/app/icon.svg` để loại bỏ lỗi 404 `/favicon.ico` trên trình duyệt.
   - Chuyển `console.error(...)` ở luồng fallback mạng (`lib/api.ts`, `page.tsx`, `TelegramConnectSection.tsx`) sang `console.warn(...)` để không kích hoạt pill `"1 Issue"` của Next.js 15 DevTools khi API tạm thời chưa sẵn sàng.
   - Khởi tạo `lastUpdated` hoàn toàn trong `useEffect` (tránh React hydration mismatch SSR vs Client) và giữ cố định kích thước skeleton/QR container tránh nhảy bố cục.
2. **Cấu hình ESLint chính thức cho `next lint`:**
   - Bổ sung `.eslintrc.json` (`next/core-web-vitals`), cài `eslint@^8.57.1` & `eslint-config-next@^15.5.0`, và chuyển hiển thị mã QR PNG data-URL sang `next/image` (`unoptimized`) để đạt `0 warnings, 0 errors`.
3. **Xóa legacy file dư thừa:** Đã xóa `apps/web/src/components/KpiCards.tsx` (không còn sử dụng).

---

## 4. Files Created / Modified / Deleted

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/web/tailwind.config.js` | `MODIFY` | Bổ sung font tokens (`serif`, `sans`, `mono`) và bảng màu Stitch (`ivory`, `forest`, `crimson`) |
| `apps/web/src/app/globals.css` | `MODIFY` | Thiết lập nền `#FDFBF7`, mực `#18181B` và smooth scroll |
| `apps/web/src/app/layout.tsx` | `MODIFY` | Nạp `Newsreader`, `Inter`, `JetBrains_Mono` từ `next/font/google` (`vietnamese` + `swap`) |
| `apps/web/src/app/icon.svg` | `CREATE` | App icon vector tránh lỗi 404 `/favicon.ico` |
| `apps/web/.eslintrc.json` | `CREATE` | Kích hoạt cấu hình `next/core-web-vitals` |
| `apps/web/package.json` | `MODIFY` | Cài `eslint` và `eslint-config-next` |
| `apps/web/src/lib/api.ts` | `MODIFY` | Đổi catch log sang `console.warn` |
| `apps/web/src/components/Header.tsx` | `MODIFY` | Top bar tối giản theo Hard Override 1 (không avatar/chuông/nút Chạy Dự báo) |
| `apps/web/src/components/TodayCoffeePriceHero.tsx` | `MODIFY` | Hero giá chuẩn Đắk Lắk `44–52px`, 4 tỉnh + trung bình vùng + London M1 & USD/VND thật |
| `apps/web/src/components/WeatherTodaySection.tsx` | `MODIFY` | Thời tiết 4 tỉnh Tây Nguyên cỡ chữ lớn, bỏ dữ liệu giả, giữ khuyến nghị phơi sấy |
| `apps/web/src/components/MarketInsightsPanel.tsx` | `MODIFY` | 4 thẻ yếu tố thật (Dầu, Tồn kho ICE, Tỷ giá, Khí hậu & Mưa Tây Nguyên) tiếng Việt dễ hiểu |
| `apps/web/src/components/ForecastFanChart.tsx` | `MODIFY` | SVG trục trái `>= 14px`, đường dự kiến `#166534` `3.2px`, khung minh bạch 3 gạch đầu dòng |
| `apps/web/src/components/TelegramConnectSection.tsx` | `MODIFY` | Nút `52px` `#166534`, 3 bước rõ chữ `>= 16px`, mã QR thật dùng `next/image` `unoptimized` |
| `apps/web/src/components/PriceHistoryChart.tsx` | `MODIFY` | SVG Light-Editorial, trục `>= 14px`, thống kê cao/thấp/TB thật theo kỳ |
| `apps/web/src/components/SignalsTable.tsx` | `MODIFY` | Nhãn tiếng Việt + `(Backwardation/Contango)` phụ, bảng cuộn ngang mobile |
| `apps/web/src/components/AuditTrailSection.tsx` | `MODIFY` | Mở sẵn (Choice B), MAPE `%` khớp DB (`1.36%`, `2.45%`, `5.68%`), nút chạy dự báo phụ ở đáy |
| `apps/web/src/app/page.tsx` | `MODIFY` | Bố cục Stitch `max-w-6xl`, bỏ nav đáy mobile, footer chỉ dẫn nguồn thật |
| `apps/web/src/components/KpiCards.tsx` | `DELETE` | Xóa component legacy không còn dùng |

---

## 5. Verification Results (Executed After Final Edit)

1. **`pnpm --filter @coffee-tracker/web exec tsc --noEmit`:** **PASS** (exit code `0`, 0 errors).
2. **`pnpm --filter @coffee-tracker/web lint`:** **PASS** (`✔ No ESLint warnings or errors`).
3. **`pnpm --filter @coffee-tracker/web build`:** **PASS** (Next.js `15.5.29`, `Compiled successfully in 5.7s`, `Generating static pages (5/5)`, Route `/` `31 kB` / `134 kB` First Load JS, `/icon.svg` static).
4. **Live Backend API Check (`http://localhost:3001`):** HTTP `200` trên tất cả 6 endpoints (`/api/market/latest`, `/api/weather/today`, `/api/stocks/robusta/latest`, `/api/insights/latest`, `/api/forecast/latest`, `/api/alerts/telegram-info`).
5. **Production Server (`http://localhost:3000`):** Khởi chạy lại daemon phục vụ bản build Step 6.1 mới nhất.
6. **Ghi chú kiểm tra trình duyệt tự động:** Do phiên làm việc chưa nạp plugin/MCP `chrome_devtools`, kiểm tra giao diện trực quan trên trình duyệt thực tế (`desktop 1440px` & `mobile 375px`, xác nhận overlay `0 Issues`) cần User xem trực tiếp tại `http://localhost:3000`.
