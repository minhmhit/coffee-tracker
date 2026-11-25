from __future__ import annotations

import math
from datetime import date
from typing import List, Optional, Union
import numpy as np
import pandas as pd

from app.schemas import DailyMarketDataPoint, MonthlyClimateDataPoint

MIN_HISTORICAL_WEEKS = 156  # ~3 years mandatory statistical minimum


def resample_daily_to_weekly(
    market_data: Union[List[DailyMarketDataPoint], pd.DataFrame],
    min_weeks: int = MIN_HISTORICAL_WEEKS,
) -> pd.DataFrame:
    """
    Resamples daily market records to weekly frequency (Friday close: 'W-FRI')
    using bounded forward-fill (max 5 days) to preserve temporal integrity across holidays.
    """
    if isinstance(market_data, list):
        if not market_data:
            raise ValueError("Input market data list is empty")
        records = [p.model_dump() for p in market_data]
        df = pd.DataFrame(records)
    else:
        df = market_data.copy()

    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").set_index("date")
    elif not isinstance(df.index, pd.DatetimeIndex):
        raise ValueError("DataFrame must contain a 'date' column or a DatetimeIndex")

    # Bounded forward-fill up to 5 days for weekend/holiday gaps
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].ffill(limit=5)

    # Resample to Friday closes
    df_weekly = df.resample("W-FRI").last()

    # Drop any weeks before the first valid benchmark price
    df_weekly = df_weekly.dropna(subset=["price_daklak"])

    if len(df_weekly) < min_weeks:
        raise ValueError(
            f"Insufficient weekly history: resampled series contains {len(df_weekly)} weeks, "
            f"minimum required is {min_weeks} weeks (~3 years)."
        )

    return df_weekly


def merge_macro_climate_causally(
    df_weekly: pd.DataFrame,
    climate_data: Union[List[MonthlyClimateDataPoint], pd.DataFrame],
) -> pd.DataFrame:
    """
    Causally merges monthly macro climate indicators into the weekly time-series.
    Enforces publication lag: Climate indicator for month M (e.g., 2024-01-01)
    is only finalized and available after month M ends (available_date = 2024-02-01).
    Weekly Friday observations t only see climate records where available_date <= t.
    """
    df_out = df_weekly.copy()

    if isinstance(climate_data, list):
        if not climate_data:
            # Fallback zero columns if no climate data provided
            for col in ["oni", "rainfall_anomaly_daklak", "rainfall_anomaly_linhares"]:
                df_out[col] = 0.0
            return df_out
        records = [c.model_dump() for c in climate_data]
        df_c = pd.DataFrame(records)
    else:
        df_c = climate_data.copy()

    if df_c.empty:
        for col in ["oni", "rainfall_anomaly_daklak", "rainfall_anomaly_linhares"]:
            df_out[col] = 0.0
        return df_out

    df_c["month_date"] = pd.to_datetime(df_c["month_date"])
    # Causal publication lag: month M climate is available on the 1st of month M+1
    df_c["available_date"] = (df_c["month_date"] + pd.DateOffset(months=1)).astype("datetime64[ns]")
    df_c = df_c.sort_values("available_date")

    # Reset index for asof merge
    weekly_reset = df_out.reset_index()
    date_col = "date" if "date" in weekly_reset.columns else weekly_reset.columns[0]
    weekly_reset[date_col] = pd.to_datetime(weekly_reset[date_col]).astype("datetime64[ns]")

    # Backward asof merge guarantees no future month leakage
    merged = pd.merge_asof(
        weekly_reset,
        df_c[["available_date", "oni", "rainfall_anomaly_daklak", "rainfall_anomaly_linhares"]],
        left_on=date_col,
        right_on="available_date",
        direction="backward",
    )

    merged = merged.set_index(date_col)
    if "available_date" in merged.columns:
        merged = merged.drop(columns=["available_date"])

    # Forward fill climate series up to current week
    climate_cols = ["oni", "rainfall_anomaly_daklak", "rainfall_anomaly_linhares"]
    for c in climate_cols:
        if c in merged.columns:
            merged[c] = merged[c].ffill().fillna(0.0)

    return merged


def build_causal_features(df_weekly: pd.DataFrame) -> pd.DataFrame:
    """
    Builds causal feature engineering matrix at forecast origin t.
    Zero-leakage guarantee: Every feature row t depends strictly on observations <= t.
    """
    df = df_weekly.copy()
    y = df["price_daklak"]
    log_y = np.log(y)

    # 1. Multi-scale log returns: 1w, 4w, 12w, 26w, 52w
    df["log_ret_1w"] = log_y.diff(1)
    df["log_ret_4w"] = log_y.diff(4)
    df["log_ret_12w"] = log_y.diff(12)
    df["log_ret_26w"] = log_y.diff(26)
    df["log_ret_52w"] = log_y.diff(52)

    # 2. Rolling realized volatility of 1w returns: 4w, 12w, 26w
    df["vol_4w"] = df["log_ret_1w"].rolling(window=4, min_periods=2).std()
    df["vol_12w"] = df["log_ret_1w"].rolling(window=12, min_periods=4).std()
    df["vol_26w"] = df["log_ret_1w"].rolling(window=26, min_periods=8).std()

    # 3. Market Microstructure & Valuation Spreads
    # Basis = DakLak - (London_M1 / 1000 * USD_VND)
    if "london_m1" in df.columns and "usd_vnd" in df.columns:
        df["basis_vnd_kg"] = df["price_daklak"] - (df["london_m1"] / 1000.0 * df["usd_vnd"])
    else:
        df["basis_vnd_kg"] = 0.0

    # Calendar Spread = London_M1 - London_M6
    if "london_m1" in df.columns and "london_m6" in df.columns:
        df["calendar_spread"] = df["london_m1"] - df["london_m6"]
    else:
        df["calendar_spread"] = 0.0

    # Brent Crude Oil log return (energy cost driver)
    if "brent_oil" in df.columns:
        df["brent_log_ret_4w"] = np.log(df["brent_oil"]).diff(4).fillna(0.0)
    else:
        df["brent_log_ret_4w"] = 0.0

    # 4. Cyclical Calendar Seasonality (Harmonic sin/cos encoding)
    months = df.index.month
    df["sin_month"] = np.sin(2.0 * np.pi * months / 12.0)
    df["cos_month"] = np.cos(2.0 * np.pi * months / 12.0)

    # 5. Climate Macro Lags (12-week and 26-week lag for ENSO/rainfall propagation)
    for col in ["oni", "rainfall_anomaly_daklak", "rainfall_anomaly_linhares"]:
        if col in df.columns:
            df[f"{col}_lag_12w"] = df[col].shift(12).fillna(0.0)
            df[f"{col}_lag_26w"] = df[col].shift(26).fillna(0.0)
        else:
            df[f"{col}_lag_12w"] = 0.0
            df[f"{col}_lag_26w"] = 0.0

    return df


def build_multistep_targets(df_features: pd.DataFrame, max_h: int = 26) -> pd.DataFrame:
    """
    Constructs Direct Multi-Step targets for horizons h = 1..26:
    target_log_ret_h = ln(Y_{t+h}) - ln(Y_t)
    target_price_h = Y_{t+h}
    """
    df = df_features.copy()
    y = df["price_daklak"]
    log_y = np.log(y)

    for h in range(1, max_h + 1):
        df[f"target_log_ret_{h}w"] = log_y.shift(-h) - log_y
        df[f"target_price_{h}w"] = y.shift(-h)

    return df


def assert_zero_feature_leakage(
    df_raw: pd.DataFrame,
    climate_data: Union[List[MonthlyClimateDataPoint], pd.DataFrame],
    cutoff_weeks_back: int = 10,
) -> bool:
    """
    Leakage Canary Assertion: Modifies trailing daily market prices starting at a cutoff date
    and asserts that 100% of feature values for all weekly dates prior to that cutoff
    remain bit-for-bit identical.
    """
    # 1. Base pipeline on original data
    weekly_base = resample_daily_to_weekly(df_raw)
    merged_base = merge_macro_climate_causally(weekly_base, climate_data)
    features_base = build_causal_features(merged_base)

    # 2. Identify the cutoff date in weekly index
    cutoff_date = weekly_base.index[-cutoff_weeks_back]

    # 3. Mutate daily prices on or after cutoff_date
    df_mutated = df_raw.copy()
    mask = pd.to_datetime(df_mutated["date"]) >= cutoff_date
    df_mutated.loc[mask, "price_daklak"] = df_mutated.loc[mask, "price_daklak"] * 1.50

    weekly_mut = resample_daily_to_weekly(df_mutated)
    merged_mut = merge_macro_climate_causally(weekly_mut, climate_data)
    features_mut = build_causal_features(merged_mut)

    # Check safe slice strictly before the cutoff week (index < cutoff_date)
    safe_base = features_base.loc[features_base.index < cutoff_date]
    safe_mut = features_mut.loc[features_mut.index < cutoff_date]

    feature_cols = [
        c
        for c in features_base.columns
        if c.startswith(("log_ret", "vol", "basis", "calendar", "brent", "sin", "cos", "oni", "rainfall"))
    ]

    for col in feature_cols:
        diff = np.abs(safe_base[col].to_numpy() - safe_mut[col].to_numpy())
        max_diff = np.nanmax(diff)
        if not math.isnan(max_diff) and max_diff > 1e-9:
            raise AssertionError(f"Leakage detected in feature '{col}': max absolute difference = {max_diff}")

    return True
