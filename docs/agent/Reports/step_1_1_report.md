# STEP REPORT: STEP 1.1 — MARKET DATA SCRAPERS, FALLBACK ADAPTERS & SANITY VALIDATOR

- **Date / Time:** 2026-11-22 20:55 (UTC+7)
- **Phase / Step:** Phase 1 — Step 1.1
- **Status:** `PASS`

---

## 1. Goals & Scope Recap

- Xây dựng các module adapter thu thập dữ liệu thị trường có khả năng chịu lỗi tại `apps/orchestrator/src/ingestion/adapters/`:
  1. Giá cà phê nội địa Tây Nguyên (Đắk Lắk benchmark, Lâm Đồng, Gia Lai, Đắk Nông) với nguồn sơ cấp `giacaphe.com` và nguồn dự phòng `vietnambiz.vn`.
  2. Giá kỳ hạn ICE London Robusta (`M1`, `M3`, `M6`) từ bảng trực tuyến.
  3. Tỷ giá thương mại thực tế `USD/VND` từ Vietcombank XML feed.
  4. Giá dầu thô Brent Crude Oil (`BZ=F`) từ Yahoo Finance.
- Xây dựng `PriceSanityValidator` kiểm tra nghiêm ngặt tính hợp lệ dữ liệu (bảo vệ chống đột biến ngày-qua-ngày `> ±15%`, giá âm hoặc bằng 0, thiếu tỉnh chuẩn Đắk Lắk, hoặc dải giá vô lý) trước khi lưu trữ hoặc chuyển tiếp.
- Viết bộ Jest unit tests toàn diện giả lập cả trường hợp bình thường, trường hợp fallback và các kịch bản bất thường/dữ liệu rác.
- Chạy thử nghiệm CLI dry-run kết nối trực tiếp với 4 nguồn dữ liệu trên môi trường thực tế.

---

## 2. Clarifications Resolved (Anti-Hallucination Log)

- **Domestic VN Coffee Price Sources:** Đã xác nhận và kiểm tra nguồn sơ cấp `https://giacaphe.com/gia-ca-phe-noi-dia/` (sử dụng mapping selector CSS `::after` động) và nguồn dự phòng `https://vietnambiz.vn/gia-ca-phe.html` (HTML bảng trực quan).
- **ICE London Robusta Futures:** Đã xác nhận endpoint `https://giacaphe.com/gia-ca-phe-truc-tuyen/` với thuộc tính `data-price` chuẩn xác cho các kỳ hạn M1, M3, M6.
- **USD/VND Exchange Rate:** Đã xác nhận nguồn chính thức Vietcombank XML feed tại `https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx`.
- **Brent Crude Oil:** Đã xác nhận endpoint Yahoo Finance `https://query1.finance.yahoo.com/v8/finance/chart/BZ=F` với User-Agent chuẩn.
- **Sanity Check Thresholds:** Ngưỡng kiểm tra biến động ngày-qua-ngày tối đa `±15%` cho giá cà phê nội địa; chặn mọi giá <= 0; chặn tỷ giá ngoài khoảng `[15.000, 40.000]`; chặn giá dầu Brent ngoài khoảng `[20, 300] USD`.

---

## 3. Files Created / Modified

| File Path | Action | Purpose |
| :-------- | :----- | :------ |
| `apps/orchestrator/src/ingestion/types/market-data.types.ts` | `CREATE` | Định nghĩa TypeScript interfaces nghiêm ngặt: `DailyMarketSnapshot`, `AdapterResult`, `SanityCheckResult`, `IngestionResult` |
| `apps/orchestrator/src/ingestion/adapters/domestic-coffee.adapter.ts` | `CREATE` | Adapter thu thập giá nội địa 4 tỉnh với cơ chế tự động fallback (`giacaphe.com` -> `vietnambiz.vn`) |
| `apps/orchestrator/src/ingestion/adapters/london-robusta.adapter.ts` | `CREATE` | Adapter thu thập giá hợp đồng tương lai Robusta M1/M3/M6 |
| `apps/orchestrator/src/ingestion/adapters/exchange-rate.adapter.ts` | `CREATE` | Adapter trích xuất tỷ giá USD/VND chuyển khoản Vietcombank qua XML |
| `apps/orchestrator/src/ingestion/adapters/brent-oil.adapter.ts` | `CREATE` | Adapter trích xuất giá dầu thô Brent từ Yahoo Finance Chart API |
| `apps/orchestrator/src/ingestion/validators/price-sanity.validator.ts` | `CREATE` | Validator chặn dữ liệu rác, biến động quá ±15%, số âm/NaN |
| `apps/orchestrator/src/ingestion/ingestion.service.ts` | `CREATE` | Service điều phối fetch song song cả 4 nguồn và chạy validation |
| `apps/orchestrator/src/ingestion/ingestion.module.ts` | `CREATE` | IngestionModule export IngestionService và PriceSanityValidator |
| `apps/orchestrator/src/app.module.ts` | `MODIFY` | Wire `IngestionModule` vào `AppModule` |
| `apps/orchestrator/test/fixtures/*` | `CREATE` | Fixture HTML/XML/JSON thực tế phục vụ unit tests cách ly mạng |
| `apps/orchestrator/src/ingestion/test/ingestion.spec.ts` | `CREATE` | 11 unit tests kiểm thử bộ trích xuất, fallback và bộ lọc sanity |
| `apps/orchestrator/src/ingestion/scripts/dry-run.ts` | `CREATE` | Script CLI độc lập chạy kiểm thử fetch trực tiếp từ internet |

---

## 4. Implementation Details

1. **CSS Pseudo-element De-obfuscation:** `giacaphe.com` ẩn giá tiền trong thuộc tính `::after { content: '...' }` được sinh theo class CSS ngẫu nhiên. `DomesticCoffeeAdapter` phân tích stylesheet bằng regex để tạo lookup map theo class, sau đó gắn chính xác giá cho từng tỉnh (`/gia-ca-phe-dak-lak/`, `/gia-ca-phe-lam-dong/`, `/gia-ca-phe-gia-lai/`, `/gia-ca-phe-dak-nong/`).
2. **Transparent Fallback Switch:** Nếu nguồn sơ cấp `giacaphe.com` timeout hoặc lỗi HTTP, adapter tự động chuyển sang `vietnambiz.vn` mà không làm crash tiến trình, đồng thời gắn cờ `domestic_source: "vietnambiz.vn (fallback)"` vào `source_meta`.
3. **Vietcombank XML Parsing:** Sử dụng `fast-xml-parser` xử lý cấu trúc XML bảng tỷ giá, lấy tỷ giá `Transfer` (chuyển khoản thương mại) của `USD`.
4. **Yahoo Finance Handling:** Gửi kèm User-Agent chuẩn desktop browser để tránh bị HTTP 429 rate limit, lấy giá close gần nhất trong chuỗi timestamp.
5. **Zero Float Principle & Strict Typing:** Mọi giá trị trả về dạng number được làm tròn chính xác, cấu trúc sẵn sàng để lưu trữ vào Prisma `Decimal` / PostgreSQL `NUMERIC`.

---

## 5. Self-Check & Verification Evidence (ACTUAL TERMINAL OUTPUT)

- [x] Check 1: `pnpm --filter @coffee-tracker/orchestrator test` — **PASS** (11/11 tests pass)
- [x] Check 2: `pnpm --filter @coffee-tracker/orchestrator run build` — **PASS** (0 TypeScript errors)
- [x] Check 3: `pnpm --filter @coffee-tracker/orchestrator exec ts-node src/ingestion/scripts/dry-run.ts` — **PASS** (Live data fetch & sanity valid)

### A. Jest Unit Test Output

```text
$ jest
[Nest] 18784  - 20:54:46 22/11/2026     LOG [DomesticCoffeeAdapter] Fetching domestic coffee prices from primary source: https://giacaphe.com/gia-ca-phe-noi-dia/
[Nest] 18784  - 20:54:46 22/11/2026    WARN [DomesticCoffeeAdapter] Primary source failed: Connection timeout to primary source. Attempting fallback...
[Nest] 18784  - 20:54:46 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 1 reasons: Đắk Lắk day-over-day price jump (25.00%) exceeds ±15% threshold (Previous: 71800, Current: 89750)
[Nest] 18784  - 20:54:46 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 2 reasons: Benchmark province Đắk Lắk price is invalid or <= 0: -50000; Lâm Đồng price is invalid or <= 0: 0
[Nest] 18784  - 20:54:46 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 1 reasons: Benchmark province Đắk Lắk price is invalid or <= 0: NaN
[Nest] 18784  - 20:54:46 22/11/2026    WARN [PriceSanityValidator] Price sanity check FAILED with 2 reasons: USD/VND rate is outside plausible commercial bounds (15k - 40k): 500; Brent oil price is outside plausible bounds (20 - 300 USD): 5
PASS src/ingestion/test/ingestion.spec.ts
  Market Data Ingestion Suite (Step 1.1)
    1. Domestic Coffee Scrapers & Parsers
      √ should parse giacaphe.com primary HTML with CSS ::after mapping correctly (168 ms)
      √ should parse vietnambiz.vn fallback HTML correctly (109 ms)
      √ should smoothly fall back to vietnambiz when primary source fails (92 ms)
    2. London Robusta Futures Adapter
      √ should parse M1, M3, M6 futures prices from London livequote HTML (135 ms)
    3. Commercial Exchange Rate Adapter
      √ should parse Vietcombank official USD/VND rate from XML feed (10 ms)
    4. Brent Crude Oil Adapter
      √ should parse Brent Oil price from Yahoo Finance chart JSON (2 ms)
    5. PriceSanityValidator (Hard Integrity Checks)
      √ should PASS on normal realistic market prices (1 ms)
      √ should REJECT when a day-over-day price jump exceeds +15% (e.g. +25% spike) (1 ms)
      √ should REJECT negative or zero domestic coffee prices (1 ms)
      √ should REJECT when benchmark province Đắk Lắk is NaN or missing (1 ms)
      √ should REJECT implausible USD/VND or Brent oil prices (1 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        4.367 s, estimated 6 s
Ran all test suites.
```

### B. Live Dry-Run Snapshot Output

```json
================================================================
   COFFEE TRACKER — LIVE MARKET DATA INGESTION DRY-RUN (CLI)   
================================================================
[Nest] 21340  - 20:54:08 22/11/2026     LOG [NestFactory] Starting Nest application...
[Nest] 21340  - 20:54:09 22/11/2026     LOG [PrismaService] Connected to PostgreSQL via Prisma
[Nest] 21340  - 20:54:09 22/11/2026     LOG [IngestionService] Starting coordinated market data fetch for date: 2026-11-22
[Nest] 21340  - 20:54:09 22/11/2026     LOG [DomesticCoffeeAdapter] Fetching domestic coffee prices from primary source: https://giacaphe.com/gia-ca-phe-noi-dia/
[Nest] 21340  - 20:54:09 22/11/2026     LOG [LondonRobustaAdapter] Fetching ICE London Robusta futures from: https://giacaphe.com/gia-ca-phe-truc-tuyen/
[Nest] 21340  - 20:54:09 22/11/2026     LOG [ExchangeRateAdapter] Fetching official USD/VND exchange rate from Vietcombank: https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx
[Nest] 21340  - 20:54:09 22/11/2026     LOG [BrentOilAdapter] Fetching Brent Crude Oil price from: https://query1.finance.yahoo.com/v8/finance/chart/BZ=F

----------------------------------------------------------------
   PARSED DAILY MARKET SNAPSHOT
----------------------------------------------------------------
{
  "snapshot": {
    "date": "2026-11-22",
    "domestic": {
      "daklak": 71800,
      "lamdong": 71200,
      "gialai": 71800,
      "daknong": 72000,
      "average": 71700
    },
    "london": {
      "m1": 4565,
      "m3": 4335,
      "m6": 4228
    },
    "exchangeRate": {
      "usdVnd": 25600,
      "source": "Vietcombank XML Feed",
      "publishedAt": "11/22/2026 8:51:06 PM"
    },
    "brentOil": {
      "price": 89.95,
      "currency": "USD",
      "source": "Yahoo Finance (BZ=F)"
    },
    "sourceMeta": {
      "domestic_source": "giacaphe.com (primary)",
      "domestic_latency_ms": "850",
      "london_source": "giacaphe.com (London Robusta Livequote)",
      "london_latency_ms": "826",
      "fx_source": "vietcombank.com.vn (XML Feed)",
      "fx_latency_ms": "146",
      "oil_source": "Yahoo Finance (BZ=F)",
      "oil_latency_ms": "224"
    }
  },
  "sanityResult": {
    "valid": true,
    "reasons": []
  },
  "errors": []
}

----------------------------------------------------------------
   VALIDATION STATUS: PASSED (VALID)
================================================================
```
