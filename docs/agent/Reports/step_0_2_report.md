# STEP REPORT: STEP 0.2 — PostgreSQL Schema & Prisma Migration Setup

- **Date / Time:** 2026-11-22 20:20 (UTC+7)
- **Phase / Step:** Phase 0 — Step 0.2
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Triển khai 5 bảng dữ liệu cốt lõi trong PostgreSQL (`raw_market_prices`, `macro_climate_monthly`, `daily_signals`, `forecast_runs`, `forecast_predictions`) bên trong `apps/orchestrator` sử dụng Prisma ORM.
- Đảm bảo độ chính xác tài chính với kiểu `DECIMAL` / `NUMERIC` cho toàn bộ các cột giá, tỷ giá, chênh lệch và dự báo — TUYỆT ĐỐI KHÔNG DÙNG `Float`.
- Thiết lập đầy đủ khóa ngoại (Foreign Keys), ràng buộc duy nhất (Unique constraints) và chỉ mục hiệu năng (Performance indexes).
- Thực thi **Nguyên tắc Single Writer**: NestJS độc quyền quản lý migrations và ghi dữ liệu PostgreSQL.
- Tạo `PrismaService` và `PrismaModule` (Global) tích hợp vào `AppModule`.

## 2. Clarifications Resolved (Anti-Hallucination Log)

1. **Câu hỏi:** Xác nhận lựa chọn ORM (Prisma vs TypeORM)?
   - **Xác nhận từ User:** Prisma ORM (chuẩn hóa theo Context.md & Rule.md).
2. **Câu hỏi:** Bảng `raw_market_prices` có cần theo dõi thêm tỉnh nào ngoài 4 tỉnh trọng điểm?
   - **Xác nhận từ User:** Chỉ 4 tỉnh trọng điểm Tây Nguyên: Đắk Lắk (benchmark chính), Lâm Đồng, Gia Lai, Đắk Nông.

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/prisma/schema.prisma` | `CREATE` | Định nghĩa 5 model thực thể với kiểu dữ liệu Decimal chính xác, quan hệ khóa ngoại và indexes |
| `apps/orchestrator/prisma/migrations/20261122131230_init_coffee_schema/migration.sql` | `CREATE` | File SQL migration ban đầu được áp dụng tự động vào PostgreSQL |
| `apps/orchestrator/src/prisma/prisma.service.ts` | `CREATE` | NestJS Injectable service kế thừa PrismaClient với lifecycle hooks (`onModuleInit`, `onModuleDestroy`) |
| `apps/orchestrator/src/prisma/prisma.module.ts` | `CREATE` | Module `@Global()` cung cấp và xuất `PrismaService` |
| `apps/orchestrator/src/app.module.ts` | `MODIFY` | Nhập `PrismaModule` vào `AppModule` |
| `apps/orchestrator/package.json` | `MODIFY` | Bổ sung dependencies `@prisma/client` và `prisma` |
| `pnpm-workspace.yaml` | `MODIFY` | Khai báo `onlyBuiltDependencies` cho `@prisma/client`, `@prisma/engines`, `prisma` |
| `apps/orchestrator/Dockerfile` | `MODIFY` | Bổ sung bước copy `prisma/` và `prisma generate` vào build pipeline |

## 4. Implementation Details

- **Bảo toàn tính toán tài chính (Zero Float):**
  - Mọi trường giá nội địa (`price_daklak`, `price_lamdong`, `price_gialai`, `price_daknong`, `price_avg`): `DECIMAL(12, 2)` (VNĐ/kg).
  - Giá quốc tế và ngoại tệ (`london_m1`, `london_m3`, `london_m6`, `usd_vnd`, `brent_oil`): `DECIMAL(10, 2)`.
  - Chỉ số khí hậu (`oni_index`): `DECIMAL(5, 2)`, dị thường lượng mưa (`vn_rain_anomaly`, `br_rain_anomaly`): `DECIMAL(8, 2)`.
  - Tín hiệu giao dịch (`basis`: `DECIMAL(12, 2)`, `spread`: `DECIMAL(10, 2)`, `volatility_30d`: `DECIMAL(10, 4)`, `z_score`: `DECIMAL(8, 4)`).
  - Dự báo tương lai (`pred_p10`, `pred_p50`, `pred_p90`, `baseline_rw`, `baseline_futures`, `actual_price`): `DECIMAL(12, 2)`.
- **Ràng buộc & Chỉ mục:**
  - `raw_market_prices.price_date`: `@unique @db.Date` kèm descending index `@@index([price_date(sort: Desc)])`.
  - `daily_signals.signal_date`: `@id @db.Date`, khóa ngoại tham chiếu `raw_market_prices(price_date)` với `ON DELETE CASCADE`.
  - `forecast_runs.run_id`: `@id @db.Uuid`, trạng thái enum `ForecastRunStatus` (`SUCCESS`, `FAILED`).
  - `forecast_predictions`: Ràng buộc duy nhất `@@unique([run_id, horizon_week])`, khóa ngoại tham chiếu `forecast_runs(run_id)` với `ON DELETE CASCADE`, index trên `target_date DESC`.

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

- [x] Check 1: `prisma validate` exits 0 — **PASS**
- [x] Check 2: `prisma migrate status` reports database schema is up to date — **PASS**
- [x] Check 3: Run `\dt` and `\d` on all 5 tables via `psql` confirming all tables, numeric types, FKs, and unique indexes exist — **PASS**
- [x] Check 4: NestJS compiles (`pnpm --filter @coffee-tracker/orchestrator run build`) with 0 TypeScript errors — **PASS**

### Terminal Output 1: `prisma validate` & `prisma migrate status`
```text
PS F:\coffee_tracker> pnpm --filter @coffee-tracker/orchestrator exec prisma validate
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
The schema at prisma\schema.prisma is valid 🚀

PS F:\coffee_tracker> pnpm --filter @coffee-tracker/orchestrator exec prisma migrate status
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "coffee_tracker", schema "public" at "localhost:5432"

1 migration found in prisma/migrations
Database schema is up to date!
```

### Terminal Output 2: Danh sách 5 bảng trong PostgreSQL (`\dt`)
```text
PS F:\coffee_tracker> docker compose exec -T postgres psql -U postgres -d coffee_tracker -c "\dt"
                 List of relations
 Schema |         Name          | Type  |  Owner   
--------+-----------------------+-------+----------
 public | _prisma_migrations    | table | postgres
 public | daily_signals         | table | postgres
 public | forecast_predictions  | table | postgres
 public | forecast_runs         | table | postgres
 public | macro_climate_monthly | table | postgres
 public | raw_market_prices     | table | postgres
(6 rows)
```

### Terminal Output 3: Chi tiết cấu trúc 5 bảng (`\d <table>`)
```text
PS F:\coffee_tracker> docker compose exec -T postgres psql -U postgres -d coffee_tracker -c "\d raw_market_prices" -c "\d macro_climate_monthly" -c "\d daily_signals" -c "\d forecast_runs" -c "\d forecast_predictions"

                                          Table "public.raw_market_prices"
    Column     |            Type             | Collation | Nullable |                    Default                    
---------------+-----------------------------+-----------+----------+-----------------------------------------------
 id            | integer                     |           | not null | nextval('raw_market_prices_id_seq'::regclass)
 price_date    | date                        |           | not null | 
 price_daklak  | numeric(12,2)               |           | not null | 
 price_lamdong | numeric(12,2)               |           | not null | 
 price_gialai  | numeric(12,2)               |           | not null | 
 price_daknong | numeric(12,2)               |           | not null | 
 price_avg     | numeric(12,2)               |           | not null | 
 london_m1     | numeric(10,2)               |           |          | 
 london_m3     | numeric(10,2)               |           |          | 
 london_m6     | numeric(10,2)               |           |          | 
 usd_vnd       | numeric(10,2)               |           |          | 
 brent_oil     | numeric(10,2)               |           |          | 
 source_meta   | jsonb                       |           |          | 
 created_at    | timestamp(6) with time zone |           | not null | CURRENT_TIMESTAMP
 updated_at    | timestamp(6) with time zone |           | not null | 
Indexes:
    "raw_market_prices_pkey" PRIMARY KEY, btree (id)
    "raw_market_prices_price_date_idx" btree (price_date DESC)
    "raw_market_prices_price_date_key" UNIQUE, btree (price_date)
Referenced by:
    TABLE "daily_signals" CONSTRAINT "daily_signals_signal_date_fkey" FOREIGN KEY (signal_date) REFERENCES raw_market_prices(price_date) ON UPDATE CASCADE ON DELETE CASCADE

                           Table "public.macro_climate_monthly"
     Column      |            Type             | Collation | Nullable |      Default      
-----------------+-----------------------------+-----------+----------+-------------------
 month_date      | date                        |           | not null | 
 oni_index       | numeric(5,2)                |           |          | 
 vn_rain_anomaly | numeric(8,2)                |           |          | 
 br_rain_anomaly | numeric(8,2)                |           |          | 
 created_at      | timestamp(6) with time zone |           | not null | CURRENT_TIMESTAMP
 updated_at      | timestamp(6) with time zone |           | not null | 
Indexes:
    "macro_climate_monthly_pkey" PRIMARY KEY, btree (month_date)
    "macro_climate_monthly_month_date_idx" btree (month_date DESC)

                              Table "public.daily_signals"
     Column     |            Type             | Collation | Nullable |      Default      
----------------+-----------------------------+-----------+----------+-------------------
 signal_date    | date                        |           | not null | 
 basis          | numeric(12,2)               |           | not null | 
 spread         | numeric(10,2)               |           |          | 
 volatility_30d | numeric(10,4)               |           |          | 
 z_score        | numeric(8,4)                |           |          | 
 is_anomaly     | boolean                     |           | not null | false
 regime         | text                        |           |          | 
 notes          | text                        |           |          | 
 created_at     | timestamp(6) with time zone |           | not null | CURRENT_TIMESTAMP
 updated_at     | timestamp(6) with time zone |           | not null | 
Indexes:
    "daily_signals_pkey" PRIMARY KEY, btree (signal_date)
    "daily_signals_signal_date_idx" btree (signal_date DESC)
Foreign-key constraints:
    "daily_signals_signal_date_fkey" FOREIGN KEY (signal_date) REFERENCES raw_market_prices(price_date) ON UPDATE CASCADE ON DELETE CASCADE

                              Table "public.forecast_runs"
    Column     |            Type             | Collation | Nullable |      Default      
---------------+-----------------------------+-----------+----------+-------------------
 run_id        | uuid                        |           | not null | 
 forecast_date | date                        |           | not null | 
 status        | "ForecastRunStatus"         |           | not null | 
 model_version | text                        |           |          | 
 blend_weights | jsonb                       |           |          | 
 metrics       | jsonb                       |           |          | 
 error_message | text                        |           |          | 
 created_at    | timestamp(6) with time zone |           | not null | CURRENT_TIMESTAMP
 updated_at    | timestamp(6) with time zone |           | not null | 
Indexes:
    "forecast_runs_pkey" PRIMARY KEY, btree (run_id)
    "forecast_runs_forecast_date_idx" btree (forecast_date DESC)
    "forecast_runs_status_idx" btree (status)
Referenced by:
    TABLE "forecast_predictions" CONSTRAINT "forecast_predictions_run_id_fkey" FOREIGN KEY (run_id) REFERENCES forecast_runs(run_id) ON UPDATE CASCADE ON DELETE CASCADE

                                           Table "public.forecast_predictions"
      Column      |            Type             | Collation | Nullable |                     Default                      
------------------+-----------------------------+-----------+----------+--------------------------------------------------
 id               | integer                     |           | not null | nextval('forecast_predictions_id_seq'::regclass)
 run_id           | uuid                        |           | not null | 
 horizon_week     | integer                     |           | not null | 
 target_date      | date                        |           | not null | 
 pred_p10         | numeric(12,2)               |           | not null | 
 pred_p50         | numeric(12,2)               |           | not null | 
 pred_p90         | numeric(12,2)               |           | not null | 
 baseline_rw      | numeric(12,2)               |           |          | 
 baseline_futures | numeric(12,2)               |           |          | 
 actual_price     | numeric(12,2)               |           |          | 
 error_pct        | numeric(8,4)                |           |          | 
 created_at       | timestamp(6) with time zone |           | not null | CURRENT_TIMESTAMP
Indexes:
    "forecast_predictions_pkey" PRIMARY KEY, btree (id)
    "forecast_predictions_run_id_horizon_week_key" UNIQUE, btree (run_id, horizon_week)
    "forecast_predictions_run_id_idx" btree (run_id)
    "forecast_predictions_target_date_idx" btree (target_date DESC)
Foreign-key constraints:
    "forecast_predictions_run_id_fkey" FOREIGN KEY (run_id) REFERENCES forecast_runs(run_id) ON UPDATE CASCADE ON DELETE CASCADE
```

### Terminal Output 4: `pnpm --filter @coffee-tracker/orchestrator run build`
```text
PS F:\coffee_tracker> pnpm --filter @coffee-tracker/orchestrator run build
$ nest build
```
*(Thoát mã code 0, không có bất kỳ lỗi TypeScript nào)*
