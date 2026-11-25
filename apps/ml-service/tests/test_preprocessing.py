import pytest
from datetime import date, timedelta
import numpy as np
import pandas as pd
from pydantic import ValidationError

from app.schemas import (
    DailyMarketDataPoint,
    MonthlyClimateDataPoint,
    ForecastRequest,
    HorizonPrediction,
)
from app.preprocessing import (
    resample_daily_to_weekly,
    merge_macro_climate_causally,
    build_causal_features,
    build_multistep_targets,
    assert_zero_feature_leakage,
)


class TestSchemasValidation:
    """Tests Pydantic v2 strict schemas and anti-hallucination validation rules."""

    def test_pydantic_rejects_nan_and_inf(self):
        # 1. NaN in price rejected
        with pytest.raises(ValidationError):
            DailyMarketDataPoint(date=date(2024, 1, 1), price_daklak=float("nan"))

        # 2. Inf in price rejected
        with pytest.raises(ValidationError):
            DailyMarketDataPoint(date=date(2024, 1, 1), price_daklak=float("inf"))

        # 3. NaN in climate indicator rejected
        with pytest.raises(ValidationError):
            MonthlyClimateDataPoint(month_date=date(2024, 1, 1), oni=float("nan"))

        # 4. Inf in forecast quantile rejected
        with pytest.raises(ValidationError):
            HorizonPrediction(
                horizon_week=1,
                target_date=date(2024, 1, 5),
                pred_p10=50000.0,
                pred_p50=float("inf"),
                pred_p90=60000.0,
            )

    def test_pydantic_enforces_quantile_monotonicity(self):
        # Monotonicity: pred_p10 <= pred_p50 <= pred_p90

        # Crossing 1: p10 > p50
        with pytest.raises(ValidationError, match="Quantile monotonicity violated"):
            HorizonPrediction(
                horizon_week=1,
                target_date=date(2024, 1, 5),
                pred_p10=58000.0,
                pred_p50=55000.0,
                pred_p90=60000.0,
            )

        # Crossing 2: p50 > p90
        with pytest.raises(ValidationError, match="Quantile monotonicity violated"):
            HorizonPrediction(
                horizon_week=2,
                target_date=date(2024, 1, 12),
                pred_p10=50000.0,
                pred_p50=65000.0,
                pred_p90=60000.0,
            )

        # Valid monotonic prediction
        valid = HorizonPrediction(
            horizon_week=3,
            target_date=date(2024, 1, 19),
            pred_p10=50000.0,
            pred_p50=55000.0,
            pred_p90=60000.0,
        )
        assert valid.pred_p10 <= valid.pred_p50 <= valid.pred_p90

    def test_forecast_request_rejects_insufficient_history(self):
        # Only 50 daily observations (~7 weeks < 156 weeks)
        short_data = [
            DailyMarketDataPoint(date=date(2024, 1, 1) + timedelta(days=i), price_daklak=70000.0)
            for i in range(160)
        ]
        with pytest.raises(ValidationError, match="Insufficient historical data duration"):
            ForecastRequest(
                run_date=date(2024, 6, 9),
                market_prices=short_data,
            )


class TestPreprocessingPipeline:
    """Tests temporal consistency, causal lag, and zero leakage in feature engineering."""

    def test_resample_daily_to_weekly_w_fri(self, synthetic_daily_prices):
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)

        assert isinstance(df_weekly.index, pd.DatetimeIndex)
        assert len(df_weekly) >= 156

        # Every resampled index must be a Friday (weekday 4)
        for ts in df_weekly.index:
            assert ts.weekday() == 4, f"Resampled date {ts} is not a Friday!"

        # Price column present and strictly positive
        assert "price_daklak" in df_weekly.columns
        assert (df_weekly["price_daklak"] > 0).all()

    def test_climate_causal_publication_lag(self):
        # Verify climate for month M (e.g., 2024-01) is strictly NOT available in January 2024 Fridays
        fridays = pd.date_range("2024-01-01", "2024-03-31", freq="W-FRI")
        df_weekly = pd.DataFrame({"price_daklak": 70000.0}, index=fridays)

        climate = [
            MonthlyClimateDataPoint(month_date=date(2024, 1, 1), oni=1.5, rainfall_anomaly_daklak=25.0),
            MonthlyClimateDataPoint(month_date=date(2024, 2, 1), oni=1.8, rainfall_anomaly_daklak=30.0),
        ]

        merged = merge_macro_climate_causally(df_weekly, climate)

        # During January 2024 (e.g., 2024-01-05, 2024-01-12, 2024-01-19, 2024-01-26),
        # 2024-01 climate has NOT been published yet (available_date is 2024-02-01).
        # Thus oni must be 0.0 (or pre-2024 value)
        jan_fridays = merged.loc["2024-01-01":"2024-01-31"]
        assert (jan_fridays["oni"] == 0.0).all(), "Future month climate leaked into current month!"

        # On the first Friday of February 2024 (2024-02-02 >= 2024-02-01),
        # the January climate indicator becomes available!
        feb_fridays = merged.loc["2024-02-02":"2024-02-29"]
        assert (feb_fridays["oni"] == 1.5).all(), "January climate should be visible starting February 1st!"

    def test_leakage_canary_test(self, synthetic_daily_prices, synthetic_monthly_climate):
        # Convert daily fixtures to raw DataFrame
        records = [p.model_dump() for p in synthetic_daily_prices]
        df_raw = pd.DataFrame(records)

        # Assert that altering the last 10 weeks of daily prices causes ZERO change
        # in any feature computed prior to the cutoff!
        passed = assert_zero_feature_leakage(df_raw, synthetic_monthly_climate, cutoff_weeks_back=10)
        assert passed is True

    def test_multistep_targets_alignment(self, synthetic_daily_prices):
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)
        df_features = build_causal_features(df_weekly)
        df_targets = build_multistep_targets(df_features, max_h=26)

        # Check target columns created for all h = 1..26
        for h in range(1, 27):
            assert f"target_log_ret_{h}w" in df_targets.columns
            assert f"target_price_{h}w" in df_targets.columns

        # Verify mathematical identity for an intermediate row:
        # target_log_ret_4w = ln(price_{t+4}) - ln(price_t)
        sample_idx = 100
        p_t = df_targets["price_daklak"].iloc[sample_idx]
        p_t4 = df_targets["price_daklak"].iloc[sample_idx + 4]
        expected_log_ret = np.log(p_t4) - np.log(p_t)
        actual_log_ret = df_targets["target_log_ret_4w"].iloc[sample_idx]

        assert np.isclose(expected_log_ret, actual_log_ret, atol=1e-8)
        assert np.isclose(p_t4, df_targets["target_price_4w"].iloc[sample_idx], atol=1e-8)
