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
    # Only 10 points
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


def test_forecast_endpoint_valid_payload_runs_preprocessing(synthetic_daily_prices, synthetic_monthly_climate):
    payload = {
        "run_date": str(synthetic_daily_prices[-1].date),
        "market_prices": [p.model_dump(mode="json") for p in synthetic_daily_prices],
        "macro_climate": [c.model_dump(mode="json") for c in synthetic_monthly_climate],
    }

    response = client.post("/api/v1/forecast/weekly", json=payload)

    # In Step 3.1, endpoint validates schema and executes preprocessing pipeline,
    # returning 501 Not Implemented with validation summary diagnostics
    assert response.status_code == 501
    data = response.json()["detail"]
    assert "Weekly feature pipeline validated successfully" in data["message"]
    assert data["weekly_rows"] >= 156
    assert data["feature_count"] > 10
