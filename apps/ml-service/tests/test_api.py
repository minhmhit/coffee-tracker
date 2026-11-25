import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_forecast_endpoint_insufficient_history():
    # Only 9 points (< 156 weeks)
    payload = {
        "run_date": "2024-06-01",
        "market_prices": [
            {"date": f"2024-01-0{i+1}", "price_daklak": 70000.0} for i in range(9)
        ],
        "macro_climate": [],
    }
    response = client.post("/api/v1/forecast/weekly", json=payload)
    # Pydantic v2 rejects < 156 points with HTTP 422
    assert response.status_code == 422


def test_forecast_endpoint_rejects_nan():
    payload = {
        "run_date": "2024-06-01",
        "market_prices": [
            {"date": "2024-01-01", "price_daklak": None}
        ],
        "macro_climate": [],
    }
    response = client.post("/api/v1/forecast/weekly", json=payload)
    assert response.status_code == 422


def test_forecast_endpoint_end_to_end_success(synthetic_daily_prices, synthetic_monthly_climate):
    payload = {
        "run_date": str(synthetic_daily_prices[-1].date),
        "market_prices": [p.model_dump(mode="json") for p in synthetic_daily_prices],
        "macro_climate": [c.model_dump(mode="json") for c in synthetic_monthly_climate],
    }

    response = client.post("/api/v1/forecast/weekly", json=payload)

    # In Step 3.4, endpoint returns HTTP 200 with full 26-week ensemble forecast
    assert response.status_code == 200
    data = response.json()

    # 1. Top-level contract verification
    assert data["run_id"] is not None
    assert data["run_date"] == str(synthetic_daily_prices[-1].date)
    assert data["origin_price_daklak"] > 0
    assert len(data["predictions"]) == 26

    # 2. Per-horizon predictions verification
    preds = data["predictions"]
    for i, p in enumerate(preds):
        assert p["horizon_week"] == i + 1
        assert p["pred_p10"] <= p["pred_p50"] <= p["pred_p90"], (
            f"Monotonicity violated at week {p['horizon_week']}: "
            f"{p['pred_p10']} <= {p['pred_p50']} <= {p['pred_p90']}"
        )
        assert p["baseline_naive"] is not None and p["baseline_naive"] > 0
        assert p["baseline_futures"] is not None and p["baseline_futures"] > 0

    # 3. Metrics verification
    metrics = data["metrics"]
    assert metrics is not None
    assert metrics["wf_mape_4w"] is not None and metrics["wf_mape_4w"] > 0
    assert metrics["wf_mape_12w"] is not None and metrics["wf_mape_12w"] > 0
    assert metrics["wf_mape_26w"] is not None and metrics["wf_mape_26w"] > 0
    assert metrics["pinball_loss"] is not None and metrics["pinball_loss"] > 0
    assert "beats_naive_baseline" in metrics
