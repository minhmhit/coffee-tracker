# STEP REPORT: STEP 0.1 — Monorepo Scaffolding & Docker Compose Environment

- **Date / Time:** 2026-11-22 19:45 (UTC+7)
- **Phase / Step:** Phase 0 — Step 0.1
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Khởi tạo kiến trúc monorepo tiêu chuẩn (`apps/orchestrator`, `apps/ml-service`, `apps/web`) với `docker-compose.yml` hợp nhất chạy PostgreSQL 17, Redis 7, NestJS orchestrator và Python FastAPI ML service.
- Thiết lập tệp cấu hình môi trường `.env.example`, `.env`, cơ chế healthchecks cho toàn bộ container và quy trình khởi động cục bộ tin cậy.

## 2. Clarifications Resolved (Anti-Hallucination Log)

Theo quy định nghiêm ngặt tại mục `AMBIGUITY CHECK`:
1. **Câu hỏi:** Node.js package manager cho NestJS & Next.js?
   - **Xác nhận từ User:** `pnpm` (sử dụng pnpm v11.5.2).
2. **Câu hỏi:** Python dependency manager cho `apps/ml-service`?
   - **Xác nhận từ User:** `pip + .venv + requirements.txt`.
3. **Câu hỏi:** Cổng kết nối local (`5432`, `6379`, `3001`, `8000`, `3000`) có khả dụng hay cần map cổng tùy chỉnh?
   - **Xác nhận từ User:** Giữ nguyên các cổng mặc định: `5432` (Postgres), `6379` (Redis), `3001` (NestJS), `8000` (FastAPI), `3000` (Next.js). Đã kiểm tra qua hệ thống mạng host: toàn bộ các cổng này đều hoàn toàn trống.

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `.gitignore` | `MODIFY` | Loại bỏ `docs/` để theo dõi tài liệu và báo cáo, bổ sung bỏ qua `.env`, `.venv`, `dist`, v.v. |
| `.dockerignore` | `CREATE` | Tránh tải `node_modules`, `.venv`, `dist` vào Docker build context |
| `.env.example` | `CREATE` | Bản mẫu cấu hình môi trường chuẩn cho toàn bộ hệ thống |
| `.env` | `CREATE` | File biến môi trường cục bộ (được bỏ qua bởi git) |
| `pnpm-workspace.yaml` | `CREATE` | Cấu hình monorepo workspace cho pnpm (`apps/*`) |
| `package.json` | `CREATE` | Root package.json điều phối workspace và scripts |
| `docker-compose.yml` | `CREATE` | Compose orchestration cho Postgres 17, Redis 7, NestJS, FastAPI |
| `apps/orchestrator/package.json` | `CREATE` | NestJS dependencies & build scripts |
| `apps/orchestrator/tsconfig.json` | `CREATE` | TypeScript compiler configuration |
| `apps/orchestrator/tsconfig.build.json` | `CREATE` | TypeScript build configuration |
| `apps/orchestrator/nest-cli.json` | `CREATE` | Nest CLI configuration |
| `apps/orchestrator/src/main.ts` | `CREATE` | Entry point NestJS lắng nghe port 3001 |
| `apps/orchestrator/src/app.module.ts` | `CREATE` | Root AppModule NestJS |
| `apps/orchestrator/src/health/health.controller.ts` | `CREATE` | Health endpoint `GET /health` trả về HTTP 200 |
| `apps/orchestrator/src/health/health.module.ts` | `CREATE` | Module health check |
| `apps/orchestrator/Dockerfile` | `CREATE` | Multi-stage Dockerfile cho NestJS chạy pnpm |
| `apps/orchestrator/.dockerignore` | `CREATE` | Dockerignore cho orchestrator build context |
| `apps/ml-service/requirements.txt` | `CREATE` | Python dependencies (fastapi, uvicorn, pydantic) |
| `apps/ml-service/app/__init__.py` | `CREATE` | Python package init |
| `apps/ml-service/app/main.py` | `CREATE` | FastAPI app với endpoint `GET /health` |
| `apps/ml-service/Dockerfile` | `CREATE` | Python 3.12-slim Dockerfile uvicorn port 8000 |
| `apps/ml-service/.dockerignore` | `CREATE` | Dockerignore cho ml-service build context |
| `apps/web/package.json` | `CREATE` | Placeholder workspace cho Next.js |
| `apps/web/README.md` | `CREATE` | Tài liệu placeholder cho web frontend (Phase 4) |

## 4. Implementation Details

- **Docker Compose Networking & Volumes:**
  - `postgres`: image `postgres:17-alpine`, volume `postgres_data`, timezone `Asia/Ho_Chi_Minh`, healthcheck qua `pg_isready`.
  - `redis`: image `redis:7-alpine`, volume `redis_data`, lệnh `redis-server --appendonly yes`, healthcheck qua `redis-cli ping`.
  - `orchestrator`: multi-stage Dockerfile Node 22 Alpine, phụ thuộc vào postgres và redis (`condition: service_healthy`), healthcheck native qua Node.js fetch trên `http://localhost:3001/health`.
  - `ml-service`: Python 3.12-slim, uvicorn server port 8000, healthcheck qua `urllib.request` trên `http://localhost:8000/health`.
- **Anti-Symlink Isolation:** Tạo `.dockerignore` tại root và từng app để ngăn Docker build context gặp lỗi symlink của Windows/pnpm trên `node_modules/@nestjs/cli`.

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

- [x] Check 1: `docker compose config` passes with 0 syntax errors — **PASS**
- [x] Check 2: `docker compose up -d --build` brings up `postgres`, `redis`, `orchestrator`, `ml-service` in `healthy` / `running` state — **PASS**
- [x] Check 3: `curl -f http://localhost:3001/health` returns HTTP 200 — **PASS**
- [x] Check 4: `curl -f http://localhost:8000/health` returns `{"status":"ok"}` — **PASS**
- [x] Check 5: Confirm `.env` is ignored by git (`git status` shows no secrets) — **PASS**

### Terminal Output 1: `docker compose ps`
```text
NAME                          IMAGE                         COMMAND                  SERVICE        CREATED          STATUS                    PORTS
coffee_tracker_ml_service     coffee_tracker-ml-service     "uvicorn app.main:ap…"   ml-service     23 seconds ago   Up 53 seconds (healthy)   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp
coffee_tracker_orchestrator   coffee_tracker-orchestrator   "docker-entrypoint.s…"   orchestrator   23 seconds ago   Up 45 seconds (healthy)   0.0.0.0:3001->3001/tcp, [::]:3001->3001/tcp
coffee_tracker_postgres       postgres:17-alpine            "docker-entrypoint.s…"   postgres       23 seconds ago   Up 53 seconds (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
coffee_tracker_redis          redis:7-alpine                "docker-entrypoint.s…"   redis          23 seconds ago   Up 53 seconds (healthy)   0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
```

### Terminal Output 2: `curl.exe -i http://localhost:3001/health`
```text
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 79
ETag: W/"4f-1qLoTDLddjZE9rLKDaZibWOzAyI"
Date: Sun, 22 Nov 2026 12:45:17 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"status":"ok","service":"orchestrator","timestamp":"2026-11-22T12:45:17.851Z"}
```

### Terminal Output 3: `curl.exe -i http://localhost:8000/health`
```text
HTTP/1.1 200 OK
date: Sun, 22 Nov 2026 12:45:17 GMT
server: uvicorn
content-length: 15
content-type: application/json

{"status":"ok"}
```

### Terminal Output 4: `git check-ignore -v .env` & `git status`
```text
PS F:\coffee_tracker> git check-ignore -v .env
.gitignore:2:.env	.env

PS F:\coffee_tracker> git status
On branch dev
Your branch is up to date with 'origin/dev'.

Changes to be committed:
	modified:   .gitignore

Untracked files:
	.dockerignore
	.env.example
	apps/
	docker-compose.yml
	docs/
	package.json
	pnpm-lock.yaml
	pnpm-workspace.yaml
```
