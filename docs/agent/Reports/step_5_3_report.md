# STEP REPORT: STEP 5.3 — TELEGRAM BOT SELF-SERVICE ONBOARDING & ENRICHED MORNING BRIEFING

- **Date / Time:** 2026-11-25 16:09 (UTC+7)
- **Phase / Step:** Phase 5 — Step 5.3
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Nâng cấp `AlertsModule` cho phép bất kỳ người dùng nào tự kết nối Telegram Bot từ web dashboard để nhận bản tin sáng `06:00`:
  - `TelegramBotService` với vòng lặp **Long-Polling an toàn (`getUpdates`)** kèm shutdown hook `OnModuleDestroy`, chỉ khởi chạy bên trong HTTP server chính (`main.ts`) để tránh xung đột với CLI scripts và Jest.
  - Hỗ trợ đầy đủ 3 lệnh tương tác:
    - `/start` (kể cả `/start subscribe` từ deep link): UPSERT `telegram_subscribers` (`is_active = true`), gửi lời chào cá nhân hóa và phát ngay 1 bản tin mẫu hoàn chỉnh.
    - `/stop`: Tắt đăng ký (`is_active = false`) lịch sự.
    - `/today`: Trả tức thời bản tin tổng hợp (Giá + Thời tiết + Nhận định + Dự báo).
- Tạo `MorningBriefingService` dùng chung cho Broadcast `06:00`, lệnh `/today`, lệnh `/start` và endpoint xem trước `GET /api/alerts/telegram-info`.
- Nâng cấp `AlertFormatter.formatMorningBriefing` hiển thị gọn gàng 4 phần rõ ràng trên màn hình di động (`< 4096` ký tự):
  1. **Giá cà phê hôm nay** (Đắk Lắk + biến động ngày + Lâm Đồng, Gia Lai, Đắk Nông + London M1/Spread + Tỷ giá + Basis).
  2. **Thời tiết Tây Nguyên hôm nay** (nhiệt độ, biên min–max, lượng mưa, điều kiện & lưu ý nông vụ).
  3. **Nhận định nhanh thị trường** (xu hướng & số liệu Tồn kho ICE/Cung cầu, Dầu Brent, Tỷ giá).
  4. **Dự báo giá minh bạch (6 tháng)** (mốc 1T / 3T / 6T kèm biên $P_{10}–P_{90}$ và độ tin cậy WF MAPE + Naive).
- Nâng cấp broadcast loop trong `AlertProcessor`: khử trùng lặp `chat_id` giữa `telegram_subscribers` và `.env` `TELEGRAM_CHAT_ID`, tuân thủ rate-limit (`50ms` / tin), và tự động đánh dấu `is_active = false` khi gặp lỗi `403 Forbidden` do người dùng chặn bot.
- Khắc phục triệt để độ trễ kết nối IPv6 trong Docker bằng `dns.setDefaultResultOrder('ipv4first')` trong `main.ts` và `NODE_OPTIONS=--dns-result-order=ipv4first` trong `docker-compose.yml`.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Chế độ nhận lệnh Bot:** Lựa chọn A — Telegram Long-Polling (`getUpdates`) an toàn bên trong NestJS.
- **Bot Username:** Xác nhận **`@minhmh_coffee_tracker_bot`** (auto-discovery qua `getMe` + cấu hình `TELEGRAM_BOT_USERNAME` trong `docker-compose.yml`).

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/alerts/telegram.service.ts` | `MODIFY` | Bổ sung `sendMessageToChat`, `getBotProfile` (`getMe`), `getUpdates` kèm `errorCode` 403 detection |
| `apps/orchestrator/src/alerts/alert-formatter.ts` | `MODIFY` | Thêm `escapeHtml`, `htmlToPlainPreview` và layout 4 phần mới cho `formatMorningBriefing` |
| `apps/orchestrator/src/alerts/morning-briefing.service.ts` | `CREATE` | Tổng hợp dữ liệu Market + Signals + Weather + Insights + Forecast thành HTML chuẩn |
| `apps/orchestrator/src/alerts/telegram-bot.service.ts` | `CREATE` | Long-polling `getUpdates` an toàn + xử lý `/start`, `/stop`, `/today` với `telegram_subscribers` |
| `apps/orchestrator/src/alerts/processors/alert.processor.ts` | `MODIFY` | Broadcast đa người dùng khử trùng lặp + tự động vô hiệu hóa user `403 Forbidden` |
| `apps/orchestrator/src/alerts/alerts.controller.ts` | `MODIFY` | Bổ sung endpoint `GET /api/alerts/telegram-info` |
| `apps/orchestrator/src/alerts/alerts.module.ts` | `MODIFY` | Import `PrismaModule`, `InsightsModule` và export `MorningBriefingService`, `TelegramBotService` |
| `apps/orchestrator/src/main.ts` | `MODIFY` | Cấu hình `dns.setDefaultResultOrder('ipv4first')`, shutdown hooks và khởi chạy `startPolling()` |
| `docker-compose.yml` | `MODIFY` | Bổ sung `NODE_OPTIONS=--dns-result-order=ipv4first` và `TELEGRAM_BOT_USERNAME` |
| `apps/orchestrator/src/alerts/test/alerts-onboarding.spec.ts` | `CREATE` | Unit tests cho formatter 4 phần, `/start`, `/stop`, `/today`, `403` deactivation & `/telegram-info` |

---

## 4. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

### 4.1. Build & Full Jest Suite (11 Suites, 95/95 Tests PASS)

```bash
$ pnpm --filter @coffee-tracker/orchestrator run build ; pnpm --filter @coffee-tracker/orchestrator test
PASS src/insights/test/insights.spec.ts (16.725 s)
PASS src/signals/test/signals.spec.ts (17.298 s)
PASS src/ingestion/test/weather-stocks.spec.ts (17.734 s)
PASS src/forecast/test/forecast.spec.ts (18.116 s)
PASS src/ingestion/test/climate-ingestion.spec.ts
PASS src/signals/test/signals-controller.spec.ts
PASS src/ingestion/test/ingestion.spec.ts (17.603 s)
PASS src/ingestion/test/ingestion-processor.spec.ts (18.481 s)
PASS src/ingestion/test/market-controller.spec.ts
PASS src/alerts/test/alerts.spec.ts (5.115 s)
PASS src/alerts/test/alerts-onboarding.spec.ts (22.309 s)

Test Suites: 11 passed, 11 total
Tests:       95 passed, 95 total
Time:        24.578 s
```

### 4.2. Live `GET /api/alerts/telegram-info` Response

```json
{
  "botUsername": "minhmh_coffee_tracker_bot",
  "deepLink": "https://t.me/minhmh_coffee_tracker_bot?start=subscribe",
  "briefingSchedule": "06:00 hàng ngày, giờ VN (Asia/Ho_Chi_Minh)",
  "cronExpression": "0 6 * * *",
  "activeSubscribersCount": 0,
  "telegramConfigured": true,
  "commands": [
    { "command": "/start", "description": "Đăng ký nhận điểm tin 06:00 sáng & xem ngay bản tin mẫu" },
    { "command": "/today", "description": "Xem nhanh giá, thời tiết Tây Nguyên, nhận định & dự báo hôm nay" },
    { "command": "/stop", "description": "Tạm dừng nhận điểm tin tự động hàng ngày" }
  ]
}
```

### 4.3. Live Enriched Telegram Message Delivery (`Message ID: 14`)

```text
[Bootstrap] Orchestrator running on port 3001 with CORS enabled
[TelegramBotService] Starting Telegram Bot long-polling listener (/start, /today, /stop)...
[AlertScheduler] Triggering immediate morning briefing dispatch...
[AlertProcessor] Processing alert job 18 [MORNING_BRIEFING]...
[TelegramService] Dispatching Telegram notification to chat ID 7583239264...
[TelegramService] Telegram message sent successfully! Message ID: 14
```

**Sample Rendered Briefing Preview:**
```text
☕ BẢN TIN THỊ TRƯỜNG CÀ PHÊ SÁNG — 2026-11-22
━━━━━━━━━━━━━━━━━━━━━━━━
📍 1. GIÁ CÀ PHÊ HÔM NAY
• Đắk Lắk (Benchmark): 71.800 đ/kg (🔴 -0.42%)
• Các tỉnh khác: Lâm Đồng: 71.200 | Gia Lai: 71.800 | Đắk Nông: 72.000 đ/kg
🌐 ICE London Robusta: M1: $4,565 | Spread (M1-M6): +337 USD/tấn
💵 Tỷ giá Vietcombank: 25.600 đ
⚖️ Basis (Nội địa - London): -45.064 đ/kg
📊 Trạng thái Thị trường: BACKWARDATION_STRONG (Biến động 30N: 0.44%/ngày)

🌤 2. THỜI TIẾT TÂY NGUYÊN HÔM NAY (Đắk Lắk)
• Trời quang, nắng ráo | Nhiệt độ: 28.4°C (biên 22–30°C) | Mưa: 0.0 mm
• Nông vụ: Thời tiết nắng ráo, thuận lợi cho hoạt động thu hái và phơi sấy cà phê nhân.

🧠 3. NHẬN ĐỊNH NHANH THỊ TRƯỜNG (TÍCH CỰC)
• Tồn kho & Cung cầu: 5.791 lô (57.910 tấn) (CUNG THẮT CHẶT (BACKWARDATION))
• Giá dầu Brent: $89.95/thùng (ĐI NGANG (+0.72% / 7N))
• Tỷ giá: 25.600 đ (ỔN ĐỊNH (+0.05% / 7N))

🔮 4. DỰ BÁO GIÁ MINH BẠCH (6 THÁNG): 
• 1 Tháng (T+4): 71.908 đ/kg (P10–P90: 70.549 – 75.434)
• 3 Tháng (T+12): 74.315 đ/kg (P10–P90: 71.795 – 82.556)
• 6 Tháng (T+26): 75.311 đ/kg (P10–P90: 73.578 – 96.132)
• Độ tin cậy mô hình: Kiểm toán Walk-Forward ngoài mẫu — MAPE (4 tuần: 1.36%, 12 tuần: 2.45%, 26 tuần: 5.68%), Pinball Loss: 0.0083. Lưu ý minh bạch: ở lần kiểm định ngoài mẫu gần nhất trên tập Walk-Forward 12 mốc, sai số trung vị chưa vượt trội hoàn toàn so với Naive Random Walk — cần theo dõi kèm dải rủi ro P10–P90.
━━━━━━━━━━━━━━━━━━━━━━━━
Hệ thống Coffee Tracker tự động cập nhật lúc 06:00 sáng • Gửi /today để xem lại hoặc /stop để tắt
```

---

## 5. Next Step

- Chuyển sang **STEP 5.4: Frontend UX Redesign (Price-First + Weather + Transparent Insights + Telegram Guide) & Full E2E Smoke Test** (dừng tại Ambiguity Check để xác nhận giao diện Dark Mode/Light Editorial và vị trí nút/section hướng dẫn Telegram).
