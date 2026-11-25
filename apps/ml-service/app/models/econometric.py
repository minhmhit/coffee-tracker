"""
Econometric Leg (Leg 1 of Ensemble):
Multivariate Time-Series Forecasting of [ln(DakLak), ln(LondonM1), ln(USD_VND), ln(Brent)]
1. Primary: statsmodels VECM (if Johansen cointegration rank >= 1)
2. Fallback: Ridge-regularized VAR on log-differences (Minnesota-style shrinkage) if VECM fails or explodes.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd
from scipy.linalg import pinv
from statsmodels.tsa.vector_ar.vecm import coint_johansen, VECM

logger = logging.getLogger("coffee_tracker_ml.econometric")

# System endogenous variables
ENDOG_VARS = ["price_daklak", "london_m1", "usd_vnd", "brent_oil"]


def _estimate_ridge_var(
    delta_log: np.ndarray,
    lags: int = 2,
    alpha: float = 1.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Fits a Ridge-regularized VAR(lags) model on log-differences:
    Y = X @ B + E
    B_ridge = (X.T @ X + alpha * I)^{-1} @ X.T @ Y
    """
    T, K = delta_log.shape
    if T <= lags + 2:
        raise ValueError(f"Insufficient time steps {T} for VAR lags {lags}")

    # Build design matrix X with constant and lagged values
    Y_target = delta_log[lags:]  # shape: (T - lags, K)
    N = len(Y_target)

    X_list = [np.ones((N, 1))]  # Intercept
    for p in range(1, lags + 1):
        X_list.append(delta_log[lags - p : T - p])

    X = np.hstack(X_list)  # shape: (N, 1 + lags * K)
    P_dim = X.shape[1]

    # Shrinkage: penalize lag coefficients, do not penalize intercept
    reg_matrix = np.eye(P_dim) * alpha
    reg_matrix[0, 0] = 0.0

    # Ridge estimation
    B = pinv(X.T @ X + reg_matrix) @ (X.T @ Y_target)
    residuals = Y_target - (X @ B)
    cov_residuals = (residuals.T @ residuals) / max(N - P_dim, 1)

    return B, residuals, cov_residuals


def _forecast_ridge_var(
    delta_log: np.ndarray,
    B: np.ndarray,
    lags: int = 2,
    steps: int = 26,
) -> np.ndarray:
    """
    Recursively forecasts delta log returns for steps h = 1..steps.
    Returns array of shape (steps, K).
    """
    K = delta_log.shape[1]
    history = list(delta_log[-lags:])  # list of length lags, each (K,)
    forecasts = []

    for _ in range(steps):
        x_vec = [1.0]
        for p in range(1, lags + 1):
            x_vec.extend(history[-p])
        x_arr = np.array(x_vec).reshape(1, -1)
        pred_delta = (x_arr @ B).flatten()

        # Damping guard: clip extreme single-week returns to +/- 15%
        pred_delta = np.clip(pred_delta, -0.15, 0.15)
        forecasts.append(pred_delta)
        history.append(pred_delta)

    return np.array(forecasts)


def econometric_forecast(
    df_weekly: pd.DataFrame,
    origin_date: date,
    horizon_weeks: int = 26,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    Fits multivariate econometric system and generates 26-week probabilistic forecast.
    Enforces Option A:
    - Runs Johansen cointegration test.
    - If rank >= 1 and stable: Uses VECM.
    - If rank == 0, fitting fails, or forecast explodes: Automatically falls back to Ridge VAR.
    """
    df = df_weekly.copy()

    # Verify and prepare 4 core endogenous series
    for col in ENDOG_VARS:
        if col not in df.columns or df[col].dropna().empty:
            if col == "usd_vnd":
                df[col] = 25400.0
            elif col == "brent_oil":
                df[col] = 80.0
            elif col == "london_m1":
                df[col] = df["price_daklak"] / 25.4
            else:
                raise ValueError(f"Mandatory benchmark column '{col}' missing from weekly data")

    # Select clean slice and take log levels
    data_clean = df[ENDOG_VARS].ffill().bfill()
    log_levels = np.log(data_clean.values)
    T, K = log_levels.shape

    origin_price = float(data_clean["price_daklak"].iloc[-1])
    origin_log = float(log_levels[-1, 0])

    model_type = "RIDGE_VAR"
    coint_rank = 0
    forecast_log_levels = None
    residuals_daklak = None

    # -----------------------------------------------------------------------
    # 1. Attempt VECM (if Johansen rank >= 1)
    # -----------------------------------------------------------------------
    try:
        # Johansen test: det_order = 0 (constant outside cointegration relation)
        johansen_res = coint_johansen(log_levels, det_order=0, k_ar_diff=1)
        # Check trace test at 90% confidence level (index 0)
        trace_stats = johansen_res.lr1
        crit_vals = johansen_res.cvt[:, 0]  # 90% crit values

        rank = int(np.sum(trace_stats > crit_vals))
        coint_rank = min(rank, K - 1)

        if coint_rank >= 1:
            vecm_model = VECM(
                log_levels,
                k_ar_diff=1,
                coint_rank=coint_rank,
                deterministic="co",
            )
            vecm_fitted = vecm_model.fit()
            vecm_pred = vecm_fitted.predict(steps=horizon_weeks)

            # Numerical stability guard: log price should not deviate more than +/- 1.2 (~3.3x)
            pred_daklak_log = vecm_pred[:, 0]
            max_dev = np.max(np.abs(pred_daklak_log - origin_log))

            if not np.any(np.isnan(vecm_pred)) and max_dev < 1.2:
                forecast_log_levels = pred_daklak_log
                model_type = f"VECM(rank={coint_rank})"
                residuals_daklak = vecm_fitted.resid[:, 0]
                logger.info(f"VECM successfully fitted with cointegration rank {coint_rank}")
            else:
                logger.warning(f"VECM predictions unstable (max log deviation {max_dev:.2f}). Triggering Ridge VAR fallback.")
    except Exception as e:
        logger.warning(f"Johansen / VECM fitting encountered error: {str(e)}. Triggering Ridge VAR fallback.")

    # -----------------------------------------------------------------------
    # 2. Fallback to Ridge-regularized VAR on log-differences
    # -----------------------------------------------------------------------
    if forecast_log_levels is None:
        model_type = "RIDGE_VAR(alpha=1.0)"
        delta_log = np.diff(log_levels, axis=0)

        # Estimate Ridge VAR(2) on log differences
        B_ridge, resid_var, _ = _estimate_ridge_var(delta_log, lags=2, alpha=1.0)
        pred_deltas = _forecast_ridge_var(delta_log, B_ridge, lags=2, steps=horizon_weeks)

        # Accumulate log returns back to log price levels
        cum_delta_daklak = np.cumsum(pred_deltas[:, 0])
        forecast_log_levels = origin_log + cum_delta_daklak
        residuals_daklak = resid_var[:, 0]
        logger.info("Ridge-regularized VAR fitted successfully as robust econometric fallback.")

    # -----------------------------------------------------------------------
    # 3. Construct Probabilistic Quantiles (P10, P50, P90)
    # -----------------------------------------------------------------------
    in_sample_std = float(np.std(residuals_daklak)) if residuals_daklak is not None and len(residuals_daklak) > 1 else 0.025
    in_sample_std = max(in_sample_std, 0.015)  # minimum 1.5% weekly vol floor
    z_80 = 1.28155

    rows = []
    for h in range(1, horizon_weeks + 1):
        target_date = origin_date + timedelta(weeks=h)
        pred_log = float(forecast_log_levels[h - 1])
        log_ret_h = pred_log - origin_log

        # Analytical multi-step uncertainty expansion: sigma_h = sigma * sqrt(h)
        sigma_h = in_sample_std * np.sqrt(h)

        p50 = float(round(origin_price * np.exp(log_ret_h), 2))
        p10 = float(round(origin_price * np.exp(log_ret_h - z_80 * sigma_h), 2))
        p90 = float(round(origin_price * np.exp(log_ret_h + z_80 * sigma_h), 2))

        # Absolute monotonicity and plausibility bounds
        p10, p50, p90 = sorted([p10, p50, p90])
        p10 = max(p10, 10000.0)  # non-negative realistic floor

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
                "model_type": model_type,
                "coint_rank": coint_rank,
            }
        )

    return pd.DataFrame(rows)
