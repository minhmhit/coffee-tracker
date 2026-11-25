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
- **Orchestrator (Control Plane):** NestJS 11 (TypeScript, port `3001`) + BullMQ 5 + Redis 7 (port `6379`) + Prisma ORM + PostgreSQL 17 (port `5432`)
- **ML Service (Compute Plane):** Python 3.12+ + FastAPI (port `8000`) + Pydantic v2 + pandas + statsmodels + LightGBM + pytest
- **Frontend (Presentation Plane):** Next.js (App Router, TypeScript, port `3000`)
- **Alerting:** Telegram Bot API

---

## 2. Current Progress Tracker `[AUTO-UPDATE]`

- **Active Phase:** Phase 2 — Daily Signals Worker & Telegram Alerting
- **Last Completed Step:** `STEP 1.3` (Monthly Macro & Climate Ingestion: NOAA ONI & Rainfall Anomalies)
- **Next Step to Execute:** `STEP 2.1` (Daily Signals Worker & Risk Metrics Engine: Basis, Spread, 30d Volatility, Z-Score)
- **Overall Status:**
  - [x] Phase 0: Step 0.1 (Monorepo & Docker)
  - [x] Phase 0: Step 0.2 (DB Schema & Prisma)
  - [x] Phase 1: Step 1.1 (Scrapers & Validator - DONE)
  - [x] Phase 1: Step 1.2 (BullMQ Ingestion & Backfill - DONE)
  - [x] Phase 1: Step 1.3 (Macro & Climate Monthly - DONE)
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
- **Primary VN Coffee Price Source:** `https://giacaphe.com/gia-ca-phe-noi-dia/` (Confirmed & Verified in Step 1.1)
- **Fallback VN Coffee Price Source:** `https://vietnambiz.vn/gia-ca-phe.html` (Confirmed & Verified in Step 1.1)
- **ICE London Futures Source (M1/M3/M6):** `https://giacaphe.com/gia-ca-phe-truc-tuyen/` (Confirmed & Verified in Step 1.1)
- **USD/VND Exchange Rate Source:** Vietcombank XML Feed `https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx` (Confirmed & Verified in Step 1.1)
- **Brent Crude Oil Source:** Yahoo Finance API `https://query1.finance.yahoo.com/v8/finance/chart/BZ=F` (Confirmed & Verified in Step 1.1)
- **Price Sanity Rules:** Reject if day-over-day jump > ±15%, or price <= 0, or missing Đắk Lắk, or USD/VND outside [15k, 40k], or Brent outside [20, 300] USD (Confirmed in Step 1.1)
- **Historical Backfill Method:** Synthetic Realistic Time-Series 2018–2026 capturing historical market cycles (30k-134k VND/kg, London $1150-$5500) (Confirmed in Step 1.2)
- **BullMQ Retry & Backoff:** 5 attempts, exponential backoff starting at 10,000ms (10s) (Confirmed in Step 1.2)
- **Climate Representative Coordinates:** Đắk Lắk (`12.6667, 108.0500`); Brazil Linhares (`-19.3911, -40.0722`) (Confirmed in Step 1.3)
- **Rainfall Baseline Period:** 2010–2020 (11-year monthly climatology mean from Open-Meteo) (Confirmed in Step 1.3)
- **NOAA ONI Source:** `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` + local fallback cache (Confirmed in Step 1.3)
- **Telegram Bot Config:** `[PENDING ENV SETUP IN STEP 2.2]` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)

---

## 4. Active Architecture State `[AUTO-UPDATE]`

- **Containers Running & Healthy:**
  - `coffee_tracker_postgres` (PostgreSQL 17 on port 5432) — Healthy
  - `coffee_tracker_redis` (Redis 7 on port 6379) — Healthy
  - `coffee_tracker_orchestrator` (NestJS on port 3001) — Healthy
  - `coffee_tracker_ml_service` (FastAPI on port 8000) — Healthy
- **Database Tables Created & Active (PostgreSQL 17):**
  - `raw_market_prices`: **3,248 continuous records** (2018-01-01 to 2026-11-22).
  - `macro_climate_monthly`: **107 continuous monthly records** (2018-01-01 to 2026-11-01). Columns: `month_date`, `oni_index`, `vn_rain_anomaly`, `br_rain_anomaly`, timestamps.
  - `daily_signals`: 0 records (Target for Step 2.1).
  - `forecast_runs`: 0 records.
  - `forecast_predictions`: 0 records.
- **BullMQ Queues Active:**
  - `ingestion-queue`: 3 repeatable schedulers:
    1. `morning_domestic_0830` (`30 8 * * *` Asia/Ho_Chi_Minh)
    2. `night_london_close_0100` (`0 1 * * *` Asia/Ho_Chi_Minh)
    3. `monthly_climate_05_0300` (`0 3 5 * *` Asia/Ho_Chi_Minh)
- **FastAPI Endpoints Active:** `GET /health` (Healthy)
- **NestJS API Endpoints Active:** `GET /health` (Healthy)
- **NestJS Modules Active:** `HealthModule`, `PrismaModule` (Global), `IngestionModule` (Adapters, Validator, Service, Processor, Schedulers)

---

## 5. Known Issues, Technical Debt & Deviations `[AUTO-UPDATE]`

- Không có lỗi tồn đọng.
- Đã thiết lập cơ chế tự động Fallback Cache dự phòng cho cả NOAA và Open-Meteo nhằm triệt tiêu rủi ro gián đoạn mạng hoặc giới hạn session firewall/DrayTek router.
- Toàn bộ dữ liệu bảng `raw_market_prices` (3.248 records) và `macro_climate_monthly` (107 records) đều tuân thủ 100% Zero Float Principle và Single Writer Principle.

---

## 6. Step History Log `[AUTO-UPDATE]`

| Step | Date | Summary | Report Link |
| :--- | :--- | :------ | :---------- |
| — | — | Initialized project governance docs | — |
| `STEP 0.1` | 2026-11-22 | Monorepo scaffolding, Docker Compose 4 services, healthchecks PASS | [step_0_1_report.md](file:///F:/coffee_tracker/docs/agent/Reports/step_0_1_report.md) |
| `STEP 0.2` | 2026-11-22 | PostgreSQL schema 5 tables via Prisma ORM, migrations, zero float verified | [step_0_2_report.md](file:///F:/coffee_tracker/docs/agent/Reports/step_0_2_report.md) |
| `STEP 1.1` | 2026-11-22 | Market scrapers, fallback adapters, sanity validator, 11/11 tests PASS, live dry-run PASS | [step_1_1_report.md](file:///F:/coffee_tracker/docs/agent/Reports/step_1_1_report.md) |
| `STEP 1.2` | 2026-11-22 | BullMQ ingestion-queue, 2 cron schedulers, idempotent upsert, 3248 records backfilled | [step_1_2_report.md](file:///F:/coffee_tracker/docs/agent/Reports/step_1_2_report.md) |
| `STEP 1.3` | 2026-11-25 | NOAA ONI & Open-Meteo rainfall anomaly ingestion, monthly cron, 107 records backfilled | [step_1_3_report.md](file:///F:/coffee_tracker/docs/agent/Reports/step_1_3_report.md) |
