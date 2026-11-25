# STEP REPORT: STEP 1.2 — BULLMQ INGESTION QUEUE, CRON SCHEDULERS & HISTORICAL BACKFILL CLI

- **Date / Time:** 2026-11-22 21:23 (UTC+7)
- **Phase / Step:** Phase 1 — Step 1.2
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Tích hợp BullMQ + Redis vào NestJS với queue `ingestion-queue`.
- Cấu hình 2 lịch lặp lại (repeatable cron schedulers) theo giờ `Asia/Ho_Chi_Minh`:
  1. `30 8 * * *` (08:30 sáng) — Cập nhật giá cà phê nội địa Tây Nguyên.
  2. `0 1 * * *` (01:00 đêm) — Cập nhật giá chốt phiên hợp đồng tương lai ICE London Robusta.
- Xây dựng `IngestionProcessor` xử lý job hàng đợi với cơ chế retry 5 lần (`attempts: 5`) cùng exponential backoff bắt đầu từ 10.000 ms (10s), tự động bắt sự kiện `failed` để chuẩn bị bắn cảnh báo Telegram khi thất bại toàn bộ số lần thử.
- Hiện thực hàm `upsertDailySnapshot` trong `IngestionService` tuân thủ nguyên tắc **Idempotent** và **Zero Float Principle** (100% cột tiền tệ/chỉ số dùng Prisma `Decimal` / PostgreSQL `NUMERIC`).
- Xây dựng CLI script Backfill lịch sử (`apps/orchestrator/src/ingestion/scripts/backfill-history.ts`) nạp toàn bộ chuỗi thời gian liên tục từ ngày `2018-01-01` đến nay vào PostgreSQL.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Historical Backfill Data Source:** Người dùng chọn phương án: Sinh dữ liệu mẫu lịch sử mô phỏng thực tế (Synthetic Historical Data 2018–nay) bám sát các chu kỳ và phân phối giá thật (Đắk Lắk ~30.000 - 134.000 VND/kg, London ~1.150 - 5.500 USD/tấn, USD/VND ~22.750 - 25.600, Brent ~20 - 125 USD).
- **Retry & Backoff Configuration:** Người dùng chọn cấu hình: 5 lần thử lại (`attempts: 5`), exponential backoff bắt đầu từ 10.000 ms (`delay: 10000`).
- **Failure Notification Behavior:** Người dùng chọn: Ghi log WARN/ERROR chi tiết và đưa job thất bại vào Failed Queue sẵn sàng tích hợp Telegram Alert ở Phase 2.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/ingestion/ingestion.constants.ts` | `CREATE` | Định nghĩa tên queue `ingestion-queue`, hằng số jobs, crons và options |
| `apps/orchestrator/src/ingestion/processors/ingestion.processor.ts` | `CREATE` | WorkerHost xử lý job BullMQ, validation, upsert và bắt sự kiện thất bại |
| `apps/orchestrator/src/ingestion/schedulers/ingestion.scheduler.ts` | `CREATE` | OnModuleInit đăng ký 2 repeatable job schedulers (08:30 và 01:00) qua BullMQ v5 API |
| `apps/orchestrator/src/ingestion/scripts/backfill-history.ts` | `CREATE` | Script CLI nạp 3.247 ngày dữ liệu lịch sử liên tục 2018-2026 vào PostgreSQL |
| `apps/orchestrator/src/ingestion/test/ingestion-processor.spec.ts` | `CREATE` | 5 unit tests kiểm thử IngestionProcessor & IngestionScheduler |
| `apps/orchestrator/src/ingestion/ingestion.service.ts` | `MODIFY` | Thêm `upsertDailySnapshot` và `getLatestDaklakPrice` kết nối Prisma |
| `apps/orchestrator/src/ingestion/ingestion.module.ts` | `MODIFY` | Wire `BullModule.registerQueue`, Processor và Scheduler |
| `apps/orchestrator/src/app.module.ts` | `MODIFY` | Cấu hình `BullModule.forRoot` kết nối Redis |
| `apps/orchestrator/src/ingestion/scripts/dry-run.ts` | `MODIFY` | Cập nhật kiểm thử upsert bản ghi thực tế ngày 2026-11-22 |
| `apps/orchestrator/package.json` | `MODIFY` | Bổ sung dependencies `bullmq`, `ioredis`, scripts `backfill` |

---

## 4. Implementation Details

1. **BullMQ v5 Job Schedulers API:** Tận dụng method mới `upsertJobScheduler()` của BullMQ v5 để lên lịch định kỳ theo múi giờ `Asia/Ho_Chi_Minh` cho 2 phiên thị trường mà không bị phụ thuộc vào package cron bên ngoài, đồng thời hỗ trợ kiểm tra số lượng scheduler hoạt động (`getJobSchedulersCount()`).
2. **Idempotent Upsert:** Prisma `rawMarketPrice.upsert` trên khóa duy nhất `@unique price_date`. Nếu chạy lại script nhiều lần hoặc cron kích hoạt lại trong ngày, hệ thống chỉ cập nhật bản ghi hiện tại mà không tạo bản ghi mới hay gây lỗi xung đột khóa chính.
3. **Chunked Transaction Backfill:** Script backfill phân chia 3.247 ngày thành các batch 150 ngày và thực hiện qua `prisma.$transaction()`, giúp quá trình nạp hoàn thành chỉ trong `7,23 giây` mà không gây tràn bộ nhớ hay nghẽn kết nối database.
4. **Zero Float Principle:** Toàn bộ các trường `price_daklak`, `price_lamdong`, `price_gialai`, `price_daknong`, `price_avg`, `london_m1`, `london_m3`, `london_m6`, `usd_vnd`, `brent_oil` đều được khởi tạo và lưu trữ bằng `new Prisma.Decimal(...)`.

---

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

- [x] Check 1: `pnpm --filter @coffee-tracker/orchestrator test` — **PASS** (16/16 tests pass)
- [x] Check 2: `pnpm --filter @coffee-tracker/orchestrator run build` — **PASS** (0 TypeScript errors)
- [x] Check 3: `pnpm --filter @coffee-tracker/orchestrator run backfill` — **PASS** (3.247 records seeded in 7.23s)
- [x] Check 4: Idempotent & Live Ingestion dry-run — **PASS** (Record ID 3248 persisted and confirmed)
- [x] Check 5: `docker compose exec postgres psql ...` — **PASS** (3.248 continuous rows in DB)

### A. Jest Unit Test Results (16/16 Tests PASS)

```text
$ jest
[Nest] 17960  - 21:21:37 22/11/2026     LOG [DomesticCoffeeAdapter] Fetching domestic coffee prices from primary source: https://giacaphe.com/gia-ca-phe-noi-dia/
[Nest] 17960  - 21:21:37 22/11/2026    WARN [DomesticCoffeeAdapter] Primary source failed: Connection timeout to primary source. Attempting fallback...
[Nest] 26168  - 21:21:39 22/11/2026   ERROR [IngestionProcessor] Ingestion sanity validation failed: Price jump 25% exceeds ±15% threshold
[Nest] 26168  - 21:21:39 22/11/2026   ERROR [IngestionProcessor] [CRITICAL ALERT] Ingestion job job-retry permanently failed after 5 attempts! Reason: Network timeout. Ready for Telegram alert dispatch.
PASS src/ingestion/test/ingestion.spec.ts (11.85 s)
PASS src/ingestion/test/ingestion-processor.spec.ts (11.895 s)
[Nest] 17960  - 21:21:39 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 1 reasons: Đắk Lắk day-over-day price jump (25.00%) exceeds ±15% threshold (Previous: 71800, Current: 89750)
[Nest] 17960  - 21:21:39 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 2 reasons: Benchmark province Đắk Lắk price is invalid or <= 0: -50000; Lâm Đồng price is invalid or <= 0: 0
[Nest] 17960  - 21:21:39 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 1 reasons: Benchmark province Đắk Lắk price is invalid or <= 0: NaN
[Nest] 17960  - 21:21:39 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 2 reasons: USD/VND rate is outside plausible commercial bounds (15k - 40k): 500; Brent oil price is outside plausible bounds (20 - 300 USD): 5

Test Suites: 2 passed, 2 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        15.33 s
Ran all test suites.
$ nest build
```

### B. Historical Backfill Execution Output

```text
================================================================
   COFFEE TRACKER — HISTORICAL MARKET DATA BACKFILL (2018-2026) 
================================================================
Generated 3247 continuous daily points (2018-01-01 to 2026-11-21).
First point: 2018-01-01 — Dak Lak: 36400 VND/kg
Last point:  2026-11-21 — Dak Lak: 72100 VND/kg
Backfilling progress: 3247 / 3247 records upserted...
Backfill completed successfully in 7.23s! Total records: 3247

--- VERIFICATION SUMMARY ---
Total DB Records:   3247
Earliest Date:     2018-01-01
Latest Date:       2026-11-21
Min Dak Lak Price: 30400 VND/kg
Max Dak Lak Price: 132100 VND/kg
Avg Dak Lak Price: 56543.76 VND/kg
```

### C. Live Ingestion & PostgreSQL Verification Output

```text
================================================================
   COFFEE TRACKER — LIVE MARKET DATA INGESTION DRY-RUN (CLI)   
================================================================
[Nest] 15208  - 21:20:37 22/11/2026     LOG [PrismaService] Connected to PostgreSQL via Prisma
[Nest] 15208  - 21:20:37 22/11/2026     LOG [IngestionScheduler] Registering BullMQ scheduled repeatable ingestion jobs...
[Nest] 15208  - 21:20:37 22/11/2026     LOG [IngestionScheduler] Scheduled [INGEST_DAILY_MARKET_DATA] at 30 8 * * * (Asia/Ho_Chi_Minh)
[Nest] 15208  - 21:20:37 22/11/2026     LOG [IngestionScheduler] Scheduled [INGEST_DAILY_MARKET_DATA] at 0 1 * * * (Asia/Ho_Chi_Minh)
[Nest] 15208  - 21:20:37 22/11/2026     LOG [IngestionScheduler] Active job schedulers in 'ingestion-queue': 2
...
   VALIDATION STATUS: PASSED (VALID)

   APPLYING IDEMPOTENT UPSERT TO POSTGRESQL...
[Nest] 15208  - 21:20:38 22/11/2026     LOG [IngestionService] Successfully upserted market price record for date 2026-11-22 (ID: 3248, Dak Lak: 71800 VND/kg)
   Record persisted! ID: 3248, Date: 2026-11-22, Đắk Lắk: 71800 VND/kg

$ docker compose exec postgres psql -U postgres -d coffee_tracker -c "SELECT count(*) FROM raw_market_prices;"
 count 
-------
  3248
(1 row)
```
