# TECHNICAL & DOMAIN ANALYSIS — AGENT MINDSET BRIEFING

> Read this file before touching any code or model. It explains **WHY** this system is designed this way and what mistakes you must NEVER repeat.

---

## 1. Domain Reality: Central Highlands Robusta Coffee Market

1. **Real Domestic Price vs. International Proxy:**
   - Domestic raw coffee prices in Vietnam's Central Highlands (Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông) are NOT a fixed multiple of international USD/lb prices.
   - Using a fixed exchange rate (e.g., `24,000 VND/USD`) destroys real-world accuracy because USD/VND floats significantly, and local prices reflect domestic supply tightness, logistics costs, and fluctuating **FOB differentials (Basis)**.
   - **Rule:** Always ingest REAL local provincial prices (benchmark: Đắk Lắk) and REAL commercial USD/VND exchange rates (e.g., Vietcombank).
2. **What Traders Actually Look At Every Morning (Daily Signals):**
   - **Domestic–Global Basis (VNĐ/kg):**
     $$\text{Basis}_t = \text{DakLakPrice}_t - \left(\frac{\text{LondonM1}_t}{1000} \times \text{USD\_VND}_t\right)$$
     Tells whether domestic coffee is trading at a premium or discount relative to ICE London. Basis is strongly mean-reverting.
   - **Futures Term Structure (Calendar Spread):**
     $$\text{Spread}_t = \text{LondonM1}_t - \text{LondonM6}_t$$
     Positive spread (**Backwardation**) signals acute near-term physical shortage (bullish). Negative spread (**Contango**) signals ample supply.
   - **30-Day Rolling Volatility & Z-Score:** Flags abnormal shock days (`|z| > 2.5`) immediately via Telegram.

---

## 2. Why Forecasting Commodity Prices 6 Months Ahead Is Hard (And How We Solve It)

### Traps to AVOID (Lessons Learned):

- **Trap 1 — Level-Based Tree/KNN/SVR Extrapolation Failure:** Coffee undergoes structural regime shifts (e.g., jumping from 48k to 215k VNĐ/kg). Tree-based models (LightGBM/RF/CART), KNN, and RBF-SVR trained on raw price levels mathematically CANNOT extrapolate beyond the training set maximum.
- **Trap 2 — Daily-to-180-Day Recursive Explosion:** Daily prices contain extreme microstructure noise. Rolling a 1-day model forward 180 times compounds error exponentially.
- **Trap 3 — Deep Learning on Small Tabular Series:** With ~300–500 weekly observations (2018–2026), LSTM/Transformers overfit badly and fail to beat simple baselines.
- **Trap 4 — Ex-post Contemporaneous Cheating:** Using `London_t` to predict `DakLak_t` is Nowcasting, NOT Forecasting. At forecast origin `t`, future `London_{t+h}` is unknown.
- **Trap 5 — Point Forecast Illusion:** A single number like "153,876 VNĐ/kg" 6 months from now is useless for risk management. Users need probabilistic intervals (`P10`, `P50`, `P90`).

### Our Production Solution:

1. **Target Transformation (Direct Multi-Step Log-Return):**
   Resample to Weekly (`W-FRI`). For each horizon $h \in \{1, 2, \dots, 26\}$ weeks:
   $$y^{(h)}_t = \ln(Y_{t+h}) - \ln(Y_t)$$
   Reconstruct price via:
   $$\hat{Y}_{t+h} = Y_t \cdot \exp(\hat{y}^{(h)}_t)$$
   This eliminates trend non-stationarity and completely solves the tree extrapolation problem.
2. **Two-Legged Ensemble Architecture:**
   - **Leg 1 — Econometric Anchor (BVAR / VECM):** Jointly forecasts the macro system (`DakLak`, `London M1`, `USD/VND`, `Brent`) while preserving long-run cointegration/equilibrium dynamics.
   - **Leg 2 — Nonlinear Quantile Engine (LightGBM Quantile Regression):** Captures nonlinear interactions (e.g., high El Niño ONI + strong backwardation + harvest season) and directly outputs **P10, P50, P90** using `objective='quantile'`.
   - **Ensemble Blending:** Optimize weights via Expanding-Window Walk-Forward CV across horizons, and audit against **Naive Random Walk** and **Futures-Implied Baseline** (`London M6 * USD/VND + historical mean basis`).
3. **Production Forecast Auditability:**
   - Every weekly run stores its full 26-week forecast vector in `forecast_predictions` tied to `run_id`.
   - Over time, the system automatically joins historical `forecast_predictions.target_date` against newly observed `raw_market_prices.price_date` to measure **real live accuracy**, never relying solely on offline backtests.

---

## 3. System Engineering Mindset

- **Scrapers Will Break:** Vietnamese commodity sites change HTML markup without notice. Every scraper MUST have: retry with exponential backoff, a secondary fallback source, a sanity validator (reject > ±15% day-over-day jump), and instant Telegram failure alerting.
- **Keep ML Compute Dumb & Pure:** FastAPI receives clean JSON, computes deterministically (`random_state=42`), validates output with Pydantic (no `NaN`/`Inf`), and returns JSON. No hidden DB connections, no cron jobs inside Python.
- **Audit Trail First:** Never overwrite old forecasts. Append new `forecast_runs` so the user can inspect how the model's 6-month view evolved week by week.
