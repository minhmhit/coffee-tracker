import React from 'react';
import { DashboardClient } from '../components/DashboardClient';
import { formatNowVn } from '../lib/date-format';
import {
  fetchMarketLatest,
  fetchMarketHistory,
  fetchSignalsHistory,
  fetchForecastLatest,
  fetchForecastRuns,
  fetchWeatherToday,
  fetchInsightsLatest,
  fetchTelegramInfo,
} from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [
    initialMarket,
    initialMarketHistory,
    initialSignalsHistory,
    initialForecast,
    initialRunsData,
    initialWeather,
    initialInsights,
    initialTelegramInfo,
  ] = await Promise.all([
    fetchMarketLatest(),
    fetchMarketHistory('90'),
    fetchSignalsHistory('90'),
    fetchForecastLatest(),
    fetchForecastRuns(20, 0),
    fetchWeatherToday(),
    fetchInsightsLatest(),
    fetchTelegramInfo(),
  ]);

  const initialLastUpdated = formatNowVn();

  return (
    <DashboardClient
      initialMarket={initialMarket}
      initialMarketHistory={initialMarketHistory}
      initialSignalsHistory={initialSignalsHistory}
      initialForecast={initialForecast}
      initialRunsData={initialRunsData}
      initialWeather={initialWeather}
      initialInsights={initialInsights}
      initialTelegramInfo={initialTelegramInfo}
      initialLastUpdated={initialLastUpdated}
    />
  );
}
