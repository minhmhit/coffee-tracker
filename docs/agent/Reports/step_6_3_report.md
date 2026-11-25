# STEP REPORT: STEP 6.3 — PRODUCTION DOCKERFILE & DOCKER COMPOSE INTEGRATION (`apps/web`)

- **Date / Time:** 2026-11-25 17:31 (UTC+7)
- **Phase / Step:** Phase 6 — Step 6.3
- **Status:** `PASS (5/5 Containers Healthy, Non-Root Standalone 282MB, SSR Inter-Container Verified, CONSOLE_ERRORS=[])`

---

## 1. Goals & Scope Recap

- Đóng gói `apps/web` (Next.js 15 App Router) bằng multi-stage production `Dockerfile` sử dụng `output: 'standalone'` và tích hợp làm service thứ 5 (`web` / `coffee_tracker_web`) trong root `docker-compose.yml`.
- Tách bạch hoàn toàn URL trình duyệt lúc build (`NEXT_PUBLIC_API_URL=http://localhost:3001`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`) với URL nội bộ giữa các container cho SSR (`INTERNAL_API_URL=http://orchestrator:3001`).
- Đảm bảo container frontend chạy dưới quyền non-root (`uid=1001(nextjs)` trên `node:20-alpine`) và vượt qua kiểm tra `healthcheck` (`http://127.0.0.1:3000`) cùng hệ thống 5 container (`postgres`, `redis`, `orchestrator`, `ml-service`, `web`).

---

## 2. Clarifications Resolved (Ambiguity Check)

1. **Port Mapping:** `3000:3000` (`${WEB_PORT:-3000}:3000`).
2. **Build-Time Public URLs:** Mặc định `NEXT_PUBLIC_API_URL=http://localhost:3001` và `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (cho phép ghi đè qua `.env`), còn `INTERNAL_API_URL=http://orchestrator:3001`.

---

## 3. Technical Notes & Root-Cause Fixes During Dockerization

1. **Tương thích `pnpm@11.5.2` + `node:sqlite` trên Alpine:** `pnpm@11.5.2` yêu cầu Node `>= 22.13` (`node:sqlite` built-in). Stage `deps` & `builder` dùng `node:22-alpine` (kèm `node-linker=hoisted`, `fetch-retries=5`, `fetch-timeout=120000`, `network-concurrency=4`), còn Stage `runner` chạy nhẹ trên `node:20-alpine` với user `nextjs:nodejs`.
2. **Sửa lỗi `next/font/google` trong Docker BuildKit:** Thiết lập `ENV NODE_OPTIONS="--dns-result-order=ipv4first"` trong Stage `builder` và chạy trực tiếp `./node_modules/.bin/next build` giúp tải `Newsreader`, `Inter`, `JetBrains_Mono` thành công `100%` (`7/7` routes).

---

## 4. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/web/next.config.js` | `MODIFY` | Bật `output: 'standalone'` giảm dung lượng image đóng gói |
| `apps/web/.dockerignore` | `CREATE` | Loại trừ `node_modules`, `.next`, `.git`, `.env*`, `npm-debug.log*` |
| `apps/web/Dockerfile` | `CREATE` | Multi-stage (`deps` -> `builder` với build ARGs -> non-root `runner` `node:20-alpine`) |
| `docker-compose.yml` | `MODIFY` | Thêm service `web` (`coffee_tracker_web`), `INTERNAL_API_URL=http://orchestrator:3001`, `healthcheck` 30s |
| `.env.example` | `MODIFY` | Bổ sung tài liệu hóa `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_API_URL` |

---

## 5. Verification Outputs (All Executed Cleanly)

### 5.1 Docker Compose Config & Build (`web`)

- `docker compose config --quiet`: **PASS** (`DOCKER_COMPOSE_CONFIG_OK`).
- `docker compose build web`: **PASS** (`✓ Compiled successfully in 17.1s`, `Generating static pages (7/7)`, built `coffee_tracker-web:latest`).
- **Image Size (`docker images coffee_tracker-web`):** **`282MB`**.
- **Non-Root Container Check (`docker exec coffee_tracker_web id`):** `uid=1001(nextjs) gid=65533(nogroup)`.

### 5.2 Stack Status (`docker compose up -d --wait` & `docker compose ps`)

*(Lưu ý: khi chạy `docker compose up -d --build` song song 3 image trước đó, luồng `pnpm install` trong `orchestrator` gặp timeout npmjs tại 623/661 gói; sau khi build xong `coffee_tracker-web`, chạy `docker compose up -d --wait` khởi động đồng bộ toàn bộ stack lên trạng thái `healthy` cùng 4 container `postgres`, `redis`, `orchestrator`, `ml-service` đang chạy sẵn).*

| Container | Image | Status | Host Port | Idle CPU | Idle RAM |
| :-------- | :---- | :----- | :-------- | :------- | :------- |
| `coffee_tracker_postgres` | `postgres:17-alpine` | `Up (healthy)` | `5432` | `0.00%` | `74.04MiB` |
| `coffee_tracker_redis` | `redis:7-alpine` | `Up (healthy)` | `6379` | `0.40%` | `9.637MiB` |
| `coffee_tracker_ml_service` | `coffee_tracker-ml-service` | `Up (healthy)` | `8000` | `38.01%` | `166.7MiB` |
| `coffee_tracker_orchestrator` | `coffee_tracker-orchestrator` | `Up (healthy)` | `3001` | `0.08%` | `68.28MiB` |
| `coffee_tracker_web` | `coffee_tracker-web` | `Up (healthy)` | `3000` | `0.00%` | `59.48MiB` |

### 5.3 Live HTTP & Chrome Console/CORS Check on Containerized `:3000`

- `curl.exe -s -I http://localhost:3000`: **`HTTP/1.1 200 OK`**, `Content-Type: text/html; charset=utf-8`.
- `GET http://localhost:3000/` (`169.179 bytes`): `SSR_HAS_PRICE_71800=True`, `SSR_HAS_DOD_PCT=True`, `SSR_HAS_WEATHER=True` (xác nhận `coffee_tracker_web` gọi thành công `INTERNAL_API_URL=http://orchestrator:3001` qua mạng nội bộ Docker).
- `GET http://localhost:3000/opengraph-image`: `HTTP 200` (`61.212 bytes`).
- **Headless Chrome / Lighthouse trên containerized `:3000`:**
  - `Performance: 83`, `Accessibility: 100`, `Best Practices: 100`, `SEO: 100`, `CLS: 0`.
  - **`CONSOLE_ERRORS: []`** (zero console/CORS errors).
