"""
Mandatory Forecasting Baselines:
1. Naive Random Walk (Constant Y_t)
2. Futures-Implied Baseline (Interpolated ICE London M1/M3/M6 curve * USD/VND + 52w historical mean Basis)
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional
import numpy as np
import pandas as pd


def naive_random_walk(
    origin_price: float,
    origin_date: date,
    horizon_weeks: int = 26,
    weekly_vol: Optional[float] = None,
) -> pd.DataFrame:
    """
    Naive Random Walk benchmark: Forecasts constant price Y_t across all horizons h = 1..26.
    Prediction intervals expand with sqrt(h) based on trailing weekly volatility (or default 2% weekly).
    """
    if origin_price <= 0:
        raise ValueError(f"Origin price must be strictly positive, got {origin_price}")

    vol = weekly_vol if weekly_vol and weekly_vol > 0 else 0.02
    rows = []

    # Z-scores for 80% prediction interval (P10 to P90): +/- 1.28155
    z_80 = 1.28155

    for h in range(1, horizon_weeks + 1):
        target_date = origin_date + timedelta(weeks=h)
        # Prediction interval expands with sqrt(h)
        sigma_h = vol * np.sqrt(h)
        pred_p50 = float(origin_price)
        pred_p10 = float(round(origin_price * np.exp(-z_80 * sigma_h), 2))
        pred_p90 = float(round(origin_price * np.exp(z_80 * sigma_h), 2))

        # Enforce strict monotonicity
        p10, p50, p90 = sorted([pred_p10, pred_p50, pred_p90])

        rows.append(
            {
                "horizon_week": h,
                "target_date": target_date,
                "log_ret_p10": float(round(np.log(p10 / origin_price), 6)),
                "log_ret_p50": float(round(np.log(p50 / origin_price), 6)),
                "log_ret_p90": float(round(np.log(p90 / origin_price), 6)),
                "pred_p10": p10,
                "pred_p50": p50,
                "pred_p90": p90,
                "baseline_name": "NAIVE_RANDOM_WALK",
            }
        )

    return pd.DataFrame(rows)


def futures_implied_baseline(
    df_weekly: pd.DataFrame,
    origin_date: date,
    horizon_weeks: int = 26,
) -> pd.DataFrame:
    """
    Futures-Implied Baseline:
    1. Extracts current term structure from ICE London Robusta (M1, M3, M6).
    2. Linearly interpolates the futures price across horizons h = 1..26 weeks:
       - h = 1..4 (M1 anchor)
       - h = 5..12 (interpolated between M1 and M3)
       - h = 13..26 (interpolated between M3 and M6)
       - Fallback: if M3 or M6 missing, extrapolate flat from M1.
    3. Multiplies by current commercial USD/VND / 1000.
    4. Adds trailing 52-week historical mean Basis (VNĐ/kg).
    """
    latest_row = df_weekly.iloc[-1]
    origin_price = float(latest_row["price_daklak"])
    usd_vnd = float(latest_row.get("usd_vnd", 25400.0))
    if usd_vnd <= 0:
        usd_vnd = 25400.0

    m1 = float(latest_row.get("london_m1", 0.0)) if pd.notna(latest_row.get("london_m1")) else 0.0
    m3 = float(latest_row.get("london_m3", 0.0)) if pd.notna(latest_row.get("london_m3")) else 0.0
    m6 = float(latest_row.get("london_m6", 0.0)) if pd.notna(latest_row.get("london_m6")) else 0.0

    # Fallback anchors if futures missing
    if m1 <= 0:
        m1 = origin_price / (usd_vnd / 1000.0)
    if m3 <= 0:
        m3 = m1
    if m6 <= 0:
        m6 = m3

    # Trailing 52-week historical basis: Basis = DakLak - (London_M1 / 1000 * USD_VND)
    if "basis_vnd_kg" in df_weekly.columns:
        basis_series = df_weekly["basis_vnd_kg"].dropna().tail(52)
        mean_basis = float(basis_series.mean()) if len(basis_series) > 0 else 0.0
        basis_std = float(basis_series.std()) if len(basis_series) > 1 else 2000.0
    else:
        # Approximate basis
        computed_basis = df_weekly["price_daklak"] - (df_weekly["london_m1"] / 1000.0 * df_weekly["usd_vnd"])
        basis_series = computed_basis.dropna().tail(52)
        mean_basis = float(basis_series.mean()) if len(basis_series) > 0 else 0.0
        basis_std = float(basis_series.std()) if len(basis_series) > 1 else 2000.0

    # Interpolation anchor points: week 4 -> M1, week 12 -> M3, week 26 -> M6
    anchor_weeks = np.array([1, 4, 12, 26])
    anchor_prices = np.array([m1, m1, m3, m6])

    rows = []
    z_80 = 1.28155

    for h in range(1, horizon_weeks + 1):
        target_date = origin_date + timedelta(weeks=h)

        # 1. Interpolate London futures price for week h
        london_h = float(np.interp(h, anchor_weeks, anchor_prices))

        # 2. Implied physical price = London_h * USD_VND / 1000 + mean_basis
        pred_p50 = float(round((london_h / 1000.0 * usd_vnd) + mean_basis, 2))
        if pred_p50 <= 0:
            pred_p50 = float(origin_price)

        # 3. Uncertainty interval expands with basis volatility + futures uncertainty
        sigma_h = (basis_std / origin_price) * np.sqrt(h / 4.0)
        sigma_h = max(sigma_h, 0.02 * np.sqrt(h))  # minimum 2% vol floor

        pred_p10 = float(round(pred_p50 * np.exp(-z_80 * sigma_h), 2))
        pred_p90 = float(round(pred_p50 * np.exp(z_80 * sigma_h), 2))

        # Strict monotonicity guarantee
        p10, p50, p90 = sorted([pred_p10, pred_p50, pred_p90])

        rows.append(
            {
                "horizon_week": h,
                "target_date": target_date,
                "log_ret_p10": float(round(np.log(p10 / origin_price), 6)),
                "log_ret_p50": float(round(np.log(p50 / origin_price), 6)),
                "log_ret_p90": float(round(np.log(p90 / origin_price), 6)),
                "pred_p10": p10,
                "pred_p50": p50,
                "pred_p90": p90,
                "baseline_name": "FUTURES_IMPLIED_BASELINE",
            }
        )

    return pd.DataFrame(rows)
