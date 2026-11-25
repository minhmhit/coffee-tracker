# STEP REPORT: STEP 6.4 — FREE-TIER CLOUD DEPLOYMENT FEASIBILITY & `deploy_plan.md`

- **Date / Time:** 2026-11-25 17:38 (UTC+7)
- **Phase / Step:** Phase 6 — Step 6.4
- **Status:** `PASS (Conditional Go — $0/Month No-Credit-Card Architecture Verified with Real 5-Container Benchmarks)`

---

## 1. Goals & Scope Recap

- Thực hiện nghiên cứu khả thi triển khai toàn bộ 5 container (`Next.js 15`, `NestJS 11 + BullMQ`, `FastAPI ML`, `PostgreSQL 17`, `Redis 7`) lên hạ tầng Cloud miễn phí **\$0/tháng không cần thẻ** cho quy mô cá nhân (`< 100` visits/ngày, `< 20` người đăng ký Telegram).
- Đo thực tế dung lượng image, kích thước database, Idle RAM và Peak RAM/CPU khi chạy trực tiếp Walk-Forward CV, đối chiếu hạn mức 2026 các nền tảng miễn phí và xuất bản tài liệu kiến trúc `deploy_plan.md` tại thư mục gốc.

---

## 2. Clarifications Resolved (Ambiguity Check)

1. **Thẻ tín dụng / ghi nợ:** **Không cần thẻ** — loại bỏ Oracle Cloud Always Free (yêu cầu thẻ thật xác minh) và Koyeb (yêu cầu pre-auth hold thẻ) khỏi phương án khuyến nghị chính; chỉ giữ Oracle Cloud ARM làm phương án nâng cấp tham khảo (Option B).
2. **Quy mô mục tiêu:** **Cá nhân** (`< 100` lượt truy cập/ngày, `< 20` Telegram subscribers).

---

## 3. Measured 5-Container Benchmarks

- **Image Sizes (`docker images`):** `web` `282 MB`, `orchestrator` `791 MB`, `ml-service` `235 MB`, `postgres:17-alpine` `424 MB`, `redis:7-alpine` `57.3 MB`.
- **PostgreSQL Size:** **`10,206 kB` (~`10 MB`)** (`~1%` của hạn mức 1 GB trên Neon Postgres Free).
- **Idle RAM (`docker stats --no-stream`):** `web` `54.45 MiB`, `orchestrator` `98.81 MiB` (`58.54 MiB` post-GC), `postgres` `80.16 MiB`, `redis` `9.44 MiB`, `ml-service` `166.3 MiB` (Tổng ~`409 MiB`).
- **Peak ML Walk-Forward CV Run (`POST /api/forecast/trigger` -> `run_id=0bec2157-4da3-45db-be83-43bdd238661e`, `28.26s`, `STATUS=SUCCESS`):** `coffee_tracker_ml_service` đạt **`171.7 MiB` RAM** và CPU burst **`554.12%`**.

---

## 4. Deliverables & Context Updates

- Created [deploy_plan.md](file:///f:/coffee_tracker/deploy_plan.md) ở thư mục gốc với kết luận **Conditional Go**, số liệu đo đạc 5 container thực tế, sơ đồ kiến trúc Option A (Vercel Hobby + Neon Postgres + Upstash Redis + Render Free + Hugging Face Spaces Docker + GitHub Actions Cron + Telegram Webhook) đối chiếu với Option B (Oracle Cloud Always Free ARM), 5 giải pháp xử lý bẫy Free-Tier (spin-down 15 phút, Upstash `500k` commands/tháng, ML CPU/RAM limit, Vercel `10s` SSR timeout, bảo mật `X-Admin-Key` + CORS + `@nestjs/throttler`) và lộ trình triển khai 5 bước chi tiết.
- Updated `docs/agent/Context.md` (chuyển sang next step `STEP 6.5`).
