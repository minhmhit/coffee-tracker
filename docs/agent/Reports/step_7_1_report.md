# STEP 7.1 REPORT — CLOUD-READINESS CODE HARDENING (`ORCHESTRATOR`, `ML SERVICE`, `WEB`)

- **Date:** 2026-11-25
- **Phase / Step:** Phase 7 — Step 7.1
- **Status:** COMPLETED & VERIFIED

---

## 1. Objectives & Confirmed Scope

Hardened all three services (`apps/orchestrator`, `apps/ml-service`, `apps/web`) for **$0/month Free-Tier cloud deployment** (Option A: Vercel Hobby + Neon PostgreSQL + Upstash Redis + Render Free + Hugging Face Spaces + GitHub Actions Cron + Telegram Webhook) while preserving **100% backward compatibility** with local Docker Compose (`QUEUE_MODE=bullmq`, `TELEGRAM_MODE=polling`).

---

## 2. Implemented Changes

### A. Security, Throttling & CORS (`apps/orchestrator`)

1. **`AdminApiKeyGuard` (`src/common/guards/admin-api-key.guard.ts`):**
   - Constant-time `crypto.timingSafeEqual` verification of `X-Admin-Key` against `process.env.ADMIN_API_KEY`.
   - Protects `POST /api/forecast/trigger`, `POST /api/admin/forecast/trigger`, `POST /api/alerts/briefing/trigger`, and `POST /api/ingestion/sync`.
2. **Rate Limiting (`@nestjs/throttler` in `src/app.module.ts`):**
   - Global default quota: `60 req/min` via `APP_GUARD` (`ThrottlerGuard`).
   - Stricter quotas: `5 req/min` on protected trigger/sync endpoints; `30 req/min` on Telegram webhook receiver.
3. **Strict CORS (`src/main.ts`):**
   - Parses comma-separated origins from `process.env.CORS_ORIGIN` when configured; falls back to wildcard `*` for local development when unset.

### B. Telegram Webhook Mode (`apps/orchestrator`)

- **`POST /api/alerts/telegram/webhook` (`src/alerts/alerts.controller.ts`):**
  - Verifies `X-Telegram-Bot-Api-Secret-Token` against `process.env.TELEGRAM_WEBHOOK_SECRET` with `crypto.timingSafeEqual`.
  - Delegates updates synchronously to `TelegramBotService.handleUpdate(update)`.
- **Long-Polling Guard (`src/main.ts`, `src/alerts/telegram-bot.service.ts`):**
  - When `TELEGRAM_MODE=webhook`, `getUpdates` polling is skipped on startup so Render Free instances do not hold unnecessary outbound loops.

### C. Queue Mode Abstraction & Upstash Protection (`apps/orchestrator`)

- **`src/common/queue-mode.ts`:**
  - Helpers `isDirectQueueMode()`, `isWebhookTelegramMode()`, `getBullWorkerOptions()`, and `buildBullConnectionConfig()`.
  - Supports Upstash `REDIS_URL` TLS (`rediss://`) with command-saving options (`stalledInterval: 300000`, `drainDelay: 30`) when `QUEUE_MODE=bullmq`.
  - Disables BullMQ worker `autorun`, skips repeatable cron registration (`IngestionScheduler`, `AlertScheduler`, `ForecastScheduler`), and uses `lazyConnect: true` + `retryStrategy: () => null` when `QUEUE_MODE=direct`.
- **Direct HTTP Pipeline (`src/ingestion/ingestion.controller.ts`, `src/ingestion/processors/ingestion.processor.ts`, `src/forecast/forecast.service.ts`, `src/alerts/schedulers/alert.scheduler.ts`):**
  - Added `POST /api/ingestion/sync` (`?job=weather|morning_domestic|night_london|monthly_climate|daily_ice_stocks`) executing adapters -> DB upsert -> inline `SignalsService` -> inline `AlertProcessor` when `QUEUE_MODE=direct` (or enqueueing BullMQ jobs locally).
  - Added `ForecastService.wakeMlService()` pre-pinging `GET ${ML_SERVICE_URL}/health` before `POST /api/v1/forecast/weekly` when `QUEUE_MODE=direct` or `ML_WAKE_BEFORE_FORECAST=true`.
- **Container Build Reliability (`apps/orchestrator/Dockerfile`):**
  - Added `ENV NODE_OPTIONS="--dns-result-order=ipv4first"` and resilient `pnpm` fetch settings (`fetch-retries=8`, `fetch-timeout=300000`, `network-concurrency=2`).

### D. ML Service Free-Tier Hardening (`apps/ml-service`)

- **`apps/ml-service/Dockerfile`:**
  - Respects dynamic `${PORT:-8000}` (`CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]`) and exposes `8000` & `7860` (Hugging Face Spaces).
  - Enforces single-threaded math libraries (`OMP_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `NUMEXPR_NUM_THREADS=1`) + `pip --default-timeout=300 --retries 10`.

### E. Web SSR Cold-Start & ISR Hardening (`apps/web`)

- **`src/app/page.tsx`:** Switched from `force-dynamic` to `export const revalidate = 300;` (5-minute ISR).
- **`src/lib/api.ts`:** Enforced `3500ms` abort timeout (`AbortSignal.timeout(3500)`) and `next: { revalidate: 300 }` on server-side `safeFetch`; updated `triggerForecastJob(adminKey?)` to pass `X-Admin-Key` and handle `401/403` cleanly.
- **`src/components/AuditTrailSection.tsx`:** Added an inline `X-Admin-Key` confirmation input panel when clicking "Yêu cầu chạy lại dự báo thủ công".

### F. Environment & Compose Parity

- Updated `.env.example` and `docker-compose.yml` with `QUEUE_MODE`, `REDIS_URL`, `TELEGRAM_MODE`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_API_KEY`, `CORS_ORIGIN`, and `ML_WAKE_BEFORE_FORECAST`.

---

## 3. Verification Results

| Check | Result | Details |
| :--- | :--- | :--- |
| Orchestrator Jest Suite | **PASS (12/12 suites, 108/108 tests)** | Includes new `admin-api-key.guard.spec.ts` and Step 7.1 Telegram webhook tests in `alerts-onboarding.spec.ts` |
| Orchestrator TypeScript Build | **PASS** | `pnpm --dir apps/orchestrator run build` exited `0` |
| ML Service Pytest (`python -m pytest -q`) | **PASS (19/19 tests)** | Verified inside `coffee_tracker_ml_service` with thread env vars (`OMP_NUM_THREADS=1`, etc.) |
| Web Lint & TypeCheck | **PASS** | `tsc --noEmit` & `next lint` (zero ESLint warnings/errors) |
| Web Standalone Build (Docker Linux) | **PASS** | `/` route built as ISR (`Revalidate: 5m`, `Expire: 1y`); runtime `Cache-Control: s-maxage=300, stale-while-revalidate=31535700`, `x-nextjs-cache: HIT` |
| 5-Container Stack Health & Sizes | **5/5 Healthy** | `postgres`, `redis`, `orchestrator` (`792MB`), `ml-service` (`829MB`), `web` (`282MB`) |
| Security `curl` Verification | **PASS** | `401` on missing/wrong `X-Admin-Key` & missing webhook secret; `200`/`202` on valid credentials |
| `QUEUE_MODE=direct` + `TELEGRAM_MODE=webhook` Smoke Check | **PASS** | Isolated Node run inside `coffee_tracker_orchestrator` returned HTTP `200` with live Open-Meteo sync (`mode: "direct"`, `syncedCount: 4`) |
