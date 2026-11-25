import pytest
import time
from datetime import date
import pandas as pd

from app.preprocessing import (
    resample_daily_to_weekly,
    merge_macro_climate_causally,
    build_causal_features,
)
from app.ensemble import evaluate_walk_forward_cv, generate_ensemble_forecast
from app.schemas import ForecastResponse


class TestEnsembleSuite:
    """Tests Expanding-Window Walk-Forward Cross Validation & Ensemble Blending."""

    def test_walk_forward_cv_evaluation(self, synthetic_daily_prices, synthetic_monthly_climate):
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)
        df_merged = merge_macro_climate_causally(df_weekly, synthetic_monthly_climate)
        df_features = build_causal_features(df_merged)

        weights, metrics = evaluate_walk_forward_cv(
            df_features, n_origins=12, step_weeks=4, horizon_weeks=26
        )

        # 1. Weights per horizon bucket
        assert "short" in weights and "mid" in weights and "long" in weights
        for b, w in weights.items():
            assert 0.20 <= w <= 0.80, f"Bucket weight for {b} ({w}) outside bounds [0.20, 0.80]"

        # 2. Walk-Forward Audit Metrics
        assert "wf_mape_4w" in metrics and metrics["wf_mape_4w"] > 0
        assert "wf_mape_12w" in metrics and metrics["wf_mape_12w"] > 0
        assert "wf_mape_26w" in metrics and metrics["wf_mape_26w"] > 0
        assert "pinball_loss" in metrics and metrics["pinball_loss"] > 0
        assert isinstance(metrics["beats_naive_baseline"], bool)

    def test_generate_ensemble_forecast_end_to_end(
        self, synthetic_daily_prices, synthetic_monthly_climate
    ):
        df_weekly = resample_daily_to_weekly(synthetic_daily_prices)
        df_merged = merge_macro_climate_causally(df_weekly, synthetic_monthly_climate)
        df_features = build_causal_features(df_merged)

        origin_date = df_features.index[-1].date()
        t0 = time.perf_counter()

        response: ForecastResponse = generate_ensemble_forecast(
            df_features, origin_date=origin_date, horizon_weeks=26, run_cv=True
        )
        elapsed_sec = time.perf_counter() - t0

        # 1. Top-level response structure
        assert isinstance(response, ForecastResponse)
        assert response.run_id is not None
        assert response.run_date == origin_date
        assert response.origin_price_daklak > 0
        assert len(response.predictions) == 26

        # 2. Strict per-horizon validation
        for pred in response.predictions:
            assert 1 <= pred.horizon_week <= 26
            assert pred.pred_p10 <= pred.pred_p50 <= pred.pred_p90, (
                f"Quantile crossing at week {pred.horizon_week}: "
                f"P10 ({pred.pred_p10}) <= P50 ({pred.pred_p50}) <= P90 ({pred.pred_p90})"
            )
            assert pred.baseline_naive is not None and pred.baseline_naive > 0
            assert pred.baseline_futures is not None and pred.baseline_futures > 0

        # 3. Honest metrics exposed
        assert response.metrics is not None
        assert response.metrics.wf_mape_4w is not None
        assert response.metrics.wf_mape_12w is not None
        assert response.metrics.wf_mape_26w is not None

        # 4. Latency benchmark: must complete in < 60s
        assert elapsed_sec < 60.0, f"Ensemble latency too slow: {elapsed_sec:.2f}s >= 60.0s"
