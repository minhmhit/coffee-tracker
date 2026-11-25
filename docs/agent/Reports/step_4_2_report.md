# STEP REPORT: STEP 4.2 — REST API ENDPOINTS FOR DASHBOARD (NESTJS)

- **Date / Time:** 2026-11-25 10:02 (UTC+7)
- **Phase / Step:** Phase 4 — Step 4.2
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng hệ thống REST API endpoints hoàn chỉnh trên NestJS Control Plane phục vụ tầng giao diện Frontend Dashboard (Next.js - `apps/web`):
  1. **Market Endpoints (`MarketController` - `/api/market`):**
     - `GET /api/market/latest`: Snapshot giá mới nhất của 4 tỉnh Tây Nguyên (Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông, Bình quân), các kỳ hạn ICE London (M1, M3, M6), tỷ giá Vietcombank USD/VND, giá dầu thô Brent Oil, và tính toán tự động chênh lệch DoD / WoW (% và VNĐ).
     - `GET /api/market/history`: Chuỗi giá lịch sử dạng time-series hỗ trợ tham số lọc `?days=30|90|180|365|all` hoặc `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
  2. **Signals Endpoints (`SignalsController` - `/api/signals`):**
     - `GET /api/signals/latest`: Tín hiệu phân tích mới nhất (Basis VNĐ/kg, Calendar Spread M1-M6, Biến động 30N, Z-Score 30N, Phân loại thị trường `regime_label`, cờ bất thường `is_anomaly`, ghi chú thị trường).
     - `GET /api/signals/history`: Dữ liệu tín hiệu lịch sử hỗ trợ bộ lọc khoảng thời gian phục vụ biểu đồ trực quan.
  3. **Forecast Endpoints (`ForecastController` - `/api/forecast`):**
     - `GET /api/forecast/latest`: Kết quả đợt dự báo thành công gần nhất, bao gồm giá gốc tại thời điểm dự báo `origin_price_daklak`, siêu dữ liệu kiểm định ngoài mẫu (`metrics`, `blend_weights`), và mảng 26 tuần dự báo phân vị ($P_{10}, P_{50}, P_{90}$) kèm 2 đường đối chuẩn (Naive Random Walk và Futures-Implied Baseline).
     - `GET /api/forecast/runs`: Danh sách lịch sử các đợt chạy dự báo có phân trang `?limit=20&offset=0` phục vụ Audit Trail.
     - `GET /api/forecast/runs/:runId`: Chi tiết một đợt chạy dự báo cụ thể theo UUID.
     - `POST /api/forecast/trigger`: Kích hoạt job dự báo tức thời.
     - Duy trì song song controller tương thích ngược `AdminForecastController` (`/api/admin/forecast/...`).
  4. **Climate / Macro Endpoints (`ClimateController` - `/api/climate`):**
     - `GET /api/climate/latest`: Snapshot chỉ số khí hậu mới nhất (Chỉ số NOAA ONI, Độ lệch chuẩn lượng mưa tại Đắk Lắk và Linhares Brazil).
     - `GET /api/climate/history`: Chuỗi dữ liệu khí hậu lịch sử theo tháng `?limit=36`.
- **CORS Configuration:** Bật CORS trên toàn bộ NestJS trong `main.ts` với `credentials: true`, sẵn sàng cho Next.js trên cổng 3000 kết nối không bị chặn.
- **Zero Raw Decimal Principle:** 100% số liệu tài chính được chuyển đổi sang kiểu `number` tiêu chuẩn của JavaScript (`.toNumber()`) để thư viện biểu đồ frontend (Recharts / Chart.js) trực quan hóa ngay lập tức.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Cấu trúc Route & Phân chia Module:** Đã tổ chức các controller gắn liền với domain module tương ứng (`MarketController` và `ClimateController` thuộc `IngestionModule`, `SignalsController` thuộc `SignalsModule`, `ForecastController` thuộc `ForecastModule`).
- **Tương thích ngược:** Cung cấp cả endpoint công khai `/api/forecast` và alias `/api/admin/forecast` để đảm bảo 100% các script và test case cũ hoạt động ổn định.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/ingestion/market.controller.ts` | `CREATE` | Controller quản lý `GET /api/market/latest` và `GET /api/market/history` |
| `apps/orchestrator/src/ingestion/climate.controller.ts` | `CREATE` | Controller quản lý `GET /api/climate/latest` và `GET /api/climate/history` |
| `apps/orchestrator/src/ingestion/ingestion.module.ts` | `MODIFY` | Đăng ký `MarketController`, `ClimateController` và import `PrismaModule` |
| `apps/orchestrator/src/signals/signals.controller.ts` | `CREATE` | Controller quản lý `GET /api/signals/latest` và `GET /api/signals/history` |
| `apps/orchestrator/src/signals/signals.module.ts` | `MODIFY` | Đăng ký `SignalsController` và import `PrismaModule` |
| `apps/orchestrator/src/forecast/forecast.controller.ts` | `MODIFY` | Bổ sung các routes `/api/forecast/latest`, `/runs`, `/runs/:runId`, `/trigger` |
| `apps/orchestrator/src/forecast/forecast.service.ts` | `MODIFY` | Bổ sung hàm `getForecastRuns` (phân trang) và `getForecastRunById` |
| `apps/orchestrator/src/forecast/forecast.module.ts` | `MODIFY` | Đăng ký đồng thời `ForecastController` và `AdminForecastController` |
| `apps/orchestrator/src/main.ts` | `MODIFY` | Kích hoạt `app.enableCors()` cho ứng dụng frontend |
| `apps/orchestrator/src/ingestion/test/market-controller.spec.ts` | `CREATE` | Unit test cho MarketController & ClimateController |
| `apps/orchestrator/src/signals/test/signals-controller.spec.ts` | `CREATE` | Unit test cho SignalsController |
| `apps/orchestrator/src/forecast/test/forecast.spec.ts` | `MODIFY` | Bổ sung test coverage cho các endpoints công khai và phân trang |
| `apps/orchestrator/Dockerfile` | `MODIFY` | Tối ưu hóa đa tầng Dockerfile với `--ignore-scripts` và sao chép an toàn `node_modules` |

---

## 4. Implementation Details

1. **Market Snapshot & Delta Computation:**
   - Truy vấn 8 bản ghi gần nhất: Index 0 là giá hôm nay, Index 1 là giá ngày trước (DoD), Index 7 là giá 7 ngày trước (WoW).
   - Tính toán biến động VNĐ và % chính xác: $\text{DoD\_vnd} = P_0 - P_1$, $\text{DoD\_pct} = \frac{P_0 - P_1}{P_1}$.
2. **Flexible Time-Series Querying:**
   - Hỗ trợ tham số `days`: Mặc định 90 ngày cho cả Market và Signals. Nếu người dùng chọn `all`, trả về toàn bộ lịch sử từ 2018.
   - Hỗ trợ tham số `from` và `to` dạng ISO date (`YYYY-MM-DD`).
3. **Audit Trail & Pagination:**
   - Endpoint `GET /api/forecast/runs` sử dụng `take` và `skip` kết hợp với `_count: { predictions: true }` cho hiệu năng truy vấn tối ưu.
4. **CORS Configuration:**
   - Kích hoạt trong `main.ts` hỗ trợ tất cả các HTTP method (`GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS`) và header `credentials: true`.

---

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

### 5.1. Unit Test Suite (8 Passed Suites, 70/70 Tests Passed)

```bash
$ pnpm --filter @coffee-tracker/orchestrator test
PASS src/signals/test/signals-controller.spec.ts (14.118 s)
PASS src/alerts/test/alerts.spec.ts (14.257 s)
PASS src/ingestion/test/climate-ingestion.spec.ts
PASS src/signals/test/signals.spec.ts (14.669 s)
PASS src/ingestion/test/ingestion-processor.spec.ts (15.538 s)
PASS src/ingestion/test/ingestion.spec.ts (15.811 s)
PASS src/ingestion/test/market-controller.spec.ts (17.549 s)
PASS src/forecast/test/forecast.spec.ts (18.009 s)

Test Suites: 8 passed, 8 total
Tests:       70 passed, 70 total
Snapshots:   0 total
Time:        19.601 s
Ran all test suites.
```

### 5.2. NestJS Production Build (0 TypeScript Errors)

```bash
$ pnpm --filter @coffee-tracker/orchestrator run build
$ nest build
(Exit code: 0)
```

### 5.3. Live HTTP Endpoint Verification via curl

#### A. `GET /api/market/latest`
```bash
$ curl.exe -s http://localhost:3001/api/market/latest
```
```json
{
  "date": "2026-11-22",
  "prices": {
    "daklak": 71800,
    "lamdong": 71200,
    "gialai": 71800,
    "daknong": 72000,
    "average": 71700
  },
  "futures": {
    "london_m1": 4565,
    "london_m3": 4335,
    "london_m6": 4228
  },
  "macro": {
    "usd_vnd": 25600,
    "brent_oil": 89.95
  },
  "changes": {
    "dod_pct": -0.0042,
    "dod_vnd": -300,
    "wow_pct": 0,
    "wow_vnd": 0
  }
}
```

#### B. `GET /api/signals/latest`
```bash
$ curl.exe -s http://localhost:3001/api/signals/latest
```
```json
{
  "date": "2026-11-22",
  "basis_vnd_kg": -45064,
  "calendar_spread": 337,
  "volatility_30d": 0.0044,
  "z_score_30d": -0.8137,
  "is_anomaly": false,
  "regime": "BACKWARDATION_STRONG",
  "notes": "DakLak: 71.800 đ, DoD: -0.42%, Z: -0.81, Basis: -45.064 đ, Spread: 337"
}
```

#### C. `GET /api/forecast/latest`
```bash
$ curl.exe -s http://localhost:3001/api/forecast/latest
```
```json
{
  "run_id": "b10e0d43-d324-4253-b76a-472333f4af25",
  "forecast_date": "2026-11-22",
  "origin_price_daklak": 71800,
  "status": "SUCCESS",
  "model_version": "two_legged_walk_forward_v1",
  "created_at": "2026-11-25T02:35:39.364Z",
  "metrics": {
    "wf_mape_4w": 1.36,
    "wf_mape_12w": 2.45,
    "wf_mape_26w": 5.68,
    "pinball_loss": 0.0083,
    "beats_naive_baseline": false
  },
  "blend_weights": {
    "mid": 0.5,
    "long": 0.4,
    "short": 0.6
  },
  "predictions": [
    {
      "horizon_week": 1,
      "target_date": "2026-11-29",
      "pred_p10": 69886.36,
      "pred_p50": 71886.1,
      "pred_p90": 74719.09,
      "baseline_rw": 71800,
      "baseline_futures": 78143.75
    },
    {
      "horizon_week": 4,
      "target_date": "2026-12-20",
      "pred_p10": 70548.71,
      "pred_p50": 71908.08,
      "pred_p90": 75434.18,
      "baseline_rw": 71800,
      "baseline_futures": 78143.75
    },
    {
      "horizon_week": 12,
      "target_date": "2027-02-14",
      "pred_p10": 71795.48,
      "pred_p50": 74315.06,
      "pred_p90": 82556.22,
      "baseline_rw": 71800,
      "baseline_futures": 72255.75
    },
    {
      "horizon_week": 26,
      "target_date": "2027-05-23",
      "pred_p10": 73577.51,
      "pred_p50": 75311.15,
      "pred_p90": 96132.02,
      "baseline_rw": 71800,
      "baseline_futures": 69516.55
    }
  ]
}
```

#### D. `GET /api/forecast/runs`
```bash
$ curl.exe -s http://localhost:3001/api/forecast/runs
```
```json
{
  "runs": [
    {
      "run_id": "b10e0d43-d324-4253-b76a-472333f4af25",
      "forecast_date": "2026-11-22",
      "status": "SUCCESS",
      "model_version": "two_legged_walk_forward_v1",
      "error_message": null,
      "metrics": {
        "wf_mape_4w": 1.36,
        "wf_mape_12w": 2.45,
        "wf_mape_26w": 5.68,
        "pinball_loss": 0.0083,
        "beats_naive_baseline": false
      },
      "predictions_count": 26,
      "created_at": "2026-11-25T02:35:39.364Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### E. `GET /api/climate/latest`
```bash
$ curl.exe -s http://localhost:3001/api/climate/latest
```
```json
{
  "month_date": "2026-11-01",
  "oni": null,
  "rainfall_anomaly_daklak": -80.13,
  "rainfall_anomaly_linhares": 38.69
}
```

---

## 6. Conclusion & Next Step

- Toàn bộ mục tiêu của **STEP 4.2** đã hoàn thành đạt chuẩn `PASS`:
  - Đầy đủ các REST API endpoints cho Market, Signals, Forecast và Climate.
  - Chuẩn hóa kiểu dữ liệu số, tính toán DoD/WoW, hỗ trợ time-series filtering.
  - CORS đã được bật cho toàn bộ ứng dụng.
  - Container Docker đã được cập nhật và kiểm thử trực tiếp thông qua HTTP curl.
- **Next Step:** `STEP 4.3` — Next.js Dashboard Frontend & End-to-End System Smoke Test.
