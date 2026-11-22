# LIVING PROJECT CONTEXT — COFFEE TRACKER

> **Agent Instruction:**
>
> 1. Read this ENTIRE file at the start of every step.
> 2. At the end of every step, UPDATE the sections marked `[AUTO-UPDATE]` before finishing.

---

## 1. Project Identity & Confirmed Stack

- **Project Name:** `coffee-tracker` (Daily Central Highlands Coffee Tracker & 6-Month Probabilistic Forecaster)
- **Timezone:** `Asia/Ho_Chi_Minh` (UTC+7)
- **Repository Structure:** Monorepo (`apps/orchestrator`, `apps/ml-service`, `apps/web`)
- **Package Manager (Node.js):** `pnpm` (v11.5.2)
- **Dependency Manager (Python):** `pip` + `.venv` + `requirements.txt`
- **Orchestrator (Control Plane):** NestJS (TypeScript, port `3001`) + BullMQ + Redis 7 (port `6379`) + Prisma ORM + PostgreSQL 17 (port `5432`)
- **ML Service (Compute Plane):** Python 3.12+ + FastAPI (port `8000`) + Pydantic v2 + pandas + statsmodels + LightGBM + pytest
- **Frontend (Presentation Plane):** Next.js (App Router, TypeScript, port `3000`)
- **Alerting:** Telegram Bot API

---

## 2. Current Progress Tracker `[AUTO-UPDATE]`

- **Active Phase:** Phase 1 — Data Ingestion & Historical Backfill (NestJS + BullMQ)
- **Last Completed Step:** `STEP 0.2` (PostgreSQL Schema & Prisma Migration Setup)
- **Next Step to Execute:** `STEP 1.1` (Market Data Scrapers, Fallback Adapters & Sanity Validator)
- **Overall Status:**
  - [x] Phase 0: Step 0.1 (Monorepo & Docker)
  - [x] Phase 0: Step 0.2 (DB Schema & Prisma)
  - [ ] Phase 1: Step 1.1 (Scrapers & Validator) | Step 1.2 (BullMQ Ingestion & Backfill) | Step 1.3 (Macro & Climate)
  - [ ] Phase 2: Step 2.1 (Daily Signals Worker) | Step 2.2 (Telegram Bot & Alerts)
  - [ ] Phase 3: Step 3.1 (FastAPI Contract & Weekly Features) | Step 3.2 (VECM/BVAR & Baselines) | Step 3.3 (LightGBM Quantile) | Step 3.4 (Walk-Forward Ensemble & Pytest)
  - [ ] Phase 4: Step 4.1 (NestJS Forecast Worker) | Step 4.2 (Dashboard REST APIs) | Step 4.3 (Next.js Dashboard & E2E Smoke Test)

---

## 3. Confirmed External Inputs & User Decisions `[AUTO-UPDATE]`

_(Must be filled via User answers during Ambiguity Checks — NEVER guessed by Agent)_

- **Node.js Package Manager:** `pnpm` (Confirmed in Step 0.1)
- **Python Environment Manager:** `pip` + `.venv` + `requirements.txt` (Confirmed in Step 0.1)
- **Host Ports:** Default ports `5432`, `6379`, `3001`, `8000`, `3000` (Confirmed free and active in Step 0.1)
- **ORM Choice:** `Prisma ORM` (Confirmed in Step 0.2)
- **Tracked Domestic Coffee Provinces:** 4 Central Highlands provinces: Đắk Lắk (benchmark chính), Lâm Đồng, Gia Lai, Đắk Nông (Confirmed in Step 0.2)
- **Primary VN Coffee Price Source:** `[PENDING USER CONFIRMATION]` (Candidate: giacaphe.com)
- **Fallback VN Coffee Price Source:** `[PENDING USER CONFIRMATION]`
- **ICE London Futures Source (M1/M3/M6):** `[PENDING USER CONFIRMATION]`
- **USD/VND Exchange Rate Source:** `[PENDING USER CONFIRMATION]` (Candidate: Vietcombank XML/API)
- **Historical Backfill File / Source (2018–present):** `[PENDING USER CONFIRMATION]`
- **Telegram Bot Config:** `[PENDING ENV SETUP]` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)

---

## 4. Active Architecture State `[AUTO-UPDATE]`

- **Containers Running & Healthy:**
  - `coffee_tracker_postgres` (PostgreSQL 17 on port 5432) — Healthy
  - `coffee_tracker_redis` (Redis 7 on port 6379) — Healthy
  - `coffee_tracker_orchestrator` (NestJS on port 3001) — Healthy
  - `coffee_tracker_ml_service` (FastAPI on port 8000) — Healthy
- **Database Tables Created & Active (PostgreSQL 17):**
  - `raw_market_prices` (Columns: `id`, `price_date`, `price_daklak`, `price_lamdong`, `price_gialai`, `price_daknong`, `price_avg`, `london_m1`, `london_m3`, `london_m6`, `usd_vnd`, `brent_oil`, `source_meta`, timestamps)
  - `macro_climate_monthly` (Columns: `month_date`, `oni_index`, `vn_rain_anomaly`, `br_rain_anomaly`, timestamps)
  - `daily_signals` (Columns: `signal_date` [FK -> `raw_market_prices.price_date` CASCADE], `basis`, `spread`, `volatility_30d`, `z_score`, `is_anomaly`, `regime`, `notes`, timestamps)
  - `forecast_runs` (Columns: `run_id` [UUID], `forecast_date`, `status` [SUCCESS/FAILED], `model_version`, `blend_weights`, `metrics`, `error_message`, timestamps)
  - `forecast_predictions` (Columns: `id`, `run_id` [FK -> `forecast_runs.run_id` CASCADE], `horizon_week`, `target_date`, `pred_p10`, `pred_p50`, `pred_p90`, `baseline_rw`, `baseline_futures`, `actual_price`, `error_pct`, created_at)
- **BullMQ Queues Active:** None yet (Target: `ingestion-queue`, `signals-queue`, `forecast-queue`, `alert-queue`)
- **FastAPI Endpoints Active:** `GET /health` (Healthy)
- **NestJS API Endpoints Active:** `GET /health` (Healthy)
- **NestJS Modules Active:** `HealthModule`, `PrismaModule` (Global)

---

## 5. Known Issues, Technical Debt & Deviations `[AUTO-UPDATE]`

- Không có lỗi tồn đọng. Tất cả 5 bảng đều dùng kiểu `DECIMAL` / `NUMERIC` chính xác, không dùng `Float`. Đã áp dụng `init_coffee_schema` migration thành công và kiểm tra bằng `psql`.

---

## 6. Step History Log `[AUTO-UPDATE]`

| Step | Date | Summary | Report Link |
| :--- | :--- | :------ | :---------- |
| — | — | Initialized project governance docs | — |
| `STEP 0.1` | 2026-11-22 | Monorepo scaffolding, Docker Compose 4 services, healthchecks PASS | [step_0_1_report.md](file:///F:/coffee_tracker/docs/agent/Reports/step_0_1_report.md) |
| `STEP 0.2` | 2026-11-22 | PostgreSQL schema 5 tables via Prisma ORM, migrations, zero float verified | [step_0_2_report.md](file:///F:/coffee_tracker/docs/agent/Reports/step_0_2_report.md) |

Confirm docs/agent/Context.md has been updated with new progress, artifacts, and next step (STEP 1.1).
