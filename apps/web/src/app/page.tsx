'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { KpiCards } from '../components/KpiCards';
import { ForecastFanChart } from '../components/ForecastFanChart';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { SignalsTable } from '../components/SignalsTable';
import { AuditTrailSection } from '../components/AuditTrailSection';
import {
  fetchMarketLatest,
  fetchMarketHistory,
  fetchSignalsLatest,
  fetchSignalsHistory,
  fetchForecastLatest,
  fetchForecastRuns,
  fetchClimateLatest,
} from '../lib/api';
import {
  MarketLatestSnapshot,
  MarketHistoryPoint,
  SignalLatest,
  SignalHistoryPoint,
  ForecastLatest,
  ForecastRunsResponse,
  ClimateLatest,
} from '../types';

export default function DashboardPage() {
  const [market, setMarket] = useState<MarketLatestSnapshot | null>(null);
  const [marketHistory, setMarketHistory] = useState<MarketHistoryPoint[]>([]);
  const [signal, setSignal] = useState<SignalLatest | null>(null);
  const [signalsHistory, setSignalsHistory] = useState<SignalHistoryPoint[]>([]);
  const [forecast, setForecast] = useState<ForecastLatest | null>(null);
  const [runsData, setRunsData] = useState<ForecastRunsResponse | null>(null);
  const [climate, setClimate] = useState<ClimateLatest | null>(null);

  const [historyRange, setHistoryRange] = useState<string>('90');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const loadAllData = useCallback(async (range: string = historyRange) => {
    setIsLoading(true);
    try {
      const [mLatest, mHist, sLatest, sHist, fLatest, fRuns, cLatest] = await Promise.all([
        fetchMarketLatest(),
        fetchMarketHistory(range),
        fetchSignalsLatest(),
        fetchSignalsHistory(range),
        fetchForecastLatest(),
        fetchForecastRuns(20, 0),
        fetchClimateLatest(),
      ]);

      setMarket(mLatest);
      setMarketHistory(mHist);
      setSignal(sLatest);
      setSignalsHistory(sHist);
      setForecast(fLatest);
      setRunsData(fRuns);
      setClimate(cLatest);

      setLastRefreshed(new Date().toLocaleTimeString('vi-VN'));
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [historyRange]);

  useEffect(() => {
    loadAllData(historyRange);
  }, [historyRange, loadAllData]);

  const handleRangeChange = (range: string) => {
    setHistoryRange(range);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <Header lastUpdated={lastRefreshed} onRefresh={() => loadAllData(historyRange)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Row 1: KPI Cards */}
        <KpiCards market={market} signal={signal} climate={climate} />

        {/* Row 2: 6-Month Probabilistic Forecast Fan Chart (Centerpiece) */}
        <ForecastFanChart forecast={forecast} />

        {/* Row 3: Domestic vs. London Historical Price Dynamics */}
        <PriceHistoryChart
          history={marketHistory}
          currentRange={historyRange}
          onRangeChange={handleRangeChange}
        />

        {/* Row 4: Quantitative Signals & Anomaly Detection */}
        <SignalsTable signals={signalsHistory} />

        {/* Row 5: Model Audit Trail & Walk-Forward Metrics */}
        <AuditTrailSection latestForecast={forecast} runsData={runsData} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950 py-5 text-center text-xs text-gray-400 space-y-1">
        <p className="font-semibold text-gray-400">
          COFFEE TRACKER — Production Architecture: NestJS 11 Control Plane + Python 3.12 Stateless ML Compute + PostgreSQL 17 + BullMQ 5 + Next.js 15
        </p>
        <p className="text-3xs text-gray-400">
          Dữ liệu giá thu thập từ giacaphe.com, ICE London Robusta, Vietcombank, Yahoo Finance, NOAA ONI & Open-Meteo API.
        </p>
      </footer>
    </div>
  );
}
