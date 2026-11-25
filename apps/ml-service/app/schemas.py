from __future__ import annotations

import math
from datetime import date
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictBaseModel(BaseModel):
    """Base model enforcing zero NaN / Infinity on inputs and outputs."""

    model_config = ConfigDict(
        extra="forbid",
        validate_assignment=True,
    )

    @model_validator(mode="after")
    def reject_nan_and_inf(self) -> StrictBaseModel:
        for field_name, value in self.__dict__.items():
            if isinstance(value, float):
                if math.isnan(value) or math.isinf(value):
                    raise ValueError(f"Field '{field_name}' contains illegal NaN or Inf value: {value}")
        return self


# ---------------------------------------------------------------------------
# Input Schemas
# ---------------------------------------------------------------------------

class DailyMarketDataPoint(StrictBaseModel):
    date: date
    price_daklak: float = Field(gt=0, description="Đắk Lắk benchmark price in VNĐ/kg (> 0)")
    price_lamdong: Optional[float] = Field(default=None, gt=0)
    price_gialai: Optional[float] = Field(default=None, gt=0)
    price_daknong: Optional[float] = Field(default=None, gt=0)
    price_avg: Optional[float] = Field(default=None, gt=0)
    london_m1: Optional[float] = Field(default=None, gt=0, description="ICE London M1 in USD/ton")
    london_m3: Optional[float] = Field(default=None, gt=0, description="ICE London M3 in USD/ton")
    london_m6: Optional[float] = Field(default=None, gt=0, description="ICE London M6 in USD/ton")
    usd_vnd: Optional[float] = Field(default=None, gt=0, description="Commercial exchange rate VNĐ/USD")
    brent_oil: Optional[float] = Field(default=None, gt=0, description="Brent crude oil in USD/barrel")


class MonthlyClimateDataPoint(StrictBaseModel):
    month_date: date = Field(description="First day of month (YYYY-MM-01)")
    oni: Optional[float] = Field(default=None, description="NOAA Oceanic Niño Index anomaly in °C")
    rainfall_anomaly_daklak: Optional[float] = Field(
        default=None, description="Rainfall anomaly in Đắk Lắk relative to 2010-2020 baseline (mm)"
    )
    rainfall_anomaly_linhares: Optional[float] = Field(
        default=None, description="Rainfall anomaly in Linhares Brazil (mm)"
    )


class ForecastRequest(StrictBaseModel):
    run_date: date = Field(description="Forecast origin date t (YYYY-MM-DD)")
    market_prices: List[DailyMarketDataPoint] = Field(
        min_length=156, description="Daily historical price series (min >= 156 points, >= 156 weekly periods)"
    )
    macro_climate: List[MonthlyClimateDataPoint] = Field(
        default_factory=list, description="Monthly climate historical series"
    )

    @model_validator(mode="after")
    def validate_historical_duration(self) -> ForecastRequest:
        if not self.market_prices:
            raise ValueError("market_prices list cannot be empty")

        dates = sorted({p.date for p in self.market_prices})
        if len(dates) < 2:
            raise ValueError("market_prices must span multiple dates")

        earliest = dates[0]
        latest = dates[-1]
        days_span = (latest - earliest).days
        weeks_span = days_span / 7.0

        # Minimum 156 weeks (approx 3 years) required for valid time-series ML training
        if weeks_span < 156.0:
            raise ValueError(
                f"Insufficient historical data duration: dataset spans {weeks_span:.1f} weeks "
                f"({earliest} to {latest}). Minimum required is 156.0 weeks (3 years)."
            )

        if self.run_date < latest:
            raise ValueError(
                f"run_date ({self.run_date}) cannot be earlier than the latest available market price ({latest})."
            )

        return self


# ---------------------------------------------------------------------------
# Output Schemas
# ---------------------------------------------------------------------------

class HorizonPrediction(StrictBaseModel):
    horizon_week: int = Field(ge=1, le=26, description="Forecast step h in weeks ahead (1 to 26)")
    target_date: date = Field(description="Friday target date of the forecasted week")
    pred_p10: float = Field(gt=0, description="10th percentile forecast price in VNĐ/kg")
    pred_p50: float = Field(gt=0, description="50th percentile (median) forecast price in VNĐ/kg")
    pred_p90: float = Field(gt=0, description="90th percentile forecast price in VNĐ/kg")
    baseline_naive: Optional[float] = Field(default=None, gt=0, description="Naive Random Walk baseline price")
    baseline_futures: Optional[float] = Field(default=None, gt=0, description="Futures-implied baseline price")

    @model_validator(mode="after")
    def validate_monotonic_quantiles(self) -> HorizonPrediction:
        if not (self.pred_p10 <= self.pred_p50 <= self.pred_p90):
            raise ValueError(
                f"Quantile monotonicity violated at horizon h={self.horizon_week}: "
                f"pred_p10 ({self.pred_p10}) <= pred_p50 ({self.pred_p50}) <= pred_p90 ({self.pred_p90}) is False"
            )
        return self


class ForecastMetrics(StrictBaseModel):
    wf_mape_4w: Optional[float] = Field(default=None, ge=0, description="Walk-Forward MAPE at 4 weeks (%)")
    wf_mape_12w: Optional[float] = Field(default=None, ge=0, description="Walk-Forward MAPE at 12 weeks (%)")
    wf_mape_26w: Optional[float] = Field(default=None, ge=0, description="Walk-Forward MAPE at 26 weeks (%)")
    pinball_loss: Optional[float] = Field(default=None, ge=0, description="Average Pinball Loss across quantiles")
    beats_naive_baseline: bool = Field(
        default=False, description="True if Walk-Forward MAPE beats Naive Random Walk at 26w"
    )


class ForecastResponse(StrictBaseModel):
    run_id: Optional[str] = Field(default=None, description="UUID identifier assigned to this forecast run")
    run_date: date = Field(description="Forecast origin date t")
    origin_price_daklak: float = Field(gt=0, description="Observed benchmark price at origin date t (VNĐ/kg)")
    predictions: List[HorizonPrediction] = Field(
        min_length=26, max_length=26, description="Exactly 26 horizon predictions (h=1..26)"
    )
    metrics: Optional[ForecastMetrics] = Field(default=None, description="Out-of-sample Walk-Forward audit metrics")
