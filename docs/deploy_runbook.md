# HƯỚNG DẪN TRIỂN KHAI CLOUD MIỄN PHÍ ($0/THÁNG — KHÔNG CẦN THẺ) — COFFEE TRACKER

Tài liệu này là sổ tay thao tác từng bước để đưa toàn bộ hệ thống **Coffee Tracker** lên hạ tầng Free Tier (**Option A**: **Neon Postgres + Upstash Redis (tùy chọn) + Hugging Face Spaces + Render Free + Vercel Hobby + GitHub Actions Cron + Telegram Webhook**) theo kiến trúc đã hardened ở **Step 7.1**.

---

## 0. Lưu ý Bắt buộc Trước khi Đưa Repository GitHub lên Public

Để sử dụng **GitHub Actions không giới hạn phút miễn phí** (`Public repository`), bạn cần rà soát trước các thông tin riêng tư trong lịch sử Git và thư mục làm việc:

- **Tuyệt đối không đẩy lên Git:** Các file `.env`, `apps/orchestrator/.env`, `apps/web/.env.local` (đã nằm trong `.gitignore` và chưa từng được commit).
- **Dữ liệu nhạy cảm đã từng được ghi vào repo cần dọn trước khi mở Public:**
  1. ID Telegram cá nhân / nhóm test và tên riêng đã từng lưu trong tài liệu kiểm thử và báo cáo:
     - `apps/orchestrator/src/alerts/test/alerts-onboarding.spec.ts` (dòng `32`, `259`, `283`)
     - `docs/agent/Context.md` (dòng `116`)
     - `docs/agent/Reports/step_2_2_report.md` (dòng `73`, `76`, `81`, `86`)
     - `docs/agent/Reports/step_5_3_report.md` (dòng `100`)
     - `docs/agent/Reports/step_6_5_report.md` (dòng `47`, `52–57`)
  2. Thư mục `docs/agent/` là nhật ký nội bộ trong quá trình phát triển — nếu không muốn công khai log chi tiết, nên xóa hoặc ẩn danh ID trước khi mở Public, **kèm dọn lịch sử Git** (`git filter-repo` hoặc tạo nhánh `main` sạch từ snapshot hiện tại) vì commit cũ (`68e8b7f`, `f59c73c`, `6ea7aa2`) vẫn lưu nội dung cũ trên GitHub.

---

## 1. Bước 1 — Khởi tạo Neon Postgres Free & Nạp Dữ liệu Lịch sử

1. Đăng ký tài khoản miễn phí tại [neon.tech](https://neon.tech) (**không yêu cầu thẻ**).
2. Tạo Project mới:
   - **Postgres Version:** `17`
   - **Region:** `AWS Asia Pacific (Singapore) - ap-southeast-1`
   - **Database name:** `coffee_tracker`
3. Sao chép **Connection string** (dạng Pooled hoặc Direct, đảm bảo có `?sslmode=require`), tạm gọi là `NEON_DATABASE_URL`.
4. Từ máy local tại thư mục gốc `coffee_tracker`:
   - Chạy migration tạo 8 bảng từ Prisma schema (dùng chuỗi kết nối Direct/non-pooled nếu Neon cung cấp cả 2):
     ```powershell
     $env:DATABASE_URL="postgresql://<user>:<pass>@<neon-host>/coffee_tracker?sslmode=require"
     pnpm --dir apps/orchestrator exec prisma migrate deploy
     ```
   - Xuất dữ liệu sạch từ Docker Postgres local (**bỏ qua bảng `_prisma_migrations`** để tránh đụng khóa chính sau `migrate deploy`) và nạp lên Neon:
     ```powershell
     docker exec coffee_tracker_postgres pg_dump -U postgres -d coffee_tracker --data-only --inserts --exclude-table=_prisma_migrations > seed_prod.sql
     # Nạp lên Neon bằng psql (hoặc chạy qua container postgres nếu máy host chưa cài psql):
     Get-Content seed_prod.sql -Raw | docker exec -i coffee_tracker_postgres psql "$env:DATABASE_URL"
     Remove-Item seed_prod.sql
     ```
   - Kiểm tra nhanh số lượng bản ghi trên Neon: `raw_market_prices` (`3.248+`), `daily_signals` (`3.248+`), `macro_climate_monthly` (`107+`), `forecast_runs`, `daily_weather`, `ice_robusta_stocks`.

---

## 2. Bước 2 — Upstash Redis Free (Tùy chọn / Backup Queue)

- Khi deploy theo chế độ **`QUEUE_MODE=direct`** (khuyên dùng cho gói Free Tier), Orchestrator **không kết nối Redis 24/7**, tiêu thụ **`0` command/tháng**. Bạn có thể bỏ qua `REDIS_URL`.
- Nếu muốn dự phòng BullMQ queue cho các tác vụ thủ công:
  1. Tạo tài khoản tại [upstash.com](https://upstash.com) (**không yêu cầu thẻ**), tạo Redis Database vùng **Singapore (`ap-southeast-1`)**.
  2. Lấy TLS URL dạng `rediss://default:<password>@<host>:6379` để điền vào biến `REDIS_URL` trên Render (khi `QUEUE_MODE=bullmq`, hệ thống đã bật sẵn `stalledInterval: 300000` và `drainDelay: 30` để giữ mức dùng dưới `500.000` lệnh/tháng).

---

## 3. Bước 3 — Deploy ML Service lên Hugging Face Spaces (2 vCPU / 16 GB RAM Free)

1. Đăng ký / đăng nhập [huggingface.co](https://huggingface.co) -> chọn **New Space**.
2. Cấu hình Space:
   - **Space name:** ví dụ `coffee-tracker-ml`
   - **License:** `MIT`
   - **Select the Space SDK:** **Docker** -> chọn template **Blank**.
   - **Space hardware:** **CPU basic · 2 vCPU · 16 GB RAM · FREE**.
   - **Visibility:** Public (hoặc Private nếu muốn, nhưng Orchestrator cần gọi được endpoint public — khuyến nghị Public vì ML service là compute engine stateless không chứa dữ liệu DB/API key).
3. Clone Space repo vừa tạo về một thư mục tạm (ví dụ `C:\tmp\hf-coffee-ml`), chép toàn bộ nội dung trong `apps/ml-service/` vào thư mục đó, **giữ nguyên phần YAML header ở đầu file `README.md`** của Space với **`app_port: 7860`**:
   ```yaml
   ---
   title: Coffee Tracker ML Service
   emoji: ☕
   colorFrom: green
   colorTo: yellow
   sdk: docker
   app_port: 7860
   ---
   ```
4. Trong mục **Settings -> Variables and secrets** trên HF Space, thêm các biến **Variables**:
   - `PORT` = `7860`
   - `TZ` = `Asia/Ho_Chi_Minh`
   - `OMP_NUM_THREADS` = `1`
   - `OPENBLAS_NUM_THREADS` = `1`
   - `MKL_NUM_THREADS` = `1`
   - `NUMEXPR_NUM_THREADS` = `1`
5. Push code lên HF Space và đợi build container hoàn tất (~3–5 phút). Kiểm tra URL:
   ```bash
   curl https://<hf-username>-coffee-tracker-ml.hf.space/health
   # Kỳ vọng: {"status":"ok","service":"coffee-tracker-ml"}
   ```

---

## 4. Bước 4 — Deploy Backend Orchestrator lên Render Free

1. Đăng ký / đăng nhập [render.com](https://render.com) bằng GitHub (**không yêu cầu thẻ** cho Free Web Service).
2. Chọn **New + -> Blueprint** (dùng sẵn file [render.yaml](file:///f:/coffee_tracker/render.yaml) ở gốc repo) hoặc tạo **Web Service** thủ công:
   - **Root Directory:** `apps/orchestrator`
   - **Runtime:** `Docker`
   - **Instance Type:** `Free` (`512 MB RAM`, `0.1 CPU`, region `Singapore`)
   - **Health Check Path:** `/health`
3. Điền đầy đủ các biến môi trường bí mật (`sync: false` trong `render.yaml`):

| Biến môi trường | Giá trị mẫu |
| :--- | :--- |
| `DATABASE_URL` | Chuỗi Neon Postgres có `?sslmode=require` ở Bước 1 |
| `ML_SERVICE_URL` | `https://<hf-username>-coffee-tracker-ml.hf.space` (không có `/` ở cuối) |
| `QUEUE_MODE` | `direct` |
| `TELEGRAM_MODE` | `webhook` |
| `TELEGRAM_BOT_TOKEN` | Token lấy từ `@BotFather` |
| `TELEGRAM_CHAT_ID` | Chat ID quản trị mặc định nhận System Error Alert |
| `TELEGRAM_BOT_USERNAME` | `minhmh_coffee_tracker_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Chuỗi bí mật ngẫu nhiên (vd: giá trị đã cấp trong `.env` local) |
| `ADMIN_API_KEY` | Chuỗi khóa admin riêng (`X-Admin-Key`) |
| `CORS_ORIGIN` | Tạm để URL Vercel dự kiến, sẽ cập nhật lại URL chính xác ngay sau Bước 5 |
| `ML_WAKE_BEFORE_FORECAST` | `true` |

4. Sau khi Render deploy xanh (`Live`), kiểm tra healthcheck:
   ```bash
   curl https://<render-service>.onrender.com/health
   ```
5. **Đăng ký Telegram Webhook** trỏ về Render (chỉ cần làm 1 lần):
   > **Lưu ý quan trọng:** Khi đã bật Webhook trên Cloud cho cùng 1 `TELEGRAM_BOT_TOKEN`, **không chạy thêm container/tiến trình local ở chế độ `TELEGRAM_MODE=polling`** dùng chung token đó nếu không muốn bị Telegram ngắt webhook hoặc xung đột `409 Conflict`.
   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=https://<render-service>.onrender.com/api/alerts/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"

   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
   ```

---

## 5. Bước 5 — Deploy Frontend Next.js lên Vercel Hobby

1. Đăng ký / đăng nhập [vercel.com](https://vercel.com) bằng tài khoản GitHub (**Hobby Plan Free — không yêu cầu thẻ**).
2. Chọn **Add New -> Project** -> Import repository `coffee_tracker`:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `apps/web`
3. Khai báo **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://<render-service>.onrender.com`
   - `INTERNAL_API_URL` = `https://<render-service>.onrender.com`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-project>.vercel.app` (nếu chưa biết chính xác domain trước lần deploy đầu, có thể deploy trước 1 lần rồi cập nhật giá trị chuẩn và bấm **Redeploy**).
4. Bấm **Deploy** (~1–2 phút).
5. Quay lại **Render Dashboard -> Environment**, cập nhật `CORS_ORIGIN` đúng bằng domain Vercel thật (ví dụ `https://coffee-tracker-vn.vercel.app`, không có dấu `/` cuối) và lưu để Render khởi động lại với CORS chuẩn.

---

## 6. Bước 6 — Kích hoạt GitHub Actions Cron & Kiểm thử Production

1. Trên GitHub repo -> **Settings -> Secrets and variables -> Actions -> New repository secret**, thêm **3 Secrets**:
   - `ORCHESTRATOR_URL` = `https://<render-service>.onrender.com`
   - `ML_SERVICE_URL` = `https://<hf-username>-coffee-tracker-ml.hf.space`
   - `ADMIN_API_KEY` = giá trị `ADMIN_API_KEY` đã đặt trên Render
2. Mở tab **Actions -> Coffee Tracker Cloud Cron -> Run workflow** và chạy kiểm tra theo thứ tự:
   - Chọn `weather` -> kiểm tra log GitHub Actions thấy HTTP `200` (`mode: "direct"`, `syncedCount: 4`).
   - Chọn `morning_briefing` -> kiểm tra Telegram nhận được tin nhắn điểm tin sáng.
3. Kiểm tra giao diện Public trên trình duyệt:
   - Mở `https://<your-project>.vercel.app`: xác nhận giá, thời tiết, phân tích tác động và biểu đồ fan chart hiển thị đầy đủ (thời gian tải < 500ms nhờ ISR `300s`).
   - Mở `https://<your-project>.vercel.app/robots.txt`, `/sitemap.xml`, `/opengraph-image` -> trả HTTP `200`.
   - Mở Telegram nhắn `/today` cho `@minhmh_coffee_tracker_bot` -> nhận phản hồi tự động qua webhook (nếu Render đang ngủ sẽ mất ~45–60s ở tin đầu tiên để container thức dậy, các tin sau phản hồi dưới `2s`).

---

## 7. Xử lý Sự cố Thường gặp (Troubleshooting)

- **Bot Telegram nhắn không trả lời sau khi chuyển lên Cloud:**
  - Chạy `getWebhookInfo` kiểm tra `last_error_message`. Nếu thấy lỗi `401`, đối chiếu lại `TELEGRAM_WEBHOOK_SECRET` khi gọi `setWebhook` với biến trên Render.
  - Nếu ở local còn mở `coffee_tracker_orchestrator` ở chế độ polling, hãy đặt `TELEGRAM_MODE=webhook` hoặc dừng container polling local nếu dùng chung token.
- **Lệnh `weekly_forecast` báo timeout trên Render:**
  - Kiểm tra `ML_SERVICE_URL` đã chuẩn HTTPS HF Space chưa và `ML_WAKE_BEFORE_FORECAST=true` đã bật chưa. HF Spaces tự ngủ sau ~48h không traffic và cần bước wake trong `.github/workflows/daily-cron.yml`.
- **Dashboard Vercel báo lỗi CORS khi bấm cập nhật hoặc fetch client:**
  - Đối chiếu `CORS_ORIGIN` trên Render khớp chính xác scheme + domain Vercel (không có `/` ở cuối).
- **Dashboard hiển thị dữ liệu cũ tạm thời:**
  - Do Vercel ISR cache tối đa `5 phút` (`revalidate = 300`). Nhấn tải lại trang sau khi `dashboard client` đồng bộ API mới nhất từ Render.
