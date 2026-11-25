# STEP REPORT: STEP 3.4 — EXPANDING-WINDOW WALK-FORWARD ENSEMBLE & FULL FASTAPI INTEGRATION

- **Date / Time:** 2026-11-25 09:24 (UTC+7)
- **Phase / Step:** Phase 3 — Step 3.4
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng mô hình kết hợp Ensemble 2 chân kiềng (**Leg 1: VECM/Ridge VAR** và **Leg 2: Direct Multi-Horizon LightGBM Quantile**) thông qua cơ chế trọng số tối ưu hóa Walk-Forward CV (`ensemble.py`).
- Kết nối hoàn chỉnh endpoint REST API `POST /api/v1/forecast/weekly` trên Stateless FastAPI Compute Engine:
  - Tiếp nhận chuỗi giá ngày và dữ liệu khí hậu tháng từ Control Plane.
  - Thực hiện toàn bộ quy trình tiền xử lý nhân quả (resampling `W-FRI`, bounded `ffill(limit=5)`, causal publication lag).
  - Chạy kiểm định chéo Expanding-Window Walk-Forward CV trên **12 mốc thời gian rolling origins $t_0$** (bước nhảy 4 tuần = 1 tháng, bao phủ trọn vẹn 1 năm đánh giá kiểm toán ngoài mẫu).
  - Tối ưu hóa trọng số pha trộn theo từng phân đoạn chân trời dự báo: ngắn hạn ($1..8w$), trung hạn ($9..16w$), dài hạn ($17..26w$).
  - Refit toàn bộ mô hình trên toàn bộ tập dữ liệu khả dụng và xuất bản vector 26 tuần dự báo phân vị $P_{10}, P_{50}, P_{90}$ bảo toàn 100% tính đơn điệu.
  - Đính kèm đầy đủ 2 mô hình đối chuẩn (Naive Random Walk và Futures-Implied Baseline) và các chỉ số kiểm toán ngoài mẫu thực tế (`wf_mape_4w`, `wf_mape_12w`, `wf_mape_26w`, `pinball_loss`, `beats_naive_baseline`).
- Kiểm thử toàn diện: 19/19 Pytest tests đạt 100% PASS và kiểm tra thực tế gọi HTTP thành công với độ trễ phản hồi **10.62 giây** (vượt xa ngân sách $< 90$ giây).

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Cấu hình Walk-Forward CV:** Đã xác nhận cấu hình mặc định: Đánh giá trên 12 mốc thời gian rolling origins $t_0$ gần nhất, bước nhảy 4 tuần (1 tháng), kiểm toán ngoài mẫu Out-of-Sample cho 1 năm lịch sử.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/ml-service/app/ensemble.py` | `CREATE` | Thuật toán `evaluate_walk_forward_cv` và `generate_ensemble_forecast` (pha trộn trọng số Leg 1 + Leg 2 + đối chuẩn) |
| `apps/ml-service/app/main.py` | `MODIFY` | Kết nối hoàn chỉnh endpoint `POST /api/v1/forecast/weekly` trả về `ForecastResponse` HTTP 200 |
| `apps/ml-service/tests/test_ensemble.py` | `CREATE` | Bộ unit tests cho Walk-Forward CV và hàm tạo ensemble forecast |
| `apps/ml-service/tests/test_api.py` | `MODIFY` | Cập nhật kiểm thử end-to-end cho endpoint `POST /api/v1/forecast/weekly` đạt HTTP 200 |
| `apps/ml-service/tests/live_smoke_test.py` | `CREATE` | Script kiểm thử live HTTP call, đo lường độ trễ và in bảng so sánh dự báo 26 tuần |

---

## 4. Implementation Details

1. **Expanding-Window Walk-Forward Validation:**
   - 12 mốc xuất phát rolling origins $t_0^{(k)} = T - 1 - (12 - k) \times 4$.
   - Tại mỗi mốc, mô hình chỉ được huấn luyện trên lát cắt quá khứ $\le t_0^{(k)}$ và dự báo ngoài mẫu tới các tuần tương lai có giá thực tế đã diễn ra.
   - Tính toán sai số tuyệt đối bình quân (MAE) riêng biệt cho từng phân đoạn: ngắn hạn ($1..8w$), trung hạn ($9..16w$), dài hạn ($17..26w$).
   - Trọng số tối ưu hóa theo phương pháp nghịch đảo sai số: $w_{\text{LGBM}} = \frac{1/\text{MAE}_{\text{LGBM}}}{1/\text{MAE}_{\text{LGBM}} + 1/\text{MAE}_{\text{Econ}}}$, giới hạn trong khoảng $[0.20, 0.80]$ để bảo đảm tính đa dạng mô hình.
2. **Honest Metric Reporting:**
   - Hệ thống báo cáo trung thực chỉ số ngoài mẫu: MAPE tại 4w, 12w, 26w, Pinball Loss bình quân, và cờ `beats_naive_baseline`. Không bao giờ che giấu nếu mô hình thua Naive trên một chân trời cụ thể.
3. **Monotonicity & Bound Guards:**
   - Giá dự báo phân vị được tái lập: $\hat{P}_{pXX, h} = Y_{\text{origin}} \cdot \exp(\hat{y}^{(h)}_{pXX})$.
   - Đảm bảo nghiêm ngặt điều kiện đơn điệu $P_{10} \le P_{50} \le P_{90}$ và sàn giá vật lý $\ge 10.000$ VNĐ/kg.

---

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

### 5.1. Pytest Full Suite Execution Inside Docker Container (19/19 PASS)

```bash
$ docker compose exec ml-service python -m pytest -v
============================= test session starts ==============================
platform linux -- Python 3.12.16, pytest-9.2.0, pluggy-1.7.0 -- /usr/local/bin/python
cachedir: .pytest_cache
rootdir: /app
plugins: asyncio-1.5.0, anyio-4.16.0
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 19 items

tests/test_api.py::test_health_check PASSED                              [  5%]
tests/test_api.py::test_forecast_endpoint_insufficient_history PASSED    [ 10%]
tests/test_api.py::test_forecast_endpoint_rejects_nan PASSED             [ 15%]
tests/test_api.py::test_forecast_endpoint_end_to_end_success PASSED      [ 21%]
tests/test_econometric.py::TestBaselinesSuite::test_naive_random_walk_structure_and_monotonicity PASSED [ 26%]
tests/test_econometric.py::TestBaselinesSuite::test_futures_implied_baseline_with_full_and_missing_curve PASSED [ 31%]
tests/test_econometric.py::TestEconometricLegSuite::test_econometric_forecast_full_cycle PASSED [ 36%]
tests/test_econometric.py::TestEconometricLegSuite::test_econometric_explosive_series_triggers_ridge_fallback PASSED [ 42%]
tests/test_ensemble.py::TestEnsembleSuite::test_walk_forward_cv_evaluation PASSED [ 47%]
tests/test_ensemble.py::TestEnsembleSuite::test_generate_ensemble_forecast_end_to_end PASSED [ 52%]
tests/test_lgbm_quant.py::TestLightGBMQuantileSuite::test_cutoff_leakage_rule PASSED [ 57%]
tests/test_lgbm_quant.py::TestLightGBMQuantileSuite::test_lgbm_quantile_forecast_output_and_monotonicity PASSED [ 63%]
tests/test_preprocessing.py::TestSchemasValidation::test_pydantic_rejects_nan_and_inf PASSED [ 68%]
tests/test_preprocessing.py::TestSchemasValidation::test_pydantic_enforces_quantile_monotonicity PASSED [ 73%]
tests/test_preprocessing.py::TestSchemasValidation::test_forecast_request_rejects_insufficient_history PASSED [ 78%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_resample_daily_to_weekly_w_fri PASSED [ 84%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_climate_causal_publication_lag PASSED [ 89%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_leakage_canary_test PASSED [ 94%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_multistep_targets_alignment PASSED [100%]

======================= 19 passed, 3 warnings in 29.67s ========================
```

### 5.2. Live HTTP Forecast Smoke Test & 26-Week Comparison Table

```bash
$ docker compose exec ml-service python tests/live_smoke_test.py
================================================================================
   LIVE HTTP FORECAST SMOKE TEST — POST /api/v1/forecast/weekly
================================================================================
Payload generated: 1124 daily market prices, 70 climate points
Origin Date: 2024-10-31
Sending request to http://localhost:8000/api/v1/forecast/weekly...
Response Status Code: 200
End-to-End Latency:   10.62 seconds (Budget: < 90.0s)

--- AUDIT METRICS (OUT-OF-SAMPLE WALK-FORWARD CV) ---
  • Walk-Forward MAPE (4 weeks):   6.88%
  • Walk-Forward MAPE (12 weeks):  13.44%
  • Walk-Forward MAPE (26 weeks):  21.84%
  • Average Pinball Loss:          0.0421
  • Beats Naive Random Walk:       False

--- 26-WEEK PROBABILISTIC FORECAST COMPARISON TABLE ---
Week   Target Date  P10 (VNĐ)    P50 (VNĐ)    P90 (VNĐ)    Naive RW     Futures Implied 
------------------------------------------------------------------------------------
W1     2024-11-07       69,120      72,778      77,398      72,695         116,915 ◄
W2     2024-11-14       68,441      72,804      78,273      72,695         116,915
W3     2024-11-21       67,924      72,952      79,284      72,695         116,915
W4     2024-11-28       67,494      72,852      80,083      72,695         116,915 ◄
W5     2024-12-05       67,120      72,945      81,568      72,695         115,741
W6     2024-12-12       66,929      73,030      82,159      72,695         114,567
W7     2024-12-19       66,660      73,055      82,881      72,695         113,393
W8     2024-12-26       66,501      73,423      83,604      72,695         112,219
W9     2025-01-02       66,296      73,549      84,303      72,695         111,045
W10    2025-01-09       66,274      73,674      84,766      72,695         109,871
W11    2025-01-16       66,174      73,653      85,190      72,695         108,697
W12    2025-01-23       66,417      73,713      85,518      72,695         107,523 ◄
W13    2025-01-30       66,606      73,612      85,835      72,695         106,852
W14    2025-02-06       66,449      73,553      86,142      72,695         106,181
W15    2025-02-13       66,255      73,469      86,448      72,695         105,510
W16    2025-02-20       65,973      73,513      86,908      72,695         104,839
W17    2025-02-27       65,698      73,442      87,504      72,695         104,168
W18    2025-03-06       65,522      73,102      87,475      72,695         103,497
W19    2025-03-13       65,352      72,854      88,251      72,695         102,826
W20    2025-03-20       65,263      72,874      88,522      72,695         102,155
W21    2025-03-27       64,803      72,874      88,858      72,695         101,484
W22    2025-04-03       64,331      72,894      89,105      72,695         100,813
W23    2025-04-10       63,930      72,914      89,472      72,695         100,142
W24    2025-04-17       63,745      72,933      89,748      72,695          99,471
W25    2025-04-24       63,502      72,953      90,224      72,695          98,801
W26    2025-05-01       63,301      72,973      90,469      72,695          98,130 ◄
------------------------------------------------------------------------------------
================================================================================
```

---

## 6. Next Step Recommendation

**PHASE 3 CHÍNH THỨC HOÀN TẤT THÀNH CÔNG 100%!**

Sẵn sàng chuyển sang **PHASE 4: ORCHESTRATION, FORECAST PERSISTENCE & FRONTEND DASHBOARD**:
- **STEP 4.1: NestJS `forecast-queue` Worker & Forecast Run Persistence**
  - Xây dựng scheduler định kỳ hàng tuần kích hoạt lúc Chủ Nhật 02:00 VN (`0 2 * * 0`).
  - Worker trích xuất dữ liệu giá và khí hậu từ PostgreSQL, gọi `POST http://ml-service:8000/api/v1/forecast/weekly`.
  - Lưu trữ nguyên tử (atomic transaction) vào bảng `forecast_runs` và 26 dòng vào `forecast_predictions`.
