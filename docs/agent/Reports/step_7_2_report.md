# STEP 7.2 REPORT — GITHUB ACTIONS SCHEDULED PIPELINES & DEPLOYMENT RUNBOOK

- **Date:** 2026-11-25
- **Phase / Step:** Phase 7 — Step 7.2
- **Status:** COMPLETED & VERIFIED

---

## 1. Objectives & Confirmed Decisions

1. Confirmed **Public GitHub Repository** strategy for unlimited free GitHub Actions minutes (plus audited git-tracked files & history to flag personal data to scrub before flipping repo visibility to Public).
2. Confirmed all **6 manual `workflow_dispatch` job options** (`weather`, `morning_briefing`, `morning_domestic`, `night_london`, `weekly_forecast`, `monthly_climate`) in `.github/workflows/daily-cron.yml`.

---

## 2. Implemented Deliverables

1. **`.github/workflows/daily-cron.yml`:**
   - Configured 6 UTC-converted schedules matching Asia/Ho_Chi_Minh (`UTC+7`):
     - `45 22 * * *` -> `05:45 VN` (`weather`)
     - `55 22 * * *` -> `05:55 VN` (`morning_briefing`)
     - `30 1 * * *` -> `08:30 VN` (`morning_domestic`)
     - `0 18 * * *` -> `01:00 VN` (`night_london`)
     - `0 19 * * 0` -> `02:00 VN` Monday (`weekly_forecast`)
     - `0 20 4 * *` -> `03:00 VN` 5th of month (`monthly_climate`)
   - Implements Render Free `/health` wake-up retry loop (`15 x 10s = 150s`), dedicated Hugging Face Spaces `/health` wake-up before `weekly_forecast`, strict secret checks, and authenticated `POST` calls with `X-Admin-Key`.
   - Applies least-privilege `permissions: contents: read` and strict HTTP status checking (`200`/`201`/`202`).
2. **`render.yaml`:**
   - Render Blueprint targeting `apps/orchestrator` Docker image (`plan: free`, `region: singapore`, `healthCheckPath: /health`), pre-setting `QUEUE_MODE=direct`, `TELEGRAM_MODE=webhook`, `NODE_OPTIONS=--dns-result-order=ipv4first`, and listing all required `sync: false` secrets.
3. **`apps/web/vercel.json`:**
   - Declares Next.js framework preset and hardened security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`).
4. **`docs/deploy_runbook.md`:**
   - Complete zero-card step-by-step cloud setup guide covering pre-public secret scrubbing, Neon Postgres 17 (`--exclude-table=_prisma_migrations` data dump/restore), optional Upstash Redis TLS, Hugging Face Spaces (`app_port: 7860`, `2 vCPU / 16 GB RAM`), Render Free + Telegram `setWebhook`, Vercel Hobby + Render `CORS_ORIGIN` linking, GitHub Actions 3 secrets + verification, and troubleshooting.

---

## 3. Public-Repo Security Audit Summary

- Verified `.env`, `apps/orchestrator/.env`, and `apps/web/.env.local` are ignored by `.gitignore` and have **never** been committed to git history (`git log --all --full-history -- "**/.env"` returned empty).
- Flagged existing tracked files & commits containing personal Telegram chat IDs (`7583239264`, `-5371622980`), bot numeric ID (`9036698448`), or first name (`Mai`) so the user can redact and rewrite history before switching the repository to Public:
  - `apps/orchestrator/src/alerts/test/alerts-onboarding.spec.ts` (lines `32`, `259`, `283`)
  - `docs/agent/Context.md` (line `116`)
  - `docs/agent/Reports/step_2_2_report.md` (lines `73`, `76`, `81`, `86`)
  - `docs/agent/Reports/step_5_3_report.md` (line `100`)
  - `docs/agent/Reports/step_6_5_report.md` (lines `47`, `52–57`)

---

## 4. Verification Results

- **`apps/web/vercel.json`:** Valid JSON (`framework=nextjs`, `headers=1`).
- **`.github/workflows/daily-cron.yml`:** Parsed cleanly with `yaml.safe_load`; verified all 6 UTC schedules match 1-to-1 with resolver mapping and all 6 `workflow_dispatch` dropdown choices.
- **`render.yaml`:** Parsed cleanly with `yaml.safe_load` (`coffee-tracker-orchestrator:free:singapore`).
