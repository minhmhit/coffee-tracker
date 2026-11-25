# STEP REPORT: STEP 3.1 — FASTAPI CONTRACT, STRICT PYDANTIC V2 SCHEMAS & WEEKLY FEATURE PIPELINE

- **Date / Time:** 2026-11-25 09:05 (UTC+7)
- **Phase / Step:** Phase 3 — Step 3.1
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng hợp đồng giao tiếp HTTP chuẩn xác (`POST /api/v1/forecast/weekly`) giữa Control Plane (`apps/orchestrator`) và Stateless Compute Plane (`apps/ml-service`).
- Áp dụng Pydantic v2 nghiêm ngặt:
  - Loại bỏ và từ chối 100% các giá trị `NaN`, `Inf`, `-Inf` trên cả luồng input và output (`StrictBaseModel`).
  - Bắt buộc kiểm tra tính đơn điệu của các phân vị xác suất: $\text{pred\_p10} \le \text{pred\_p50} \le \text{pred\_p90}$ cho toàn bộ $h \in \{1..26\}$.
  - Kiểm tra độ dài lịch sử tối thiểu: bắt buộc $\ge 156$ tuần (~3 năm) để mô hình có đủ quan sát thống kê.
- Xây dựng pipeline tiền xử lý và kỹ thuật đặc trưng thời gian nhân quả (Causal Feature Engineering) bảo toàn tuyệt đối nguyên tắc **Zero Data Leakage**:
  - Resampling chuỗi giá từ Daily -> Weekly thứ Sáu (`W-FRI`) với cơ chế bounded forward fill (`ffill(limit=5)`).
  - Tích hợp dữ liệu khí hậu tháng (`macro_climate_monthly`) với độ trễ công bố chuẩn (Publication Lag >= 1 tháng qua `pd.merge_asof(direction='backward')`).
  - Trích xuất 17+ đặc trưng nhân quả tại điểm gốc $t$: tỷ suất sinh lời log đa quy mô (1w, 4w, 12w, 26w, 52w), biến động mẫu lăn (4w, 12w, 26w), Basis nội địa - quốc tế, Calendar Spread London M1-M6, chu kỳ mùa vụ điều hòa (sin/cos month), độ trễ ENSO ONI và lượng mưa (12w, 26w).
  - Xây dựng Direct Multi-Step targets cho 26 tuần: $y^{(h)}_t = \ln(Y_{t+h}) - \ln(Y_t)$ với $h = 1..26$.
- Thiết kế bài kiểm tra Leakage Canary Test (`assert_zero_feature_leakage`) và bộ kiểm thử tự động 11/11 tests Pytest đạt 100% PASS.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Ngưỡng lịch sử tối thiểu:** Đã xác nhận $\ge 156$ tuần (~3 năm dữ liệu). Nếu payload gửi lên ít hơn 156 tuần, FastAPI trả về mã lỗi HTTP `422 Unprocessable Entity`.
- **Xử lý khoảng trống ngày:** Đã xác nhận forward-fill tối đa 5 ngày lịch (`ffill(limit=5)`) để vượt qua các kỳ nghỉ cuối tuần và lễ tết mà không làm sai lệch cấu trúc tuần.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/ml-service/requirements.txt` | `MODIFY` | Bổ sung `numpy`, `pandas`, `scipy`, `statsmodels`, `lightgbm`, `pytest`, `httpx` |
| `apps/ml-service/app/schemas.py` | `CREATE` | Pydantic v2 schemas (`DailyMarketDataPoint`, `MonthlyClimateDataPoint`, `ForecastRequest`, `HorizonPrediction`, `ForecastResponse`) với ràng buộc anti-NaN/Inf và monotone quantiles |
| `apps/ml-service/app/preprocessing.py` | `CREATE` | Pipeline tiền xử lý: `resample_daily_to_weekly`, `merge_macro_climate_causally`, `build_causal_features`, `build_multistep_targets`, và `assert_zero_feature_leakage` |
| `apps/ml-service/app/main.py` | `MODIFY` | Wire endpoint `POST /api/v1/forecast/weekly` xác thực schema và chạy pipeline tiền xử lý (trả về 501 kèm tóm tắt chẩn đoán) |
| `apps/ml-service/tests/conftest.py` | `CREATE` | Fixture sinh 200 tuần dữ liệu giá và 70 tháng dữ liệu khí hậu phục vụ kiểm thử |
| `apps/ml-service/tests/test_preprocessing.py` | `CREATE` | Kiểm thử schema, tính đơn điệu quantile, resampling W-FRI, độ trễ công bố khí hậu, Leakage Canary Test |
| `apps/ml-service/tests/test_api.py` | `CREATE` | Kiểm thử tích hợp FastAPI HTTP client (Health check, 422 rejection, 501 validation summary) |

---

## 4. Implementation Details

1. **Zero NaN/Inf Guarantee (`StrictBaseModel`):**
   - Mọi schema kế thừa từ `StrictBaseModel` đều tự động chạy validator quét qua toàn bộ các thuộc tính kiểu `float`. Nếu phát hiện `math.isnan` hoặc `math.isinf`, model lập tức ném lỗi `ValueError` chi tiết, chặn đứng việc dữ liệu bẩn lọt vào mô hình.
2. **Quantile Monotonicity Enforcement:**
   - Trong `HorizonPrediction`, validator `@model_validator(mode="after")` bắt buộc kiểm tra điều kiện logic toán học: `pred_p10 <= pred_p50 <= pred_p90`. Nếu phân vị P10 vượt P50 hoặc P50 vượt P90 (Quantile Crossing Trap), payload lập tức bị từ chối.
3. **Causal Climate Merge with Publication Lag:**
   - Chỉ số khí hậu của tháng $M$ (ví dụ tháng 01/2024) trên thực tế chỉ được các cơ quan khí tượng (NOAA / Open-Meteo) tính toán và công bố sau khi tháng $M$ kết thúc (ngày khả dụng sớm nhất là 01/02/2024).
   - `merge_macro_climate_causally` thiết lập `available_date = month_date + 1 month` và thực hiện `pd.merge_asof(..., direction='backward')`. Điều này đảm bảo rằng các ngày thứ Sáu trong tháng 01/2024 tuyệt đối không bao giờ nhìn thấy trước dữ liệu khí hậu của chính tháng 01/2024.
4. **Leakage Canary Assertion:**
   - Hàm `assert_zero_feature_leakage` thực hiện kiểm thử độ nhạy: biến đổi tăng giá +50% trên toàn bộ các ngày giao dịch kể từ mốc $T_{\text{cutoff}}$. Sau đó tính toán lại toàn bộ ma trận đặc trưng và so sánh với phiên bản gốc trên phân đoạn an toàn $t < T_{\text{cutoff}}$. Toàn bộ các đặc trưng phải đồng nhất tuyệt đối ($\max |\Delta| \le 10^{-9}$).

---

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

### 5.1. Pytest Full Suite Execution Inside Docker Container

```bash
$ docker compose exec ml-service python -m pytest -v
============================= test session starts ==============================
platform linux -- Python 3.12.16, pytest-9.2.0, pluggy-1.7.0 -- /usr/local/bin/python
cachedir: .pytest_cache
rootdir: /app
plugins: asyncio-1.5.0, anyio-4.16.0
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 11 items

tests/test_api.py::test_health_check PASSED                              [  9%]
tests/test_api.py::test_forecast_endpoint_insufficient_history PASSED    [ 18%]
tests/test_api.py::test_forecast_endpoint_rejects_nan PASSED             [ 27%]
tests/test_api.py::test_forecast_endpoint_valid_payload_runs_preprocessing PASSED [ 36%]
tests/test_preprocessing.py::TestSchemasValidation::test_pydantic_rejects_nan_and_inf PASSED [ 45%]
tests/test_preprocessing.py::TestSchemasValidation::test_pydantic_enforces_quantile_monotonicity PASSED [ 54%]
tests/test_preprocessing.py::TestSchemasValidation::test_forecast_request_rejects_insufficient_history PASSED [ 63%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_resample_daily_to_weekly_w_fri PASSED [ 72%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_climate_causal_publication_lag PASSED [ 81%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_leakage_canary_test PASSED [ 90%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_multistep_targets_alignment PASSED [100%]

======================== 11 passed, 1 warning in 0.87s =========================
```

### 5.2. Live Container Health Endpoint Verification

```bash
$ docker compose exec ml-service python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"
{"status":"ok","service":"coffee-tracker-ml"}
```

---

## 6. Next Step Recommendation

**STEP 3.1 HOÀN TẤT THÀNH CÔNG 100%!**

Sẵn sàng chuyển sang **STEP 3.2: Econometric Leg (BVAR / VECM) & Mandatory Baselines**:
- Xây dựng 2 mô hình benchmark bắt buộc: **Naive Random Walk** và **Futures-Implied Baseline** (nội suy London M1-M3-M6 + trailing mean basis).
- Xây dựng mô hình kinh tế lượng đa biến (**Leg 1**: VECM với fallback sang Ridge VAR trên log-differences) dự báo đồng thời hệ thống `[DakLak, LondonM1, USD/VND, Brent]` qua 26 tuần.
