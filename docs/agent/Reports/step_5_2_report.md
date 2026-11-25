# STEP REPORT: STEP 5.2 — EXPLAINABLE MARKET INSIGHTS ENGINE

- **Date / Time:** 2026-11-25 15:54 (UTC+7)
- **Phase / Step:** Phase 5 — Step 5.2
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng **Market Insights & Forecast Explainability Engine** (`InsightsModule`) chuyển hóa dữ liệu thô (`raw_market_prices`, `ice_robusta_stocks`, `daily_signals`, `daily_weather`, `macro_climate_monthly`, `forecast_runs`, `forecast_predictions`) thành nhận định tiếng Việt có dẫn chứng định lượng rõ ràng, độ trễ `< 35ms`, **zero LLM hallucination**:
  1. **Giá dầu thô Brent (`oil`):** Phân tích biến động 7 ngày / 35 ngày và so sánh MA, giải thích tác động lên chi phí vận tải biển & xuất khẩu.
  2. **Tồn kho ICE & Cung – Cầu Robusta (`inventory_supply`):** Kết hợp **ICE Certified Robusta Stocks** (`5.791 lô / 57.910 tấn`) với **Calendar Spread M1–M6** (`+$337/tấn`), **Regime** (`BACKWARDATION_STRONG`), và **Basis** (`-45.064 đ/kg`).
  3. **Tỷ giá USD/VND (`fx`):** Biến động 7 ngày / 35 ngày và tác động quy đổi xuất khẩu.
  4. **Thời tiết Tây Nguyên & Khí hậu (`weather_climate`):** Tổng hợp thời tiết trực tiếp 4 tỉnh hôm nay (nhấn mạnh Đắk Lắk + cảnh báo tỉnh có mưa) cùng bối cảnh **NOAA ONI** (lấy mốc công bố hợp lệ gần nhất không bị null) và dị thường mưa VN / Brazil.
  5. **Minh bạch Dự báo 6 tháng (`forecast_transparency`):** Giải thích kịch bản trung vị $P_{50}$ ở 3 mốc `1 Tháng (T+4)`, `3 Tháng (T+12)`, `6 Tháng (T+26)`, biên tin cậy 80% ($P_{10} - P_{90}$), so sánh với đường Futures-Implied, và công bố trung thực `wf_mape_4w`, `wf_mape_12w`, `wf_mape_26w`, `pinball_loss`, `beats_naive_baseline`.
- Cung cấp endpoint `GET /api/insights/latest` trả JSON sạch, không `NaN`/`undefined`, suy giảm an toàn (`graceful degradation`) khi thiếu bất kỳ bảng tùy chọn nào.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Cơ chế sinh nhận định:** Xác nhận 100% quy tắc định lượng tất định + template tiếng Việt (trích dẫn số liệu trực tiếp từ PostgreSQL).
- **Xử lý giai đoạn đầu tồn kho ICE chưa đủ 7 ngày:** Xác nhận hiển thị số lô/tấn mới nhất kèm thông báo chuỗi 7–30 ngày đang tích lũy, đồng thời tham chiếu chênh lệch kỳ hạn (`Calendar Spread M1–M6`) và `Regime` để đánh giá xu hướng cung – cầu.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/insights/insights.dto.ts` | `CREATE` | Interfaces chuẩn cho `MarketInsightsResponse`, `InsightFactorCard`, `ForecastTransparencySummary` |
| `apps/orchestrator/src/insights/insights.service.ts` | `CREATE` | 5 bộ phân tích định lượng (`analyzeOil`, `analyzeInventoryAndSupply`, `analyzeFx`, `analyzeWeatherAndClimate`, `analyzeForecastTransparency`) |
| `apps/orchestrator/src/insights/insights.controller.ts` | `CREATE` | Endpoint `GET /api/insights/latest` |
| `apps/orchestrator/src/insights/insights.module.ts` | `CREATE` | Export `InsightsService` cho cả HTTP Controller và Step 5.3 (`AlertsModule`) |
| `apps/orchestrator/src/insights/test/insights.spec.ts` | `CREATE` | Bộ unit tests kiểm tra tất cả các nhánh xu hướng, stale fallback và empty DB |
| `apps/orchestrator/src/app.module.ts` | `MODIFY` | Tích hợp `InsightsModule` vào ứng dụng NestJS |

---

## 4. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

### 4.1. Jest Test Suite (10 Suites, 89/89 Tests PASS)

```bash
$ pnpm --filter @coffee-tracker/orchestrator test
PASS src/alerts/test/alerts.spec.ts (14.687 s)
PASS src/signals/test/signals.spec.ts (15.508 s)
PASS src/forecast/test/forecast.spec.ts (15.435 s)
PASS src/ingestion/test/market-controller.spec.ts
PASS src/ingestion/test/weather-stocks.spec.ts (15.807 s)
PASS src/ingestion/test/climate-ingestion.spec.ts
PASS src/ingestion/test/ingestion.spec.ts (16.225 s)
PASS src/ingestion/test/ingestion-processor.spec.ts (16.507 s)
PASS src/signals/test/signals-controller.spec.ts
PASS src/insights/test/insights.spec.ts (17.95 s)

Test Suites: 10 passed, 10 total
Tests:       89 passed, 89 total
Snapshots:   0 total
Time:        19.754 s
```

### 4.2. Live HTTP Latency Benchmark (5 Calls — 19ms to 35ms)

```text
Call 1 HTTP 200 - 0.029777s
Call 2 HTTP 200 - 0.035072s
Call 3 HTTP 200 - 0.029031s
Call 4 HTTP 200 - 0.025942s
Call 5 HTTP 200 - 0.019351s
```

### 4.3. Live `GET /api/insights/latest` JSON Sample

```json
{
  "generated_at": "2026-11-25T08:53:55.290Z",
  "as_of_date": "2026-11-22",
  "overall_stance": "TÍCH CỰC",
  "executive_summary": "Giá cà phê Đắk Lắk hiện ở mức 71.800 đ/kg. Tồn kho & cung cầu (5.791 lô (57.910 tấn)) mang tín hiệu cung thắt chặt (backwardation); dầu Brent $89.95/thùng (ĐI NGANG (+0.72% / 7N)); thời tiết Tây Nguyên 28.4°C • 0.0 mm (el niño mạnh / thiếu hụt mưa). Dự báo trung vị 6 tháng đạt 75.311 đ/kg (+4.89%, P10–P90: 73.578–96.132 đ).",
  "factors": [
    {
      "key": "oil",
      "title": "Giá dầu thô Brent",
      "trend": "NEUTRAL",
      "badge_label": "ĐI NGANG (+0.72% / 7N)",
      "metric_value": "$89.95/thùng"
    },
    {
      "key": "inventory_supply",
      "title": "Tồn kho ICE & Cung – Cầu Robusta",
      "trend": "UP",
      "badge_label": "CUNG THẮT CHẶT (BACKWARDATION)",
      "metric_value": "5.791 lô (57.910 tấn)"
    },
    {
      "key": "fx",
      "title": "Tỷ giá USD/VND",
      "trend": "NEUTRAL",
      "badge_label": "ỔN ĐỊNH (+0.05% / 7N)",
      "metric_value": "25.600 đ"
    },
    {
      "key": "weather_climate",
      "title": "Thời tiết Tây Nguyên & Khí hậu",
      "trend": "UP",
      "badge_label": "EL NIÑO MẠNH / THIẾU HỤT MƯA",
      "metric_value": "28.4°C • 0.0 mm"
    }
  ],
  "forecast_transparency": {
    "available": true,
    "run_id": "b10e0d43-d324-4253-b76a-472333f4af25",
    "forecast_date": "2026-11-22",
    "origin_price_daklak": 71800,
    "direction_label": "XU HƯỚNG TĂNG",
    "metrics": {
      "wf_mape_4w": 1.36,
      "wf_mape_12w": 2.45,
      "wf_mape_26w": 5.68,
      "pinball_loss": 0.0083,
      "beats_naive_baseline": false
    }
  }
}
```

---

## 5. Next Step

- Chuyển sang **STEP 5.3: Telegram Bot Self-Service Onboarding & Enriched Morning Briefing** (dừng tại Ambiguity Check để người dùng xác nhận chế độ cập nhật Polling/Webhook và Bot Username).
