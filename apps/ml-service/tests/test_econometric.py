import pytest
from datetime import date
import numpy as np
import pandas as pd

from app.preprocessing import resample_daily_to_weekly
from app.models.baselines import naive_random_walk, futures_implied_baseline
from app.models.econometric import econometric_forecast


class TestBaselinesSuite:
    """Tests Naive Random Walk and Futures-Implied Baseline."""

    def test_naive_random_walk_structure_and_monotonicity(self):
        origin_price = 72000.0
        origin_date = date(2024, 6, 7)

        df_naive = naive_random_walk(origin_price, origin_date, horizon_weeks=26)

        assert len(df_naive) == 26
        assert list(df_naive["horizon_week"]) == list(range(1, 27))

        # Check zero NaN or Inf
        assert not df_naive.isna().any().any()
        assert np.isfinite(df_naive["pred_p50"]).all()

        # Constant median equals origin price
        assert (df_naive["pred_p50"] == origin_price).all()

        # Strict quantile monotonicity across all 26 weeks
        for _, row in df_naive.iterrows():
            assert row["pred_p10"] <= row["pred_p50"] <= row["pred_p90"], (
                f"Monotonicity violated at week {row['horizon_week']}: "
                f"{row['pred_p10']} <= {row['pred_p50']} <= {row['pred_p90']}"
            )
            assert row["pred_p10"] > 0

    def test_futures_implied_baseline_with_full_and_missing_curve(self, synthetic_daily_prices):
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)
        origin_date = df_weekly.index[-1].date()

        # Case 1: Full curve (M1, M3, M6 present)
        df_futures = futures_implied_baseline(df_weekly, origin_date, horizon_weeks=26)

        assert len(df_futures) == 26
        assert not df_futures.isna().any().any()
        for _, row in df_futures.iterrows():
            assert row["pred_p10"] <= row["pred_p50"] <= row["pred_p90"]
            assert row["pred_p10"] > 10000.0  # plausible coffee price floor

        # Case 2: Missing M3 and M6 -> graceful fallback without NaN
        df_missing = df_weekly.copy()
        df_missing["london_m3"] = np.nan
        df_missing["london_m6"] = np.nan

        df_fallback = futures_implied_baseline(df_missing, origin_date, horizon_weeks=26)
        assert len(df_fallback) == 26
        assert not df_fallback.isna().any().any()
        for _, row in df_fallback.iterrows():
            assert row["pred_p10"] <= row["pred_p50"] <= row["pred_p90"]


class TestEconometricLegSuite:
    """Tests VECM and Ridge-regularized VAR econometric forecasting engine."""

    def test_econometric_forecast_full_cycle(self, synthetic_daily_prices):
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)
        origin_date = df_weekly.index[-1].date()

        df_econ = econometric_forecast(df_weekly, origin_date, horizon_weeks=26)

        # 1. Output dimensions and columns
        assert len(df_econ) == 26
        assert list(df_econ["horizon_week"]) == list(range(1, 27))
        assert not df_econ.isna().any().any()

        # 2. Strict monotonicity
        for _, row in df_econ.iterrows():
            assert row["pred_p10"] <= row["pred_p50"] <= row["pred_p90"]
            assert row["pred_p10"] > 0
            assert row["log_ret_p10"] <= row["log_ret_p50"] <= row["log_ret_p90"]

        # 3. Model type is verified
        model_type = df_econ["model_type"].iloc[0]
        assert "VECM" in model_type or "RIDGE_VAR" in model_type

    def test_econometric_explosive_series_triggers_ridge_fallback(self):
        # Create an artificial explosive series that would fail cointegration stability
        n_weeks = 160
        dates = pd.date_range("2021-01-01", periods=n_weeks, freq="W-FRI")

        np.random.seed(99)
        # Random non-cointegrated walk with drift
        daklak = np.exp(np.linspace(10.5, 11.5, n_weeks) + np.random.normal(0, 0.05, n_weeks))
        london = np.exp(np.linspace(7.2, 7.8, n_weeks) + np.random.normal(0, 0.08, n_weeks))
        usd_vnd = np.linspace(23000, 25500, n_weeks)
        brent = np.linspace(60, 95, n_weeks)

        df_explosive = pd.DataFrame(
            {
                "price_daklak": daklak,
                "london_m1": london,
                "usd_vnd": usd_vnd,
                "brent_oil": brent,
            },
            index=dates,
        )

        origin_date = dates[-1].date()
        df_res = econometric_forecast(df_explosive, origin_date, horizon_weeks=26)

        # Must execute cleanly, zero NaN, bounded values
        assert len(df_res) == 26
        assert not df_res.isna().any().any()
        for _, row in df_res.iterrows():
            assert row["pred_p10"] <= row["pred_p50"] <= row["pred_p90"]
            # Maximum 26w price cannot exceed 500,000 VND/kg
            assert row["pred_p90"] < 500000.0
