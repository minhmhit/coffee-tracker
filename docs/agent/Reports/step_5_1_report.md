# STEP REPORT: STEP 5.1 — LIVE DAILY WEATHER, ICE CERTIFIED ROBUSTA STOCKS & SCHEMA EXTENSION

- **Date / Time:** 2026-11-25 15:38 (UTC+7)
- **Phase / Step:** Phase 5 — Step 5.1
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Mở rộng PostgreSQL schema qua Prisma ORM (tuân thủ **Single Writer Principle** & **Zero Float Principle**) với 3 bảng mới:
  1. `daily_weather`: Lưu thời tiết trực tiếp hàng ngày & khuyến nghị nông vụ cho **4 tỉnh Tây Nguyên** (`DAKLAK`, `LAMDONG`, `GIALAI`, `DAKNONG`), sử dụng `@db.Decimal`, `@db.Date`, `Int`, khóa duy nhất `@@unique([weather_date, province_code])`.
  2. `ice_robusta_stocks`: Lưu tồn kho cà phê Robusta chứng nhận trên sàn ICE Futures Europe (`report_date`, `certified_lots`, `certified_tonnes`, `dod_change_lots`, `source_name`, `is_stale`, `raw_meta`), quy đổi chuẩn `certified_tonnes = certified_lots * 10`.
  3. `telegram_subscribers`: Quản lý người dùng tự kết nối Telegram Bot (`chat_id`, `username`, `first_name`, `is_active`, `subscribed_at`).
- Xây dựng `WeatherAdapter` (Open-Meteo Forecast API batch 4 tỉnh) và `IceStocksAdapter` (ICE Report Center 173 + VietnamBiz coffee news fallback + stale carry-forward) cùng `IceStocksSanityValidator` (`[500, 50000]` lô, `±25%` DoD delta).
- Tích hợp vào `ingestion-queue` với cơ chế **fault isolation** (lỗi thời tiết/ICE stocks tuyệt đối không làm gián đoạn luồng thu thập giá thị trường chính) và bổ sung lịch chạy sớm `early_weather_0545` (`45 5 * * *` `Asia/Ho_Chi_Minh`) trước bản tin sáng `06:00`.
- Cung cấp 4 REST API endpoints mới: `GET /api/weather/today`, `GET /api/weather/history?days=7`, `GET /api/stocks/robusta/latest`, `GET /api/stocks/robusta/history?days=90`.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Phạm vi `daily_weather`:** Lựa chọn A — theo dõi **cả 4 tỉnh Tây Nguyên** (`Đắk Lắk`, `Lâm Đồng`, `Gia Lai`, `Đắk Nông`) qua Open-Meteo Forecast API.
- **Lịch cập nhật thời tiết:** Chạy đồng bộ cùng `morning_domestic_0830` **VÀ** bổ sung job độc lập lúc `05:45` (`45 5 * * *` `Asia/Ho_Chi_Minh`) trước giờ phát Telegram `06:00`.
- **Nguồn & Fallback `IceStocksAdapter`:** Kiểm tra live `https://www.ice.com/report/173` (trả về SPA / Click-Through Agreement shell), tự động fallback sang tin thị trường hàng ngày trên `vietnambiz.vn` (đã xác minh live trích xuất được `5.791 lô` Robusta đồng thời loại bỏ nhầm lẫn `268.614 bao` Arabica) và giữ lại giá trị hợp lệ gần nhất kèm cờ `is_stale = true` nếu cả hai nguồn lỗi.
- **Ngưỡng kiểm tra `IceStocksSanityValidator`:** `certified_lots` trong `[500, 50000]` và biến động ngày-qua-ngày `<= ±25%`.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/prisma/schema.prisma` | `MODIFY` | Bổ sung `DailyWeather`, `IceRobustaStock`, `TelegramSubscriber` (100% Zero Float) |
| `apps/orchestrator/prisma/migrations/20261125082559_add_weather_stocks_and_telegram_subscribers/migration.sql` | `CREATE` | Migration PostgreSQL áp dụng thành công |
| `apps/orchestrator/src/ingestion/types/market-data.types.ts` | `MODIFY` | Bổ sung `ProvinceWeatherData`, `IceRobustaStockData` |
| `apps/orchestrator/src/ingestion/ingestion.constants.ts` | `MODIFY` | Bổ sung `DAILY_WEATHER`, `DAILY_ICE_STOCKS`, cron `EARLY_WEATHER = '45 5 * * *'` |
| `apps/orchestrator/src/ingestion/validators/ice-stocks-sanity.validator.ts` | `CREATE` | Kiểm tra ngưỡng `[500, 50000]` lô, `tonnes = lots * 10`, DoD `±25%` |
| `apps/orchestrator/src/ingestion/adapters/weather.adapter.ts` | `CREATE` | Fetch batch Open-Meteo Forecast 4 tỉnh, ánh xạ WMO code & ghi chú nông vụ tiếng Việt |
| `apps/orchestrator/src/ingestion/adapters/ice-stocks.adapter.ts` | `CREATE` | Scraper ICE 173 + VietnamBiz Robusta stocks fallback (hỗ trợ biên ranh giới Unicode tiếng Việt) |
| `apps/orchestrator/src/ingestion/ingestion.service.ts` | `MODIFY` | Bổ sung `syncDailyWeather` và `syncIceRobustaStocks` (idempotent UPSERT + stale carry-forward) |
| `apps/orchestrator/src/ingestion/processors/ingestion.processor.ts` | `MODIFY` | Xử lý `INGEST_DAILY_WEATHER`, `INGEST_DAILY_ICE_STOCKS` và cô lập lỗi trong `DAILY_MARKET_DATA` |
| `apps/orchestrator/src/ingestion/schedulers/ingestion.scheduler.ts` | `MODIFY` | Đăng ký cron thứ 4 `early_weather_0545` (`45 5 * * *`) |
| `apps/orchestrator/src/ingestion/weather.controller.ts` | `CREATE` | Endpoints `GET /api/weather/today` và `GET /api/weather/history` |
| `apps/orchestrator/src/ingestion/stocks.controller.ts` | `CREATE` | Endpoints `GET /api/stocks/robusta/latest` và `GET /api/stocks/robusta/history` |
| `apps/orchestrator/src/ingestion/ingestion.module.ts` | `MODIFY` | Đăng ký adapters, validator và controllers mới |
| `apps/orchestrator/src/ingestion/scripts/sync-weather-stocks.ts` | `CREATE` | Script CLI đồng bộ live weather & ICE stocks |
| `apps/orchestrator/package.json` | `MODIFY` | Thêm script `sync:weather-stocks` |
| `apps/orchestrator/test/fixtures/open_meteo_forecast_4provinces.json` | `CREATE` | Fixture JSON Open-Meteo Forecast thực tế 4 tỉnh |
| `apps/orchestrator/test/fixtures/ice_report_173_spa.html` | `CREATE` | Fixture shell SPA / Click-Through Agreement của ICE 173 |
| `apps/orchestrator/test/fixtures/vietnambiz_robusta_stocks.html` | `CREATE` | Fixture tin VietnamBiz trích xuất 5.791 lô Robusta & 268.614 bao Arabica |
| `apps/orchestrator/src/ingestion/test/weather-stocks.spec.ts` | `CREATE` | Bộ unit tests cho Weather, ICE Stocks, Validator & Controllers |
| `apps/orchestrator/src/ingestion/test/ingestion-processor.spec.ts` | `MODIFY` | Cập nhật test cho 4 schedulers & kiểm thử cô lập lỗi (fault isolation) |

---

## 4. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

### 4.1. Prisma Validation, Migration & PostgreSQL Column Verification (Zero Float)

```text
The schema at prisma\schema.prisma is valid 🚀
Applying migration `20261125082559_add_weather_stocks_and_telegram_subscribers`
Database schema is up to date!
```

```sql
\d daily_weather
-- temp_current numeric(5,2), temp_min numeric(5,2), temp_max numeric(5,2), precipitation_mm numeric(7,2), wind_speed_kmh numeric(6,2)
-- Indexes: "daily_weather_weather_date_province_code_key" UNIQUE, btree (weather_date, province_code)

\d ice_robusta_stocks
-- certified_lots integer, certified_tonnes numeric(12,2), dod_change_lots integer, is_stale boolean
-- Indexes: "ice_robusta_stocks_report_date_key" UNIQUE, btree (report_date)

\d telegram_subscribers
-- chat_id text NOT NULL, is_active boolean DEFAULT true
-- Indexes: "telegram_subscribers_chat_id_key" UNIQUE, btree (chat_id)
```

### 4.2. Production Build & Full Jest Suite (9 Suites, 83/83 Tests PASS)

```bash
$ pnpm --filter @coffee-tracker/orchestrator run build ; pnpm --filter @coffee-tracker/orchestrator test
PASS src/ingestion/test/market-controller.spec.ts (14.213 s)
PASS src/signals/test/signals-controller.spec.ts
PASS src/alerts/test/alerts.spec.ts (15.051 s)
PASS src/signals/test/signals.spec.ts (15.074 s)
PASS src/ingestion/test/climate-ingestion.spec.ts
PASS src/forecast/test/forecast.spec.ts (15.383 s)
PASS src/ingestion/test/ingestion.spec.ts (15.863 s)
PASS src/ingestion/test/weather-stocks.spec.ts (18.107 s)
PASS src/ingestion/test/ingestion-processor.spec.ts (18.594 s)

Test Suites: 9 passed, 9 total
Tests:       83 passed, 83 total
Snapshots:   0 total
Time:        20.467 s
```

### 4.3. Live Weather & ICE Robusta Stocks Sync Output

```bash
$ pnpm --filter @coffee-tracker/orchestrator run sync:weather-stocks
[WeatherAdapter] Fetching live daily weather for 4 Central Highlands provinces via Open-Meteo...
[IngestionService] Weather sync completed: upserted 4 provinces for 2026-11-25
Weather Result: { "success": true, "syncedCount": 4, "date": "2026-11-25" }

[IceStocksAdapter] Fetching ICE Certified Robusta Stocks from primary source: https://www.ice.com/report/173
[IceStocksAdapter] ICE Report 173 primary fetch unavailable (ICE Report 173 returned client-side SPA / click-through agreement shell). Trying VietnamBiz fallback...
[IngestionService] ICE Robusta stocks synced: 5791 lots (57910 tonnes) for 2026-11-24 from vietnambiz.vn (fallback)
ICE Stocks Result: {
  "success": true,
  "reportDate": "2026-11-24",
  "certifiedLots": 5791,
  "certifiedTonnes": 57910,
  "isStale": false
}
```

### 4.4. Live HTTP REST Endpoints Verification (`curl`)

#### `GET /api/weather/today`
```json
{"date":"2026-11-25","benchmark":{"weather_date":"2026-11-25","province_code":"DAKLAK","province_name":"Đắk Lắk","temp_current":28.4,"temp_min":22.3,"temp_max":30.1,"precipitation_mm":0,"rain_probability":19,"humidity_pct":60,"wind_speed_kmh":17.1,"weather_code":0,"condition_vi":"Trời quang, nắng ráo","farming_impact_vi":"Thời tiết nắng ráo, thuận lợi cho hoạt động thu hái và phơi sấy cà phê nhân.","updated_at":"2026-11-25T08:36:26.775Z"},"provinces":[{"weather_date":"2026-11-25","province_code":"DAKLAK",...},{"weather_date":"2026-11-25","province_code":"LAMDONG","temp_current":23.6,"precipitation_mm":6.3,"condition_vi":"Mưa phùn vừa",...},{"weather_date":"2026-11-25","province_code":"GIALAI","temp_current":25.9,"precipitation_mm":2,"condition_vi":"Mưa phùn nhẹ",...},{"weather_date":"2026-11-25","province_code":"DAKNONG","temp_current":28,"precipitation_mm":0.1,"condition_vi":"Trời quang, nắng ráo",...}]}
```

#### `GET /api/stocks/robusta/latest`
```json
{"report_date":"2026-11-24","certified_lots":5791,"certified_tonnes":57910,"dod_change_lots":null,"source_name":"vietnambiz.vn (fallback)","is_stale":false,"raw_meta":{"is_stale":false,"articleUrl":"https://vietnambiz.vn/gia-ca-phe-hom-nay-2411-ap-luc-nguon-cung-khien-gia-tiep-tuc-di-xuong-2026112410355362.htm","matchedSnippet":"Đối với Robusta, tồn kho tại các kho của ICE tăng mạnh kể từ đầu tháng 10 và đạt mức cao nhất trong 1,25 năm, với 6.809 lô vào ngày 29/10. Sau đó, lượng tồn kho giảm xuống mức thấp nhất trong một tháng, còn 5.776 lô vào thứ Sáu tuần trước, trước khi nhích nhẹ lên 5.791 lô trong p"},"updated_at":"2026-11-25T08:36:30.863Z","change_7d_lots":null,"change_30d_lots":null}
```

---

## 5. Next Step

- Chuyển sang **STEP 5.2: Explainable Market Insights Engine** (xác nhận Ambiguity Check với người dùng trước khi code `InsightsModule`).
