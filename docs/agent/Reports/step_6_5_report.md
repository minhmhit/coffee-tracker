# STEP REPORT: STEP 6.5 — TELEGRAM BOT (`@BotFather`) CONFIGURATION GUIDE & LIVE INTERACTIVE VERIFICATION

- **Date / Time:** 2026-11-25 17:55 (UTC+7)
- **Phase / Step:** Phase 6 — Step 6.5 (Final Step)
- **Status:** `PASS (11/11 Jest Suites 97/97 Tests PASS, Live getMyCommands PASS, Real In-App /start /today /stop & DB Updates Verified)`

---

## 1. Goals & Scope Recap

- Soạn tài liệu hướng dẫn tiếng Việt đầy đủ, copy-paste được ngay tại `docs/telegram_bot_setup.md` gồm 4 phần: tạo & cấu hình bot qua `@BotFather` (`/newbot`, `/setname`, `/setdescription`, `/setabouttext`, `/setuserpic`, `/setcommands`), kết nối `.env` & Docker, thao tác kiểm thử người dùng cuối, và xử lý lỗi (`409 Conflict`, IPv6 Docker, `403 Forbidden`).
- Tích hợp `TelegramService.setMyCommands` + `TelegramBotService.syncBotCommands` gọi tự động trong `onModuleInit` (bọc `try/catch` non-blocking, bỏ qua khi `NODE_ENV=test`) để luôn đồng bộ 3 nút menu lệnh tiếng Việt (`/start`, `/today`, `/stop`) trên app Telegram.
- Rebuild & khởi động lại `coffee_tracker_orchestrator` trong Docker và xác minh trực tiếp qua API `getMyCommands` + tương tác thực tế từ app Telegram.

---

## 2. Clarifications Resolved (Ambiguity Check)

1. **Phạm vi hướng dẫn `@BotFather`:** Đưa vào **cả hai** — quy trình `/newbot` từ đầu để tiện tái lập và cấu hình hồ sơ + menu lệnh `/setcommands` cho bot `@minhmh_coffee_tracker_bot`.
2. **Tự động đồng bộ `setMyCommands` khi NestJS khởi động:** **Xác nhận** — gọi non-blocking trong `TelegramBotService.onModuleInit()`.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/alerts/telegram.service.ts` | `MODIFY` | Bổ sung `TelegramBotCommand` và method `setMyCommands(commands)` gọi Telegram Bot API |
| `apps/orchestrator/src/alerts/telegram-bot.service.ts` | `MODIFY` | Triển khai `OnModuleInit` -> `syncBotCommands()` với `DEFAULT_TELEGRAM_COMMANDS` (`/start`, `/today`, `/stop`) |
| `apps/orchestrator/src/alerts/test/alerts-onboarding.spec.ts` | `MODIFY` | Bổ sung 2 test cases cho `syncBotCommands()` (gửi đúng lệnh + non-blocking khi lỗi mạng) |
| `apps/orchestrator/Dockerfile` | `MODIFY` | Thêm retry/concurrency `.npmrc` cho `pnpm install` trong Docker BuildKit |
| `docs/telegram_bot_setup.md` | `CREATE` | Cẩm nang 4 phần cấu hình `@BotFather`, kết nối `.env`, test lệnh & troubleshooting |

---

## 4. Verification Outputs

1. **Jest Unit Tests & TypeScript Build (`apps/orchestrator`):**
   - `pnpm --filter @coffee-tracker/orchestrator test`: **PASS** — **11/11 test suites passed, 97/97 tests passed** (`22.684 s`).
   - `pnpm --filter @coffee-tracker/orchestrator run build`: **PASS** (`nest build`).
   - `docker compose up -d --build --wait orchestrator`: **PASS** — `coffee_tracker_orchestrator` khởi động sạch ở trạng thái `Up (healthy)`.
2. **Startup Sync & Live Telegram API Verification:**
   - Startup log xác nhận:
     - `Starting Telegram Bot long-polling listener (/start, /today, /stop)...`
     - `Telegram setMyCommands succeeded (/start, /today, /stop)`
   - Live API `getMe` / `getWebhookInfo` / `getMyCommands` (không in token):
     - `getMe`: `{"ok":true,"username":"minhmh_coffee_tracker_bot","id":9036698448}`
     - `getWebhookInfo`: `{"ok":true,"url":"","pending_update_count":8}` -> sạch webhook, không xung đột `409 Conflict`.
     - `getMyCommands`: `{"ok":true,"result":[{"command":"start","description":"Đăng ký nhận điểm tin giá cà phê & thời tiết 06:00 mỗi sáng"},{"command":"today","description":"Xem ngay giá cà phê, thời tiết & nhận định hôm nay"},{"command":"stop","description":"Tạm dừng nhận bản tin tự động buổi sáng"}]}`.
3. **Live In-App Telegram Verification & PostgreSQL `telegram_subscribers`:**
   - Log thực tế từ tương tác trên app Telegram:
     - `17:53:34`: Nhóm `chatId=-5371622980` gửi `/start` -> gửi tin chào + bản tin mẫu (`Message IDs 26, 27`, `< 2s`).
     - `17:53:35–17:54:08`: Chat cá nhân `chatId=7583239264` gửi `/start` & `/today` -> gửi tin chào + bản tin chi tiết (`Message IDs 29–36`, `< 2s`).
     - `17:54:34`: Nhóm `chatId=-5371622980` gửi `/stop` -> gửi xác nhận tạm dừng (`Message ID: 38`, `< 1s`).
   - Trạng thái thực tế trong bảng PostgreSQL `telegram_subscribers`:
     - `7583239264` (`Mai`) -> `is_active = true`
     - `-5371622980` (`Mai`) -> `is_active = false`
