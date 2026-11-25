from __future__ import annotations

import logging
from fastapi import FastAPI, HTTPException, status
from app.schemas import ForecastRequest, ForecastResponse
from app.preprocessing import (
    resample_daily_to_weekly,
    merge_macro_climate_causally,
    build_causal_features,
)
from app.ensemble import generate_ensemble_forecast

logger = logging.getLogger("coffee_tracker_ml")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Coffee Tracker ML Service",
    description="Stateless probabilistic forecasting engine for Central Highlands coffee prices",
    version="1.0.0",
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "coffee-tracker-ml"}


@app.post(
    "/api/v1/forecast/weekly",
    response_model=ForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate 26-week probabilistic forecast via Two-Legged Ensemble",
)
def forecast_weekly(request: ForecastRequest) -> ForecastResponse:
    """
    Production probabilistic 6-month (26-week) coffee price forecasting endpoint:
    1. Validates strict Pydantic v2 input schemas (rejects NaN/Inf, requires >= 156 weeks).
    2. Zero-leakage temporal resampling: Daily -> W-FRI with bounded ffill(limit=5).
    3. Causal macro climate merge with publication lag (Month M visible only at Month M+1).
    4. Causal feature engineering matrix at origin t_0.
    5. Expanding-Window Walk-Forward Cross Validation across 12 rolling origins to optimize blending weights.
    6. Refits Leg 1 (Econometric: VECM / Ridge VAR) and Leg 2 (Direct Multi-Horizon LightGBM Quantile).
    7. Blends quantiles with guaranteed monotonicity (P10 <= P50 <= P90) and attaches benchmark baselines (Naive, Futures).
    8. Returns validated ForecastResponse with out-of-sample audit metrics (MAPE at 4w, 12w, 26w, Pinball Loss).
    """
    try:
        logger.info(
            f"Executing forecast run for origin {request.run_date} with {len(request.market_prices)} daily prices "
            f"and {len(request.macro_climate)} climate observations"
        )

        # 1. Resample daily to weekly W-FRI
        df_weekly = resample_daily_to_weekly(request.market_prices)

        # 2. Merge macro climate causally
        df_merged = merge_macro_climate_causally(df_weekly, request.macro_climate)

        # 3. Construct causal feature engineering matrix
        df_features = build_causal_features(df_merged)

        # 4. Run Walk-Forward ensemble and generate final forecast response
        response = generate_ensemble_forecast(
            df_features=df_features,
            origin_date=request.run_date,
            horizon_weeks=26,
            run_cv=True,
        )

        return response

    except ValueError as val_err:
        logger.error(f"Validation error during forecast generation: {str(val_err)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )
    except Exception as e:
        logger.error(f"Unexpected error during forecast generation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting engine error: {str(e)}",
        )
