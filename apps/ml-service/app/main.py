from __future__ import annotations

import logging
from fastapi import FastAPI, HTTPException, status
from app.schemas import ForecastRequest, ForecastResponse
from app.preprocessing import (
    resample_daily_to_weekly,
    merge_macro_climate_causally,
    build_causal_features,
    build_multistep_targets,
)

logger = logging.getLogger("coffee_tracker_ml")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Coffee Tracker ML Service",
    description="Stateless probabilistic forecasting engine for Central Highlands coffee prices",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "coffee-tracker-ml"}


@app.post(
    "/api/v1/forecast/weekly",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    summary="Generate 26-week probabilistic forecast (Step 3.1 Contract & Feature Pipeline)",
)
def forecast_weekly(request: ForecastRequest):
    """
    Contract endpoint for 26-week probabilistic forecasting.
    Validates Pydantic v2 schemas and executes zero-leakage causal feature pipeline.
    Full forecasting ensemble models (VECM & LightGBM Quantile) are wired in Steps 3.2-3.4.
    """
    logger.info(f"Received forecast request for origin date {request.run_date} with {len(request.market_prices)} daily prices")

    # 1. Resample to weekly W-FRI with bounded ffill
    df_weekly = resample_daily_to_weekly(request.market_prices)

    # 2. Merge macro climate causally with 1-month publication lag
    df_merged = merge_macro_climate_causally(df_weekly, request.macro_climate)

    # 3. Construct causal feature engineering matrix
    df_features = build_causal_features(df_merged)

    # 4. Construct direct multi-step targets
    df_targets = build_multistep_targets(df_features, max_h=26)

    feature_cols = [
        c for c in df_targets.columns
        if not c.startswith("target_") and c != "price_daklak"
    ]

    # Return 501 until model fitting legs (Steps 3.2-3.4) are completed
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "message": "Weekly feature pipeline validated successfully. Model legs are implemented in Steps 3.2-3.4.",
            "run_date": str(request.run_date),
            "weekly_rows": len(df_weekly),
            "feature_count": len(feature_cols),
            "latest_friday": str(df_weekly.index[-1].date()),
            "benchmark_price": float(df_weekly["price_daklak"].iloc[-1]),
        },
    )
