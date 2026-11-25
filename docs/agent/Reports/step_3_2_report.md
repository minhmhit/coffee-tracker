# STEP REPORT: STEP 3.2 — ECONOMETRIC LEG (BVAR / VECM) & MANDATORY BASELINES

- **Date / Time:** 2026-11-25 09:12 (UTC+7)
- **Phase / Step:** Phase 3 — Step 3.2
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng **Leg 1** trong kiến trúc Ensemble 2 chân kiềng: Mô hình kinh tế lượng chuỗi thời gian đa biến (**VECM** kết hợp **Ridge-regularized VAR**) dự báo đồng thời hệ thống vĩ mô `[ln(DakLak), ln(LondonM1), ln(USD_VND), ln(Brent)]` qua 26 tuần ($h = 1..26$).
- Xây dựng 2 mô hình benchmark đối chuẩn bắt buộc:
  1. **Naive Random Walk:** Dự báo giá đi ngang $Y_t$ với khoảng bất định mở rộng theo căn bậc hai thời gian $\sigma \sqrt{h}$.
  2. **Futures-Implied Baseline:** Nội suy đường cong kỳ hạn ICE London Robusta (M1, M3, M6), quy đổi theo tỷ giá USD/VND hiện hành và cộng thêm chênh lệch Basis bình quân 52 tuần lịch sử ($\text{Basis}_{52w}$).
- Cơ chế bảo vệ số học (Numerical Stability Guard): Kiểm định đồng tích hợp Johansen rank $\ge 1$; nếu VECM không hội tụ hoặc nghiệm phân kỳ, tự động fallback sang Ridge-regularized VAR trên log-differences (mô phỏng Minnesota prior shrinkage $\alpha = 1.0$).
- Đảm bảo 100% tính đơn điệu của các phân vị xác suất: $P_{10} \le P_{50} \le P_{90}$ và loại bỏ hoàn toàn rủi ro phát sinh `NaN`/`Inf`.
- Toàn bộ 15/15 tests Pytest chạy thành công đạt 100% PASS.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Lựa chọn mô hình Leg 1:** Người dùng đã xác nhận **Lựa chọn A**: Sử dụng `statsmodels` **VECM** (nếu kiểm định đồng tích hợp Johansen rank $\ge 1$) kèm cơ chế tự động fallback sang **Ridge-regularized VAR trên log-differences** (Minnesota shrinkage) nếu VECM không hội tụ hoặc nghiệm số phân kỳ.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/ml-service/app/models/__init__.py` | `CREATE` | Module exports cho Baselines và Econometric Leg |
| `apps/ml-service/app/models/baselines.py` | `CREATE` | Thuật toán `naive_random_walk` và `futures_implied_baseline` (nội suy đường cong M1-M3-M6 + 52w mean basis) |
| `apps/ml-service/app/models/econometric.py` | `CREATE` | Thuật toán `econometric_forecast`: kiểm định Johansen, fit VECM, stability guard, và Ridge VAR fallback |
| `apps/ml-service/tests/test_econometric.py` | `CREATE` | Bộ unit tests cho Naive RW, Futures Baseline (đủ và thiếu kỳ hạn), VECM và kịch bản phân kỳ kích hoạt Ridge fallback |

---

## 4. Implementation Details

1. **Futures-Implied Baseline:**
   - Điểm neo kỳ hạn: Tuần 1–4 gán theo $M_1$; tuần 5–12 nội suy tuyến tính giữa $M_1$ và $M_3$; tuần 13–26 nội suy tuyến tính giữa $M_3$ và $M_6$.
   - Khi dữ liệu thiếu $M_3$ hoặc $M_6$, thuật toán tự động ngoại suy phẳng từ kỳ hạn gần nhất khả dụng mà không phát sinh lỗi `NaN`.
   - Giá dự báo trung vị: $\hat{P}_{50, h} = (\text{London}_h / 1000 \times \text{USD\_VND}) + \overline{\text{Basis}}_{52w}$.
2. **VECM & Johansen Cointegration Anchor:**
   - Kiểm định Johansen trace test tại mức ý nghĩa 90% để xác định bậc đồng tích hợp $r \in [1, K-1]$.
   - Fit mô hình `VECM(..., k_ar_diff=1, coint_rank=r, deterministic="co")` bảo toàn mối quan hệ cân bằng dài hạn giữa giá cà phê Tây Nguyên, London Robusta, tỷ giá và giá dầu Brent.
3. **Ridge-Regularized VAR Fallback (Minnesota-Style Shrinkage):**
   - Khi $r = 0$, hoặc ma trận VECM kỳ dị, hoặc giá trị dự báo vượt ngưỡng biên độ hợp lý ($|\Delta \ln Y| \ge 1.2$), hệ thống tự động kích hoạt `_estimate_ridge_var` trên chuỗi sai phân bậc 1 $\Delta \ln Y_t$.
   - Ma trận điều chuẩn $X^T X + \alpha I$ (với $\alpha = 1.0$) co các hệ số tự hồi quy bậc cao về 0, triệt tiêu hoàn toàn nguy cơ nổ nghiệm số mũ trong 26 bước dự báo đệ quy.
4. **Analytical Uncertainty Quantiles:**
   - Ước lượng phương sai phần dư mẫu $\hat{\sigma}_e$, sai số dự báo đa bước mở rộng theo $\sigma_h = \hat{\sigma}_e \sqrt{h}$.
   - Tính toán trực tiếp $P_{10} = \hat{Y}_{t+h} \exp(-1.28155 \sigma_h)$ và $P_{90} = \hat{Y}_{t+h} \exp(+1.28155 \sigma_h)$ kèm sắp xếp đơn điệu bắt buộc `sorted([P10, P50, P90])`.

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
collecting ... collected 15 items

tests/test_api.py::test_health_check PASSED                              [  6%]
tests/test_api.py::test_forecast_endpoint_insufficient_history PASSED    [ 13%]
tests/test_api.py::test_forecast_endpoint_rejects_nan PASSED             [ 20%]
tests/test_api.py::test_forecast_endpoint_valid_payload_runs_preprocessing PASSED [ 26%]
tests/test_econometric.py::TestBaselinesSuite::test_naive_random_walk_structure_and_monotonicity PASSED [ 33%]
tests/test_econometric.py::TestBaselinesSuite::test_futures_implied_baseline_with_full_and_missing_curve PASSED [ 40%]
tests/test_econometric.py::TestEconometricLegSuite::test_econometric_forecast_full_cycle PASSED [ 46%]
tests/test_econometric.py::TestEconometricLegSuite::test_econometric_explosive_series_triggers_ridge_fallback PASSED [ 53%]
tests/test_preprocessing.py::TestSchemasValidation::test_pydantic_rejects_nan_and_inf PASSED [ 60%]
tests/test_preprocessing.py::TestSchemasValidation::test_pydantic_enforces_quantile_monotonicity PASSED [ 66%]
tests/test_preprocessing.py::TestSchemasValidation::test_forecast_request_rejects_insufficient_history PASSED [ 73%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_resample_daily_to_weekly_w_fri PASSED [ 80%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_climate_causal_publication_lag PASSED [ 86%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_leakage_canary_test PASSED [ 93%]
tests/test_preprocessing.py::TestPreprocessingPipeline::test_multistep_targets_alignment PASSED [100%]

======================== 15 passed, 4 warnings in 2.53s ========================
```

---

## 6. Next Step Recommendation

**STEP 3.2 HOÀN TẤT THÀNH CÔNG 100%!**

Sẵn sàng chuyển sang **STEP 3.3: Nonlinear Leg (Direct Multi-Horizon LightGBM Quantile Regression)**:
- Xây dựng mô hình phi tuyến tính dự báo trực tiếp các phân vị $P_{10}, P_{50}, P_{90}$ cho tỷ suất sinh lời log $y^{(h)}_t = \ln(Y_{t+h}) - \ln(Y_t)$ với $h = 1..26$.
- Thiết lập quy tắc cắt mẫu huấn luyện nghiêm ngặt: $s + h \le t_0$ (loại trừ hoàn toàn rủi ro rò rỉ target tương lai qua mốc $t_0$).
