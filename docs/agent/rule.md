# PROJECT RULES & GUARDRAILS — COFFEE TRACKER & 6M FORECASTING SYSTEM


# Luôn luôn trả lời bằng tiếng việt
# Gợi ý lúc nên commit và commit message chuyên nghiệp
> **Scope:** Applies globally to EVERY phase, service, script, and agent session in this repository (`coffee-tracker`).
> **Violation Policy:** Any output that violates a HARD RULE below is immediately rejected and must be reverted/reworked.

---

## 1. ANTI-HALLUCINATION & ZERO-ASSUMPTION PROTOCOL (HARD RULE)

1. **STOP & ASK on Missing Information:** If ANY required detail is unknown, ambiguous, or missing from `Context.md` and the repository (e.g., target website HTML structure/selectors, API keys/tokens, historical CSV format/path, DB credentials, business thresholds, Telegram chat ID), you **MUST STOP** before writing code and list exact clarifying questions for the User.
2. **NEVER Invent Data or Endpoints:**
   - NEVER fabricate scraping CSS selectors, XPath, or undocumented third-party API URLs without inspecting actual HTML/JSON responses or asking the User.
   - NEVER fabricate synthetic/dummy historical market prices to fake a passing pipeline or model backtest.
   - NEVER hardcode mock numbers in production code paths (mocks are allowed ONLY inside `*.spec.ts` / `tests/`).
3. **Verify Before Claiming:** Never say "tested and working" or "passes all checks" unless you have actually executed the command/test and pasted the real terminal output into the Step Report.

---

## 2. ARCHITECTURE & SYSTEM BOUNDARIES (HARD RULE)

1. **Strict Separation of Concerns:**
   - **Control Plane (`apps/orchestrator` — NestJS + BullMQ + Redis + PostgreSQL):** Owns ALL scheduling, web scraping, external API calls, data validation, database writes, migrations, Telegram alerting, and REST APIs for Frontend.
   - **Compute Plane (`apps/ml-service` — Python 3.12+ + FastAPI):** Strictly **STATELESS**. Receives historical JSON payload via HTTP, runs time-series preprocessing & ML ensemble, returns validated JSON response.
   - **Presentation Plane (`apps/web` — Next.js):** Consumes NestJS Dashboard APIs only. Never calls Python ML Service or PostgreSQL directly.
2. **Single Writer Principle (Database):**
   - ONLY `apps/orchestrator` (NestJS) is allowed to write to PostgreSQL and manage Prisma/SQL migrations.
   - `apps/ml-service` MUST NOT write to PostgreSQL.
3. **Database Data Types & Idempotency:**
   - Financial prices, rates, spreads, and forecasts MUST use `NUMERIC` / `DECIMAL` in PostgreSQL — **NEVER `FLOAT` / `REAL`**.
   - Every ingestion and signal job MUST be **idempotent** (`UPSERT` on `price_date` / `signal_date`). Re-running a job 10 times for the same day must produce the exact same database state.
4. **BullMQ Stability:**
   - Keep 4 isolated queues: `ingestion-queue`, `signals-queue`, `forecast-queue`, `alert-queue`.
   - `forecast-queue` worker MUST configure `lockDuration >= 300000` (5 min) and HTTP timeout `>= 180000` (3 min) to prevent stalled-job false retries during ML training.
   - Every failed job after max retries MUST enqueue a failure alert to `alert-queue`.

---

## 3. TIME-SERIES & DATA SCIENCE INTEGRITY (HARD RULE)

1. **Dual-Cadence Architecture:**
   - Daily data is for **Daily Tracking, Signals, and Anomaly Detection ONLY**.
   - 6-month forecasting MUST resample daily series to **Weekly (`W-FRI`)** and forecast `h = 1..26` weeks ahead. NEVER feed raw daily prices into a 180-step recursive forecast.
2. **Zero Data Leakage:**
   - NEVER use `train_test_split(..., shuffle=True)` or random K-Fold on time-series data. ONLY use Expanding-Window Walk-Forward Validation.
   - NEVER fit scalers, encoders, or outlier bounds on the full dataset before splitting. Fit ONLY on `t <= t_0`.
   - NEVER use contemporaneous future variables (`X_{t+h}`) when forecasting `Y_{t+h}` (no ex-post cheating). All features used at forecast origin `t` must be observable at or before time `t`.
3. **No Sloppy Imputation:**
   - NEVER use `.bfill()` on lagged target/feature variables (which injects future values into the past).
   - Forward-fill (`ffill`) for non-trading weekends/holidays is allowed ONLY up to a documented maximum gap (e.g., max 5 trading days) and must be logged.
4. **Strict Forecasting Outputs:**
   - Every forecast horizon `h` MUST output 3 quantiles: `pred_p10`, `pred_p50`, `pred_p90` with enforced monotonicity: `pred_p10 <= pred_p50 <= pred_p90`.
   - All ML responses serialized by FastAPI MUST be validated by Pydantic v2 to reject `NaN`, `Inf`, or `-Inf` before leaving the service.
   - Always compute and compare against 2 mandatory baselines: **Naive Random Walk** and **Futures-Implied Baseline**.

---

## 4. CODING & EXECUTION DISCIPLINE

1. **One Step at a Time:** Execute ONLY the single Step requested by the User from `Prompt.md`. Do NOT jump ahead to future steps.
2. **Mandatory Workflow per Step:** Every step MUST strictly follow:
   `GOALS` -> `AMBIGUITY CHECK` -> `PLAN` -> `TASK` -> `WORKING` -> `SELF-CHECK` -> `REPORT` (+ update `Context.md`).
3. **Mandatory Reporting:** After finishing a step, you MUST:
   - Write a detailed report file in `docs/agent/Reports/step_<phase>_<step>_report.md` using `TEMPLATE_REPORT.md`.
   - Update `docs/agent/Context.md` with new files, schema changes, env vars, verified commands, and next step pointer.
4. **No Silent Failures:** Wrap external HTTP/scraping calls with explicit error logging, fallback sources (if configured), and sanity checks (e.g., reject daily price jumps > ±15% without manual override).
5. **Security:** Never commit `.env`, API keys, Telegram Bot tokens, or DB passwords. Always keep `.env.example` synchronized.
