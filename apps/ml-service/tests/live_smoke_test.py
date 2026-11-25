"""
Live Smoke Test: Sends a full realistic HTTP request to POST http://localhost:8000/api/v1/forecast/weekly
Verifies latency, HTTP 200 response, and prints the 26-week forecast comparison table.
"""

import time
import json
import httpx
from datetime import date, timedelta
import numpy as np

def generate_payload():
    start_date = date(2021, 1, 1)
    n_days = 1400  # 200 weeks
    data = []

    np.random.seed(42)
    current_price = 72000.0
    current_london = 4500.0

    for i in range(n_days):
        dt = start_date + timedelta(days=i)
        ret = np.random.normal(0.0003, 0.015)
        current_price *= np.exp(ret)
        current_london *= np.exp(np.random.normal(0.0002, 0.012))

        if dt.weekday() >= 5 and np.random.rand() > 0.3:
            continue

        data.append(
            {
                "date": str(dt),
                "price_daklak": round(current_price, 2),
                "london_m1": round(current_london, 2),
                "london_m3": round(current_london * 0.97, 2),
                "london_m6": round(current_london * 0.94, 2),
                "usd_vnd": 25400.0,
                "brent_oil": 82.5,
            }
        )

    climate = []
    for i in range(70):
        year = 2020 + (i // 12)
        month = (i % 12) + 1
        m_dt = f"{year}-{month:02d}-01"
        climate.append(
            {
                "month_date": m_dt,
                "oni": round(float(0.6 * np.sin(i / 6.0)), 2),
                "rainfall_anomaly_daklak": round(float(12.0 * np.cos(i / 4.0)), 2),
                "rainfall_anomaly_linhares": round(float(18.0 * np.sin(i / 5.0)), 2),
            }
        )

    return {
        "run_date": data[-1]["date"],
        "market_prices": data,
        "macro_climate": climate,
    }

def main():
    print("================================================================================")
    print("   LIVE HTTP FORECAST SMOKE TEST — POST /api/v1/forecast/weekly")
    print("================================================================================")

    payload = generate_payload()
    print(f"Payload generated: {len(payload['market_prices'])} daily market prices, {len(payload['macro_climate'])} climate points")
    print(f"Origin Date: {payload['run_date']}")

    url = "http://localhost:8000/api/v1/forecast/weekly"
    print(f"Sending request to {url}...")

    t0 = time.perf_counter()
    with httpx.Client(timeout=90.0) as client:
        response = client.post(url, json=payload)
    latency_sec = time.perf_counter() - t0

    print(f"Response Status Code: {response.status_code}")
    print(f"End-to-End Latency:   {latency_sec:.2f} seconds (Budget: < 90.0s)")

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    print("\n--- AUDIT METRICS (OUT-OF-SAMPLE WALK-FORWARD CV) ---")
    metrics = data["metrics"]
    print(f"  • Walk-Forward MAPE (4 weeks):   {metrics['wf_mape_4w']:.2f}%")
    print(f"  • Walk-Forward MAPE (12 weeks):  {metrics['wf_mape_12w']:.2f}%")
    print(f"  • Walk-Forward MAPE (26 weeks):  {metrics['wf_mape_26w']:.2f}%")
    print(f"  • Average Pinball Loss:          {metrics['pinball_loss']:.4f}")
    print(f"  • Beats Naive Random Walk:       {metrics['beats_naive_baseline']}")

    print("\n--- 26-WEEK PROBABILISTIC FORECAST COMPARISON TABLE ---")
    print(f"{'Week':<6} {'Target Date':<12} {'P10 (VNĐ)':<12} {'P50 (VNĐ)':<12} {'P90 (VNĐ)':<12} {'Naive RW':<12} {'Futures Implied':<16}")
    print("-" * 84)

    for p in data["predictions"]:
        h = p["horizon_week"]
        is_milestone = h in [1, 4, 12, 26]
        marker = " ◄" if is_milestone else ""
        print(
            f"W{h:<5} {p['target_date']:<12} {p['pred_p10']:>10,.0f}  {p['pred_p50']:>10,.0f}  {p['pred_p90']:>10,.0f}  "
            f"{p['baseline_naive']:>10,.0f}  {p['baseline_futures']:>14,.0f}{marker}"
        )

    print("-" * 84)
    print("================================================================================\n")

if __name__ == "__main__":
    main()
