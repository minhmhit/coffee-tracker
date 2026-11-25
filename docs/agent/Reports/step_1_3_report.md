# STEP REPORT: STEP 1.3 — MONTHLY MACRO & CLIMATE INGESTION (NOAA ONI + OPEN-METEO RAINFALL ANOMALY)

- **Date / Time:** 2026-11-25 08:18 (UTC+7)
- **Phase / Step:** Phase 1 — Step 1.3
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng module thu thập chỉ số khí hậu đại dương hàng tháng (NOAA Oceanic Niño Index - ONI) và tính toán độ lệch lượng mưa (Rainfall Anomalies) cho vùng Tây Nguyên (Đắk Lắk, Việt Nam) và Espírito Santo (Linhares, Brazil) qua Open-Meteo Historical Archive API.
- Tích hợp job định kỳ hàng tháng (`0 3 5 * *` — ngày 5 hàng tháng lúc 03:00 sáng Asia/Ho_Chi_Minh) vào hàng đợi BullMQ `ingestion-queue`.
- Xây dựng script Backfill khí hậu (`apps/orchestrator/src/ingestion/scripts/backfill-climate.ts`) nạp toàn bộ chuỗi thời gian hàng tháng từ `2018-01-01` đến hiện tại (`2026-11-01`) vào bảng PostgreSQL `macro_climate_monthly`.
- Đảm bảo tính **Idempotent** (`UPSERT` trên `month_date`), **Zero Float Principle** (100% cột dùng kiểu `Decimal` / `NUMERIC`), và cơ chế **Defensive Fallback Cache** chịu lỗi khi mạng bên ngoài gặp sự cố hoặc timeout.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Tọa độ địa lý:** Đã xác nhận tọa độ đại diện Đắk Lắk (`12.6667, 108.0500` — Buôn Ma Thuột) và Brazil (`-19.3911, -40.0722` — Linhares, Espírito Santo).
- **Chu kỳ cơ sở tính độ lệch lượng mưa:** Đã xác nhận giai đoạn 2010–2020 (11 năm khí hậu trung bình hàng tháng theo Open-Meteo).
- **Nguồn NOAA ONI:** Đã xác nhận nguồn chính thức `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` cùng cơ chế fallback sang dataset local đã kiểm chứng khi gặp sự cố mạng/session limit.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/ingestion/adapters/noaa-oni.adapter.ts` | `CREATE` | Trích xuất và parse NOAA ASCII ONI dataset với mapping 12 mùa (DJF..NDJ -> YYYY-MM-01) cùng cơ chế fallback |
| `apps/orchestrator/src/ingestion/adapters/open-meteo.adapter.ts` | `CREATE` | Trích xuất lượng mưa Open-Meteo, gom theo tháng, tính mean cơ sở 2010–2020 và tính anomaly hàng tháng |
| `apps/orchestrator/src/ingestion/data/noaa-oni-cache.txt` | `CREATE` | Dataset dự phòng NOAA ONI chuẩn xác phục vụ môi trường offline/mạng gián đoạn |
| `apps/orchestrator/src/ingestion/data/climate-rainfall-cache.json` | `CREATE` | Dataset dự phòng lượng mưa Đắk Lắk và Linhares Brazil 2010–2026 |
| `apps/orchestrator/src/ingestion/scripts/backfill-climate.ts` | `CREATE` | Script CLI nạp 107 tháng dữ liệu khí hậu lịch sử liên tục (2018-2026) vào PostgreSQL |
| `apps/orchestrator/src/ingestion/test/climate-ingestion.spec.ts` | `CREATE` | 5 unit tests kiểm thử bộ trích xuất NOAA và thuật toán tính rainfall anomaly |
| `apps/orchestrator/src/ingestion/test/ingestion-processor.spec.ts` | `MODIFY` | Cập nhật kiểm thử IngestionProcessor và Scheduler cho monthly climate job (7/7 tests) |
| `apps/orchestrator/src/ingestion/ingestion.constants.ts` | `MODIFY` | Bổ sung hằng số `MONTHLY_CLIMATE` cho job và cron scheduler (`0 3 5 * *`) |
| `apps/orchestrator/src/ingestion/ingestion.service.ts` | `MODIFY` | Bổ sung method `syncMacroClimateMonthly()` điều phối fetch và idempotent upsert Prisma |
| `apps/orchestrator/src/ingestion/processors/ingestion.processor.ts` | `MODIFY` | Thêm nhánh xử lý `INGEST_MONTHLY_CLIMATE` trong WorkerHost |
| `apps/orchestrator/src/ingestion/schedulers/ingestion.scheduler.ts` | `MODIFY` | Đăng ký scheduler `monthly_climate_05_0300` qua BullMQ v5 API |
| `apps/orchestrator/src/ingestion/ingestion.module.ts` | `MODIFY` | Wire `NoaaOniAdapter`, `OpenMeteoAdapter` vào module providers & exports |
| `apps/orchestrator/package.json` | `MODIFY` | Bổ sung script `"backfill:climate"` |

---

## 4. Implementation Details

1. **NOAA Rolling Season Mid-Month Mapping:** Ánh xạ 12 mùa trượt 3 tháng của NOAA CPC về ngày đầu tháng chuẩn `YYYY-MM-01` (ví dụ `DJF 2024` -> `2024-01-01`, `JJA 2024` -> `2024-07-01`). Xử lý độ trễ công bố (publication lag): các tháng chưa có báo cáo được ghi nhận `null` thay vì giả định số liệu.
2. **Rainfall Anomaly Climatology:** Tính tổng lượng mưa từng tháng, tính trung bình cộng từng tháng (1..12) trong 11 năm chu kỳ chuẩn 2010–2020:
   $$\text{Anomaly}_{m, y} = \text{Rainfall}_{m, y} - \text{BaselineMean}_m$$
3. **Fault-Tolerant Dual-Mode Ingestion:** Khi mạng bên ngoài gặp sự cố (như session limit của router DrayTek hoặc timeout kết nối quốc tế), hệ thống tự động kích hoạt fallback sang dataset local để bảo vệ toàn bộ pipeline không bị đứt gãy. Khi kết nối online phục hồi, adapter tự động cập nhật bản ghi mới nhất trực tiếp từ máy chủ NOAA và Open-Meteo.
4. **Idempotent Upsert & Zero Float:** Sử dụng `prisma.macroClimateMonthly.upsert` trên khóa chính `@id month_date`. Tất cả các giá trị độ lệch mưa và chỉ số ONI đều được lưu trữ bằng `new Prisma.Decimal(...)`.

---

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

- [x] Check 1: `pnpm --filter @coffee-tracker/orchestrator test` — **PASS** (23/23 tests pass across 3 test suites)
- [x] Check 2: `pnpm --filter @coffee-tracker/orchestrator run build` — **PASS** (0 TypeScript errors)
- [x] Check 3: `pnpm --filter @coffee-tracker/orchestrator run backfill:climate` — **PASS** (107 months synced from 2018-01-01 to 2026-11-01)
- [x] Check 4: Idempotency Verification (Run backfill twice) — **PASS** (Total DB records unchanged at 107)
- [x] Check 5: `docker compose exec postgres psql ...` — **PASS** (107 records verified in DB)

### A. Jest Unit Test Results (23/23 Tests PASS)

```text
$ jest
PASS src/ingestion/test/ingestion.spec.ts (6.731 s)
PASS src/ingestion/test/climate-ingestion.spec.ts (8.275 s)
PASS src/ingestion/test/ingestion-processor.spec.ts (9.569 s)

Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        10.763 s
Ran all test suites.
$ nest build
```

### B. Climate Backfill & Database Verification Output

```text
================================================================
   COFFEE TRACKER — MACRO & CLIMATE MONTHLY BACKFILL (2018-2026)
================================================================
[Nest] 22604  - 08:16:46 25/11/2026     LOG [IngestionScheduler] Active job schedulers in 'ingestion-queue': 3
Synchronizing NOAA ONI and Open-Meteo Rainfall Anomalies (2018–present)...
[Nest] 22604  - 08:16:46 25/11/2026     LOG [IngestionService] Starting macro climate monthly synchronization from year 2018...
[Nest] 22604  - 08:16:47 25/11/2026     LOG [NoaaOniAdapter] Successfully parsed 921 NOAA ONI records in 1183ms from primary online source
[Nest] 22604  - 08:16:47 25/11/2026     LOG [OpenMeteoAdapter] Generated 107 monthly anomalies for Đắk Lắk (Buôn Ma Thuột) from online Open-Meteo API
[Nest] 22604  - 08:16:48 25/11/2026     LOG [OpenMeteoAdapter] Generated 107 monthly anomalies for Espírito Santo (Linhares) from online Open-Meteo API
[Nest] 22604  - 08:16:48 25/11/2026     LOG [IngestionService] Upserting 107 monthly climate records into PostgreSQL...
[Nest] 22604  - 08:16:48 25/11/2026     LOG [IngestionService] Macro climate sync completed! Synced 107 months (2018-01-01 to 2026-11-01)

Synchronization completed in 2.48s!
Total Months Processed: 107
Date Range:            2018-01-01 to 2026-11-01
Latest ONI Index:       2.46

--- POSTGRESQL VERIFICATION SUMMARY ---
Total DB Records:       107
Earliest Month Date:    2018-01-01
Latest Month Date:      2026-11-01
ONI Index (Min / Max):  -1.11 / 2.46 (Avg: 0.09)
VN Rain Anomaly (mm):   -140.26 / 405.32 (Avg: 43.27)
BR Rain Anomaly (mm):   -135.41 / 315.29 (Avg: 21.23)
================================================================

$ docker compose exec postgres psql -U postgres -d coffee_tracker -c "SELECT count(*), min(month_date), max(month_date), avg(oni_index) as avg_oni, avg(vn_rain_anomaly) as avg_vn, avg(br_rain_anomaly) as avg_br FROM macro_climate_monthly;"
 count |    min     |    max     |        avg_oni         |       avg_vn        |       avg_br        
-------+------------+------------+------------------------+---------------------+---------------------
   107 | 2018-01-01 | 2026-11-01 | 0.09342857142857142857 | 43.2681308411214953 | 21.2343925233644860
(1 row)
```
