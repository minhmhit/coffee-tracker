# STEP REPORT: STEP 2.1 — DAILY SIGNALS WORKER (BASIS, SPREAD, VOLATILITY, Z-SCORE, REGIME)

- **Date / Time:** 2026-11-25 08:33 (UTC+7)
- **Phase / Step:** Phase 2 — Step 2.1
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng module tính toán chỉ số thông minh thị trường và độ biến động rủi ro hàng ngày (`SignalsService`) và hàng đợi BullMQ `signals-queue`.
- Tự động kích hoạt chuỗi xử lý (pipeline chaining): Ngay sau khi `ingestion-queue` nạp giá thị trường thành công, tự động enqueue job `COMPUTE_DAILY_SIGNALS` sang `signals-queue`.
- Tính toán chính xác các chỉ số định lượng lưu vào bảng `daily_signals`:
  1. **Domestic–Global Basis (VND/kg):** $\text{Basis}_t = \text{DakLak}_t - (\frac{\text{LondonM1}_t}{1000} \times \text{USD\_VND}_t)$
  2. **Futures Calendar Spread (USD/tấn):** $\text{Spread}_t = \text{LondonM1}_t - \text{LondonM6}_t$
  3. **30-Day Rolling Volatility:** Độ lệch chuẩn mẫu của chuỗi tỷ suất sinh lời hàng ngày trong 30 ngày giao dịch gần nhất.
  4. **Z-Score & Anomaly Detection:** $Z_t = \frac{r_t - \mu}{\sigma_{30d}}$, tự động gắn cờ `is_anomaly = true` khi $|Z_t| > 2.5$.
  5. **Market Regime Classification:** Phân loại cấu trúc thị trường: `BACKWARDATION_STRONG` (> +200 USD), `BACKWARDATION_MILD` (0 đến +200 USD), `CONTANGO_MILD` (-150 đến 0 USD), `CONTANGO_STRONG` (< -150 USD).
- Khi phát hiện ngày đột biến (`is_anomaly = true`), tự động đẩy job `ANOMALY_ALERT` có mức ưu tiên cao vào `alert-queue`.
- Xây dựng script Backfill nạp toàn bộ signals lịch sử cho 3.248 ngày từ 2018 đến 2026 vào bảng PostgreSQL `daily_signals`.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Công thức Basis:** Đã xác nhận $\text{DakLak} - (\frac{\text{LondonM1}}{1000} \times \text{USD\_VND})$ lấy Đắk Lắk làm giá chuẩn benchmark chính.
- **Phân loại Regime:** Đã xác nhận phân loại rule-based theo Calendar Spread (M1 - M6) với 4 ngưỡng: `BACKWARDATION_STRONG` (> 200), `BACKWARDATION_MILD` (0..200), `CONTANGO_MILD` (-150..0), `CONTANGO_STRONG` (< -150), `INSUFFICIENT_DATA` (khi thiếu M6).
- **Ngưỡng Anomaly:** Đã xác nhận $|Z| > 2.5$ (chuẩn thống kê phân phối chuẩn loại trừ 98.8% nhiễu vi mô).

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/signals/signals.constants.ts` | `CREATE` | Định nghĩa tên queue `signals-queue`, `alert-queue`, jobs, regimes và ngưỡng Z-score |
| `apps/orchestrator/src/signals/signals.service.ts` | `CREATE` | Thuật toán tính toán Basis, Spread, 30d Volatility, Z-score, Anomaly, Regime và idempotent upsert Prisma |
| `apps/orchestrator/src/signals/processors/signals.processor.ts` | `CREATE` | WorkerHost xử lý job tính signals và dispatch cảnh báo bất thường sang alert-queue |
| `apps/orchestrator/src/signals/signals.module.ts` | `CREATE` | Module đăng ký `signals-queue` và `alert-queue` |
| `apps/orchestrator/src/signals/scripts/backfill-signals.ts` | `CREATE` | Script CLI nạp toàn bộ tín hiệu lịch sử 3.248 ngày vào `daily_signals` |
| `apps/orchestrator/src/signals/test/signals.spec.ts` | `CREATE` | 6 unit tests kiểm thử toán học Basis, Spread, Volatility, division-by-zero protection và alert dispatch |
| `apps/orchestrator/src/ingestion/processors/ingestion.processor.ts` | `MODIFY` | Tự động enqueue job `COMPUTE_DAILY_SIGNALS` sang `signalsQueue` sau khi nạp giá thành công |
| `apps/orchestrator/src/ingestion/ingestion.module.ts` | `MODIFY` | Đăng ký `SIGNALS_QUEUE_NAME` trong BullModule |
| `apps/orchestrator/src/ingestion/test/ingestion-processor.spec.ts` | `MODIFY` | Kiểm thử xác minh IngestionProcessor tự động chain signals-queue |
| `apps/orchestrator/src/app.module.ts` | `MODIFY` | Wire `SignalsModule` vào `AppModule` |
| `apps/orchestrator/package.json` | `MODIFY` | Thêm script `"backfill:signals"` |

---

## 4. Implementation Details

1. **Division-by-Zero & Microstructure Noise Guard:** Khi chuỗi giá đi ngang (độ lệch chuẩn $\sigma_{30d} \le 0.00001$) hoặc số ngày quan sát $< 2$, thuật toán tự động gán $Z_t = 0$ và `is_anomaly = false`, triệt tiêu hoàn toàn rủi ro phát sinh lỗi toán học `NaN` hoặc `Infinity`.
2. **Missing M6 Forward Robustness:** Khi thị trường kỳ hạn chưa mở hợp đồng kỳ hạn xa (M6) hoặc phiên nghỉ, `spread` được lưu `null` và `regime` được gán `'INSUFFICIENT_DATA'`, không phá vỡ pipeline.
3. **Event-Driven Chaining Pipeline:** `IngestionProcessor` sau khi xác thực và upsert dữ liệu giá hàng ngày vào PostgreSQL sẽ tự động phát sinh job tính toán `COMPUTE_DAILY_SIGNALS` sang `signals-queue`.
4. **Idempotency & Zero Float Principle:** Sử dụng `prisma.dailySignal.upsert` trên khóa chính `@id signal_date`. 100% các trường tài chính (`basis`, `spread`, `volatility_30d`, `z_score`) được lưu dạng `Prisma.Decimal` (PostgreSQL `NUMERIC`).

---

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

- [x] Check 1: `pnpm --filter @coffee-tracker/orchestrator test` — **PASS** (29/29 tests pass across 4 test suites)
- [x] Check 2: `pnpm --filter @coffee-tracker/orchestrator run build` — **PASS** (0 TypeScript errors)
- [x] Check 3: `pnpm --filter @coffee-tracker/orchestrator run backfill:signals` — **PASS** (3.248 days processed in 6.20s)
- [x] Check 4: Row Count Match: `SELECT COUNT(*) FROM daily_signals;` == `SELECT COUNT(*) FROM raw_market_prices;` — **PASS** (3.248 vs 3.248)
- [x] Check 5: Inspect 10 Most Recent Rows via `psql` — **PASS** (Zero `NaN`, zero null in required numeric columns, valid mathematical outputs)

### A. Jest Unit Test Results (29/29 Tests PASS)

```text
$ jest
PASS src/ingestion/test/climate-ingestion.spec.ts (6.501 s)
PASS src/ingestion/test/ingestion-processor.spec.ts (8.137 s)
PASS src/ingestion/test/ingestion.spec.ts (8.258 s)
PASS src/signals/test/signals.spec.ts (10.355 s)

Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        11.976 s
Ran all test suites.
$ nest build
```

### B. Signals Backfill Execution Output

```text
================================================================
   COFFEE TRACKER — HISTORICAL DAILY SIGNALS BACKFILL (2018-2026)
================================================================
[Nest] 22592  - 08:31:34 25/11/2026     LOG [SignalsService] Starting full historical signals backfill...
[Nest] 22592  - 08:31:34 25/11/2026     LOG [SignalsService] Processing 3248 historical market price days...
[Nest] 22592  - 08:31:40 25/11/2026     LOG [SignalsService] Historical signals backfill complete: 3248 records processed, 3 anomaly events flagged.

Backfill completed successfully in 6.20s!
Total Days Processed:  3248
Total Anomalies (|z|>2.5): 3

--- POSTGRESQL VERIFICATION SUMMARY ---
Total Records in daily_signals: 3248
Earliest Signal Date:           2018-01-01
Latest Signal Date:             2026-11-22
Basis Min / Max (đ/kg):         -45768.13 / 4807.2 (Avg: -8252 đ)
30d Volatility Min / Max:       0 / 0.0059 (Avg: 0.0046)
Z-Score Min / Max:              -3.2735 / 2.8227

--- REGIME CLASSIFICATION BREAKDOWN ---
  - CONTANGO_MILD: 2038 days
  - BACKWARDATION_STRONG: 1210 days
================================================================
```

### C. PostgreSQL Inspection (10 Most Recent Rows)

```text
$ docker compose exec postgres psql -U postgres -d coffee_tracker -c "SELECT count(*) FROM daily_signals; SELECT count(*) FROM raw_market_prices; SELECT signal_date, basis, spread, volatility_30d, z_score, is_anomaly, regime FROM daily_signals ORDER BY signal_date DESC LIMIT 10;"

 count 
-------
  3248
(1 row)

 count 
-------
  3248
(1 row)

 signal_date |   basis   | spread | volatility_30d | z_score | is_anomaly |        regime        
-------------+-----------+--------+----------------+---------+------------+----------------------
 2026-11-22  | -45064.00 | 337.00 |         0.0044 | -0.8137 | f          | BACKWARDATION_STRONG
 2026-11-21  | -43693.18 | 317.00 |         0.0044 | -0.5500 | f          | BACKWARDATION_STRONG
 2026-11-20  | -42822.08 | 340.00 |         0.0044 |  1.6693 | f          | BACKWARDATION_STRONG
 2026-11-19  | -43692.08 | 334.00 |         0.0041 | -0.8629 | f          | BACKWARDATION_STRONG
 2026-11-18  | -42208.46 | 333.00 |         0.0043 |  1.4595 | f          | BACKWARDATION_STRONG
 2026-11-17  | -42114.32 | 340.00 |         0.0043 |  0.5103 | f          | BACKWARDATION_STRONG
 2026-11-16  | -42364.50 | 312.00 |         0.0044 | -0.3827 | f          | BACKWARDATION_STRONG
 2026-11-15  | -41980.94 | 331.00 |         0.0044 | -0.3817 | f          | BACKWARDATION_STRONG
 2026-11-14  | -42166.80 | 329.00 |         0.0047 | -0.3135 | f          | BACKWARDATION_STRONG
 2026-11-13  | -42891.72 | 300.00 |         0.0048 |  0.2144 | f          | BACKWARDATION_STRONG
(10 rows)
```
