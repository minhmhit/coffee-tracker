import pytest
from datetime import date, timedelta
import numpy as np
import pandas as pd
from app.schemas import DailyMarketDataPoint, MonthlyClimateDataPoint


@pytest.fixture
def synthetic_daily_prices():
    """Generates 200 weeks (~1400 calendar days) of synthetic daily prices for testing."""
    start_date = date(2021, 1, 1)
    n_days = 1400  # 200 weeks
    data = []

    np.random.seed(42)
    current_price = 50000.0
    current_london = 2200.0

    for i in range(n_days):
        dt = start_date + timedelta(days=i)
        # Random daily drift
        ret = np.random.normal(0.0003, 0.015)
        current_price *= np.exp(ret)
        current_london *= np.exp(np.random.normal(0.0002, 0.012))

        # Skip some weekend dates to simulate realistic market calendars
        if dt.weekday() >= 5 and np.random.rand() > 0.3:
            continue

        data.append(
            DailyMarketDataPoint(
                date=dt,
                price_daklak=round(current_price, 2),
                price_lamdong=round(current_price * 0.99, 2),
                price_gialai=round(current_price * 1.002, 2),
                price_daknong=round(current_price * 1.005, 2),
                price_avg=round(current_price, 2),
                london_m1=round(current_london, 2),
                london_m3=round(current_london * 0.98, 2),
                london_m6=round(current_london * 0.96, 2),
                usd_vnd=25000.0,
                brent_oil=85.0,
            )
        )
    return data


@pytest.fixture
def synthetic_monthly_climate():
    """Generates monthly climate observations from 2020 to 2025."""
    start_date = date(2020, 1, 1)
    climate = []

    for i in range(70):
        year = start_date.year + (start_date.month - 1 + i) // 12
        month = ((start_date.month - 1 + i) % 12) + 1
        m_dt = date(year, month, 1)

        climate.append(
            MonthlyClimateDataPoint(
                month_date=m_dt,
                oni=round(0.5 * np.sin(i / 6.0), 2),
                rainfall_anomaly_daklak=round(10.0 * np.cos(i / 4.0), 2),
                rainfall_anomaly_linhares=round(15.0 * np.sin(i / 5.0), 2),
            )
        )
    return climate
