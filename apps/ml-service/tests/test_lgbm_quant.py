import pytest
from datetime import date
import numpy as np
import pandas as pd

from app.preprocessing import (
    resample_daily_to_weekly,
    merge_macro_climate_causally,
    build_causal_features,
)
from app.models.lgbm_quant import (
    prepare_training_dataset,
    lgbm_quantile_forecast,
)


class TestLightGBMQuantileSuite:
    """Tests Nonlinear Leg (Direct Multi-Horizon LightGBM Quantile Regression)."""

    def test_cutoff_leakage_rule(self, synthetic_daily_prices, synthetic_monthly_climate):
        # 1. Preprocess feature matrix
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)
        df_merged = merge_macro_climate_causally(df_weekly, synthetic_monthly_climate)
        df_features = build_causal_features(df_merged)

        cutoff_date = df_features.index[-1]

        # 2. Extract training dataset and audit trail
        X_train, y_train, audit_trail = prepare_training_dataset(df_features, max_h=26)

        assert len(X_train) == len(y_train) == len(audit_trail)
        assert len(X_train) > 500  # sufficient samples pooled across horizons

        # 3. Cutoff Leakage Verification:
        # Assert that for EVERY training sample (origin, h, target_date):
        # target_date is strictly <= cutoff_date! ZERO future target leakage!
        for origin_dt, h, target_dt in audit_trail:
            assert target_dt <= cutoff_date, (
                f"LEAKAGE DETECTED: Sample origin={origin_dt}, h={h} has target_date={target_dt} "
                f"which is in the future beyond cutoff_date={cutoff_date}!"
            )
            # Mathematical consistency check: target_dt is h weeks ahead of origin_dt
            assert target_dt > origin_dt

    def test_lgbm_quantile_forecast_output_and_monotonicity(
        self, synthetic_daily_prices, synthetic_monthly_climate
    ):
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)
        df_merged = merge_macro_climate_causally(df_weekly, synthetic_monthly_climate)
        df_features = build_causal_features(df_merged)

        origin_date = df_features.index[-1].date()
        df_forecast, runtime_sec = lgbm_quantile_forecast(
            df_features, origin_date, horizon_weeks=26, random_state=42
        )

        # 1. Output dimensions
        assert len(df_forecast) == 26
        assert list(df_forecast["horizon_week"]) == list(range(1, 27))
        assert not df_forecast.isna().any().any()

        # 2. Strict Quantile Monotonicity across all 26 weeks
        for _, row in df_forecast.iterrows():
            assert row["pred_p10"] <= row["pred_p50"] <= row["pred_p90"], (
                f"Quantile crossing at week {row['horizon_week']}: "
                f"P10 ({row['pred_p10']}) <= P50 ({row['pred_p50']}) <= P90 ({row['pred_p90']})"
            )
            assert row["log_ret_p10"] <= row["log_ret_p50"] <= row["log_ret_p90"]
            assert 10000.0 <= row["pred_p10"] <= 500000.0
            assert 10000.0 <= row["pred_p90"] <= 500000.0

        # 3. Runtime benchmark: Must complete well under 15 seconds budget
        assert runtime_sec < 15.0, f"Runtime too slow: {runtime_sec:.2f}s >= 15.0s"
