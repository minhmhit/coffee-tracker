# KẾ HOẠCH TRIỂN KHAI CLOUD MIỄN PHÍ ($0/THÁNG) — COFFEE TRACKER

- **Mục tiêu:** Đưa toàn bộ hệ thống 5 thành phần (`Next.js 15`, `NestJS 11 + BullMQ`, `Python 3.12 FastAPI + LightGBM/statsmodels`, `PostgreSQL 17`, `Redis 7` + Bot Telegram) lên hạ tầng Cloud **$0/tháng** để người dùng thật truy cập qua Internet.
- **Điều kiện ràng buộc đã xác nhận:**
  1. **Phương án khuyến nghị chính bắt buộc KHÔNG CẦN THẺ tín dụng/ghi nợ** (No Credit Card Required).
  2. **Quy mô giai đoạn đầu:** Cá nhân / nhóm nhỏ (`< 100` lượt truy cập/ngày, `< 20` người đăng ký Telegram).

---

## 1. Kết luận Khả thi (Feasibility Verdict)

> **KẾT LUẬN: CONDITIONAL GO (Khả thi 100% ở mức $0/tháng không cần thẻ, VỚI ĐIỀU KIỆN áp dụng 5 chỉnh sửa kỹ thuật trước khi đưa lên public).**

Hệ thống hoàn toàn có thể chạy ổn định ở mức **$0/tháng không cần thẻ** trên mô hình **Option A (Managed Serverless + PaaS Split)** gồm **Vercel + Neon + Upstash + Render Free + Hugging Face Spaces**, nhờ dung lượng dữ liệu thực tế rất gọn (~10 MB DB, ~409 MiB tổng Idle RAM).

Tuy nhiên, **không thể bê nguyên cấu hình Docker local (`BullMQ 24/7 + Long-Polling + SSR 10s`) đẩy thẳng lên các gói PaaS Free mà không chỉnh sửa**, vì sẽ vấp phải:
1. Chu kỳ ngủ đông 15 phút trên Render Free làm dừng cron nội bộ và ngắt Telegram Long-Polling.
2. BullMQ polling mặc định tiêu tốn quá giới hạn `500.000` lệnh/tháng của Upstash Redis Free.
3. Thời gian chạy mô hình ML Walk-Forward CV (`28,26 giây` trên 5,5 vCPU local) sẽ vượt timeout HTTP proxy nếu bị bóp xuống `0.1 CPU` trên Render Free.
4. `Vercel Hobby` giới hạn timeout SSR function ngắn (`10 giây`) — nếu gọi đồng bộ Render lúc đang cold start (`50–60 giây`) sẽ lỗi 504 nếu không bật cache/ISR hoặc fallback client fetch.
5. Hai endpoint `POST /api/forecast/trigger` và `POST /api/alerts/briefing/trigger` hiện chưa có khóa bảo vệ `X-Admin-Key`.

---

## 2. Kết quả Đo đạc Tài nguyên Thực tế (Measured Local Benchmark)

Số liệu đo trực tiếp trên stack 5 container tại máy local (`docker images`, `docker stats --no-stream`, `pg_database_size`) và trong phiên chạy **Walk-Forward CV thực tế (`run_id=0bec2157-4da3-45db-be83-43bdd238661e`, 12 rolling origins)**:

| Service / Container | Image & Dung lượng | RAM Idle | Peak RAM / CPU (trong phiên Forecast) | Mức tiêu thụ Đĩa / DB |
| :--- | :--- | :--- | :--- | :--- |
| **`web`** (`coffee_tracker_web`) | `coffee_tracker-web` (**282 MB**) | **54.45 MiB** (`0.00%` CPU) | ~55.03 MiB | Static + SSR standalone |
| **`orchestrator`** (`coffee_tracker_orchestrator`) | `coffee_tracker-orchestrator` (**791 MB**) | **98.81 MiB** (`58.54 MiB` sau GC) | **105.0 MiB** (`23.23%` CPU lúc tổng hợp payload) | Stateless Control Plane |
| **`ml-service`** (`coffee_tracker_ml_service`) | `coffee_tracker-ml-service` (**235 MB**) | **166.3 MiB** (`0.14%` CPU) | **171.7 MiB** / **554.12% CPU** (chạy xong trong **28.26s**) | Stateless Compute |
| **`postgres`** (`coffee_tracker_postgres`) | `postgres:17-alpine` (**424 MB**) | **80.16 MiB** | ~75.49 MiB (`4.03%` CPU khi ghi run) | **`10,206 kB` (~10 MB)** cho 3.248 ngày giá + signals + weather + forecasts |
| **`redis`** (`coffee_tracker_redis`) | `redis:7-alpine` (**57.3 MB**) | **9.44 MiB** (`0.42%` CPU) | ~9.52 MiB (`3.60%` CPU) | Ephemeral/AOF nhỏ (~1 MB) |
| **TỔNG CỘNG (5 Containers)** | **~1.79 GB** tổng ảnh | **~409 MiB RAM** | **~417 MiB RAM** (nhưng CPU burst cao ở ML) | **~10 MB PostgreSQL** |

> **Nhận xét kỹ thuật:** Toàn bộ dữ liệu lịch sử 2018–2026 chỉ tốn **`10 MB`** (chỉ chiếm `1%` gói Neon 1 GB), và tổng RAM thực tế của Node (`web` + `orchestrator`) dưới `160 MiB`. Điểm nghẽn duy nhất không nằm ở RAM Web/API mà nằm ở **CPU burst (`554%`) lúc ML chạy 12 mốc Walk-Forward CV** và **cơ chế ngủ đông (spin-down)** của các dịch vụ miễn phí.

---

## 3. So sánh 2 Kiến trúc Triển khai Miễn phí ($0/tháng)

### Option A — Managed Serverless & PaaS Split (KHUYẾN NGHỊ CHÍNH — 100% KHÔNG CẦN THẺ)

Tách từng thành phần lên nền tảng chuyên biệt có gói miễn phí không yêu cầu nhập thẻ:

| Thành phần | Nền tảng đề xuất | Giới hạn Free Tier (2026) | Yêu cầu thẻ? | Đánh giá độ phù hợp |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend (`apps/web`)** | **Vercel Hobby** | 100 GB bandwidth/tháng, 1M edge requests, non-commercial, auto HTTPS + CDN toàn cầu | **Không** | **Rất tốt** — Next.js 15 chạy native, không bị sleep giao diện |
| **PostgreSQL 17** | **Neon Postgres Free** | 1 GB storage/project, 100 CU-hours/tháng, tự scale-to-zero sau 5 phút idle | **Không** | **Rất tốt** — DB 10 MB chỉ dùng ~1% dung lượng |
| **Redis 7** | **Upstash Redis Free** | 500.000 commands/tháng, 256 MB RAM, 10 GB bandwidth | **Không** | **Đạt (nếu tắt polling)** — Cần chỉnh BullMQ hoặc bỏ queue polling |
| **Backend (`apps/orchestrator`)** | **Render Free Web Service** | 512 MB RAM, 0.1 CPU, tự tắt sau 15 phút không có traffic (cold start 50–60s) | **Không** | **Đạt** — RAM thực ~60–105 MiB vừa gọn trong 512 MB; cần Webhook + GitHub Actions Cron |
| **ML Engine (`apps/ml-service`)** | **Hugging Face Spaces (Docker CPU Basic)** *(hoặc Render Free thứ 2)* | HF: 2 vCPU, **16 GB RAM**, Docker SDK; Render: 512 MB RAM / 0.1 CPU | **Không** *(HF cần email xác minh; một số tài khoản mới nên kiểm tra quyền tạo Docker Space)* | **Khuyến nghị HF Spaces** nhờ **2 vCPU / 16 GB RAM** tránh timeout 28s–180s khi tính Walk-Forward CV |
| **Lịch chạy Cron (05:45, 06:00, 08:30, T2 02:00)** | **GitHub Actions Schedule** | 2.000 phút/tháng miễn phí cho private repo (không giới hạn với public repo) | **Không** | **Bắt buộc thay thế cron nội bộ** vì Render ngủ sau 15 phút |

*(Lưu ý kiểm tra 2026: **Koyeb** đã yêu cầu thẻ xác minh/tạm giữ pre-auth hold nên bị loại khỏi phương án không cần thẻ).*

```
[Người dùng / Zalo / Google]
           │ HTTPS
           ▼
   ┌───────────────┐   ISR / Client Fetch    ┌───────────────────────────┐
   │ Vercel Hobby  │ ──────────────────────► │ Render Free (512MB RAM)   │
   │ (Next.js 15)  │   + CORS Origin lock    │ apps/orchestrator (NestJS)│
   └───────────────┘                         └──────┬───────┬──────┬─────┘
                                                    │       │      │
       ┌────────────────────────────────────────────┘       │      └──────────────────┐
       ▼                                                    ▼                         ▼
┌───────────────────┐                            ┌────────────────────┐    ┌──────────────────────┐
│ Neon Postgres 17  │                            │ Upstash Redis Free │    │ HF Spaces (Docker)   │
│ Free (1GB, SSL)   │                            │ (500k cmds/tháng)  │    │ apps/ml-service      │
└───────────────────┘                            └────────────────────┘    │ (2 vCPU / 16GB RAM)  │
                                                                           └──────────────────────┘
┌───────────────────┐     POST /api/alerts/telegram/webhook (Secret Token)
│   Telegram API    │ ◄───────────────────────────────────────────────────► Render Free Orchestrator
└───────────────────┘

┌───────────────────┐     Scheduled Cron (05:45, 06:00, 08:30, Mon 02:00 VN)
│  GitHub Actions   │ ──── Wake GET /health (retry 60s) ──► Authenticated POST endpoints
└───────────────────┘
```

### Option B — Always-Free ARM VPS Chạy Nguyên Bản Docker Compose (THAM KHẢO NẾU SAU NÀY CÓ THẺ)

| Tiêu chí | Chi tiết Option B |
| :--- | :--- |
| **Hạ tầng** | **Oracle Cloud Always Free (Ampere A1 ARM)**: tối đa `4 OCPU` + `24 GB RAM` + `200 GB` ổ cứng + Cloudflare Tunnel (miễn phí SSL, không cần mở port IP công cộng trực tiếp) |
| **Yêu cầu thẻ** | **CÓ — Bắt buộc thẻ Visa/Mastercard ngân hàng thật** để xác minh danh tính (tạm giữ ~\$1 rồi hoàn; hay từ chối thẻ ảo/prepaid hoặc thiếu capacity VM khu vực Singapore) |
| **Ưu điểm** | Chạy nguyên vẹn file [docker-compose.yml](file:///f:/coffee_tracker/docker-compose.yml) 5 container từ Step 6.3 (`~409 MiB` trên `24 GB RAM`), không cold start, BullMQ & Telegram Long-Polling chạy 24/7 không cần sửa kiến trúc |
| **Kết luận chọn** | Giữ làm phương án nâng cấp tương lai; **chọn Option A làm phương án chính ngay lúc này** theo tiêu chí *Không cần thẻ*. |

---

## 4. Các Điểm Nghẽn Free-Tier & Giải pháp Kỹ thuật Bắt buộc

### 4.1 Ngủ đông 15 phút làm chết Cron nội bộ & Telegram Long-Polling

- **Vấn đề:** Render Free tự tắt container sau **15 phút** không có HTTP request. Khi container ngủ, lịch `@nestjs/bullmq` (`05:45` thời tiết, `06:00` bản tin Telegram, `08:30` giá nội địa, `02:00 T2` dự báo) và vòng lặp `getUpdates` Long-Polling của `TelegramBotService` đều ngừng chạy.
- **Giải pháp bắt buộc:**
  1. **Chuyển Telegram Bot sang Webhook Mode** khi chạy cloud (`TELEGRAM_MODE=webhook`):
     - Thêm endpoint `POST /api/alerts/telegram/webhook` trong `AlertsController`, xác thực header `X-Telegram-Bot-Api-Secret-Token`.
     - Đăng ký `setWebhook` trỏ về URL Render (`https://<app>.onrender.com/api/alerts/telegram/webhook`). Khi người dùng gửi `/start`, `/today`, `/stop`, server Telegram sẽ tự gọi HTTP woke up Render và trả lời sau ~5–50s nếu vừa thức dậy (hoặc <1s nếu đang nóng).
  2. **Dùng GitHub Actions Cron gọi đánh thức + kích hoạt tác vụ theo giờ Việt Nam (`UTC+7`):**
     - `40 22 * * *` (05:40 sáng VN): Gọi `GET /health` làm nóng Render trước khi đồng bộ thời tiết lúc `05:45` -> gửi điểm tin sáng `06:00` (`55 22 * * *` / `0 23 * * *`). *(Lưu ý: GitHub Actions cron có thể trễ 5–15 phút vào phút `:00`, nên đặt cron chạy sớm 5–10 phút như `50 22 * * *` hoặc dùng workflow gọi nối tiếp Sync Weather -> Morning Briefing!).*

### 4.2 Ngốn Quota Redis trên Upstash (`500.000` commands/tháng)

- **Vấn đề:** BullMQ chạy worker nền kiểm tra hàng đợi, lock và stalled jobs liên tục mỗi vài giây. Với 4 queue (`ingestion-queue`, `signals-queue`, `alert-queue`, `forecast-queue`), tổng số lệnh `EVALSHA`/`BRPOPLPUSH`/`PING` hàng tháng có thể vượt xa ngưỡng `500.000` lệnh/tháng ngay cả khi không có job!
- **Giải pháp bắt buộc (chọn 1 trong 2):**
  - *Cách 1 (Khuyên dùng cho Free Tier):* Thêm cờ cấu hình `QUEUE_MODE=direct` trên Production Free Tier để **thực thi trực tiếp qua HTTP cron** (`POST /api/ingestion/sync` -> chạy nối tiếp tính `signals` ngay trong process -> `POST /api/alerts/briefing/trigger`), không bật worker Redis polling 24/7 (`0` lệnh Redis lúc idle).
  - *Cách 2 (Nếu vẫn giữ BullMQ):* Giảm polling tối đa trong `@Processor(..., { stalledInterval: 600000, lockDuration: 120000, drainDelay: 30 })` và chỉ bật worker cho `forecast-queue` hoặc tắt bớt repeatable polling.

### 4.3 Trần RAM `512 MB` & CPU `0.1` cho `ml-service` (Walk-Forward CV)

- **Vấn đề:** Thực đo local cho thấy `ml-service` chiếm `171.7 MiB` RAM nhưng **burst lên `554.12%` CPU trong `28.26s`** để fit 12 mốc VECM + LightGBM Quantile. Nếu đặt `ml-service` lên Render Free (`0.1 CPU`, `512 MB`), thời gian chạy sẽ giãn ra **~120–240 giây**, dễ vượt quá HTTP timeout 100s của Render Proxy và nguy cơ OOM khi OpenMP tạo nhiều luồng.
- **Giải pháp bắt buộc:**
  1. Đặt `apps/ml-service` lên **Hugging Face Spaces (Docker Space — CPU Basic 2 vCPU / 16 GB RAM Free)** — hoàn toàn không lo giới hạn `512 MB` RAM và có tới 2 vCPU thật.
  2. Giới hạn số luồng OpenMP trong Dockerfile/Env (`OMP_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`, `MKL_NUM_THREADS=1`) để tránh tràn RAM vì đa luồng.
  3. Tại NestJS (`ForecastProcessor` / endpoint cron Thứ Hai), tăng HTTP client timeout lên `180_000ms` và đánh thức HF Space (`GET /health`) trước `60s` rồi mới `POST /api/v1/forecast/weekly`.

### 4.4 Vercel SSR Timeout `10 giây` khi Backend Render đang Ngủ

- **Vấn đề:** Ở Step 6.2, `apps/web/src/app/page.tsx` dùng `dynamic = 'force-dynamic'` gọi `INTERNAL_API_URL` mỗi lần tải trang. Trên **Vercel Hobby Free**, serverless function bị ngắt sau **10 giây**. Nếu Render đang ngủ (mất `50–60s` cold start), request SSR từ Vercel sẽ bị timeout!
- **Giải pháp bắt buộc:**
  1. Khi triển khai Vercel Hobby, đổi `page.tsx` từ `force-dynamic` sang **ISR (`export const revalidate = 300;`)** (cache tại CDN Edge Vercel 5 phút/lần -> người dùng tải trang tức thì `< 200ms` mà không chạm cold start Render!).
  2. Thêm `timeout` an toàn (`AbortSignal.timeout(3500)`) trong server `safeFetch` ở `apps/web/src/lib/api.ts`: nếu Render đang ngủ lúc ISR revalidate, Vercel trả trang nhanh (hoặc giữ stale cache cũ) rồi `DashboardClient` tự động gọi lại ở trình duyệt khi backend thức dậy (`200 OK`).

### 4.5 Bảo mật Public Endpoints trước khi Mở ra Internet

- **Vấn đề:** Hiện tại `POST /api/forecast/trigger` và `POST /api/alerts/briefing/trigger` mở công khai không cần xác thực.
- **Giải pháp bắt buộc (Pre-Deployment Checklist):**
  1. Bảo vệ toàn bộ endpoint trigger/sync/admin bằng `AdminApiKeyGuard` kiểm tra header `X-Admin-Key` (dùng `crypto.timingSafeEqual` so với `process.env.ADMIN_API_KEY`).
  2. Bật `@nestjs/throttler` giới hạn tần suất (ví dụ: `60 req/phút/IP` cho API đọc, `5 req/phút` cho route trigger/webhook).
  3. Khóa chặt **CORS** trong `apps/orchestrator/src/main.ts` chỉ cho phép `process.env.CORS_ORIGIN` (`https://coffee-tracker.vercel.app`) thay vì mở rộng mặc định.
  4. Tuyệt đối chỉ đặt `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`, `ADMIN_API_KEY` trong Secret Vault của Vercel/Render/HF/GitHub Actions — không commit vào Git.

---

## 5. Checklist Biến Môi trường (Environment Variables Matrix)

| Dịch vụ | Biến Môi trường Bắt buộc | Giá trị / Nguồn lấy |
| :--- | :--- | :--- |
| **Vercel (`apps/web`)** | `NEXT_PUBLIC_API_URL` | `https://<orchestrator-app>.onrender.com` |
| | `INTERNAL_API_URL` | `https://<orchestrator-app>.onrender.com` |
| | `NEXT_PUBLIC_SITE_URL` | `https://<ten-du-an>.vercel.app` |
| **Render (`apps/orchestrator`)** | `NODE_ENV`, `PORT`, `TZ` | `production`, `3001`, `Asia/Ho_Chi_Minh` |
| | `NODE_OPTIONS` | `--dns-result-order=ipv4first` |
| | `DATABASE_URL` | Connection string có `?sslmode=require` từ **Neon** |
| | `REDIS_URL` *(nếu bật queue)* | TLS `rediss://...` từ **Upstash** |
| | `QUEUE_MODE` | `direct` *(khuyên dùng để tiết kiệm Upstash)* hoặc `bullmq` |
| | `ML_SERVICE_URL` | `https://<user>-coffee-ml.hf.space` |
| | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | Token BotFather & `minhmh_coffee_tracker_bot` |
| | `TELEGRAM_MODE`, `TELEGRAM_WEBHOOK_SECRET` | `webhook` + chuỗi ngẫu nhiên 32+ ký tự |
| | `ADMIN_API_KEY`, `CORS_ORIGIN` | Secret 32+ ký tự & `https://<ten-du-an>.vercel.app` |
| **HF Spaces (`apps/ml-service`)** | `PORT`, `TZ` | `7860` *(cổng mặc định HF Docker Space)*, `Asia/Ho_Chi_Minh` |
| | `OMP_NUM_THREADS`, `OPENBLAS_NUM_THREADS` | `1` *(kiểm soát RAM & ổn định đa luồng)* |
| **GitHub Actions Secrets** | `ORCHESTRATOR_URL`, `ML_SERVICE_URL`, `ADMIN_API_KEY` | URL public Render, HF Space & khóa admin |

---

## 6. Lộ trình Triển khai Từng bước (Step-by-Step Rollout)

### Bước 1 — Hardening Code Trước khi Deploy (~2–3 giờ code)
1. Thêm `AdminApiKeyGuard` (`X-Admin-Key`), `@nestjs/throttler` và biến `CORS_ORIGIN` trong `apps/orchestrator`.
2. Thêm endpoint `POST /api/alerts/telegram/webhook` + chế độ `TELEGRAM_MODE=webhook` (để `getUpdates` chỉ chạy khi `TELEGRAM_MODE=polling` ở local).
3. Thêm chế độ `QUEUE_MODE=direct` (hoặc tăng `stalledInterval`/`drainDelay`) để không cháy quota `500k` lệnh/tháng của Upstash Redis.
4. Sửa `apps/web/src/app/page.tsx` sang `export const revalidate = 300;` (ISR) kèm timeout ngắn khi fetch server-side trên Vercel.
5. Tạo `.github/workflows/daily-cron.yml` gọi wake + kích hoạt tác vụ theo lịch (`05:45`, `06:00`, `08:30`, `02:00 T2` VN).

### Bước 2 — Khởi tạo Database & Redis ($0, Không cần thẻ)
1. Tạo project trên **Neon Postgres** -> lấy `DATABASE_URL` (`?sslmode=require`).
2. Chạy Prisma migrate & đẩy dữ liệu lịch sử ban đầu từ máy local lên Neon:
   ```bash
   # Từ máy local trỏ tạm DATABASE_URL tới Neon
   pnpm --filter @coffee-tracker/orchestrator exec prisma migrate deploy
   pg_dump -U postgres -d coffee_tracker --data-only --inserts > seed_prod.sql
   psql "<NEON_DATABASE_URL>" -f seed_prod.sql
   ```
3. (Nếu dùng chế độ queue) Tạo database trên **Upstash Redis** -> lấy `REDIS_URL`.

### Bước 3 — Deploy ML Service lên Hugging Face Spaces
1. Tạo Docker Space trên **Hugging Face** (`CPU Basic 2 vCPU / 16GB RAM` — Free).
2. Lưu ý HF Spaces lắng nghe cổng **`7860`** mặc định (`EXPOSE 7860` hoặc `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]` thông qua biến `PORT=7860`).
3. Kiểm tra `GET https://<space>.hf.space/health` -> `{"status":"ok"}`.

### Bước 4 — Deploy Backend Orchestrator lên Render Free
1. Tạo **Web Service** trỏ repo GitHub, `Root Directory: apps/orchestrator`, Dockerfile có sẵn.
2. Nhập đầy đủ env từ Bảng Mục 5 (bao gồm `DATABASE_URL` Neon, `ML_SERVICE_URL` HF Space, `TELEGRAM_MODE=webhook`, `ADMIN_API_KEY`, `CORS_ORIGIN`).
3. Chạy xác minh `GET https://<app>.onrender.com/health` và đăng ký Telegram Webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<app>.onrender.com/api/alerts/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

### Bước 5 — Deploy Frontend lên Vercel Hobby
1. Import repo trên **Vercel**, đặt `Root Directory: apps/web`, Build Command mặc định Next.js.
2. Khai báo `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL` trỏ sang URL Render và `NEXT_PUBLIC_SITE_URL` trỏ sang URL Vercel thật (để cập nhật `canonical`, `sitemap.xml`, `robots.txt` và `og:image`).
3. Chạy smoke test end-to-end: mở URL Vercel, kiểm tra `/robots.txt`, `/sitemap.xml`, `/opengraph-image` và nhắn `/start`, `/today` cho Bot `@minhmh_coffee_tracker_bot` trên Telegram.
