'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { TodayCoffeePriceHero } from '../components/TodayCoffeePriceHero';
import { WeatherTodaySection } from '../components/WeatherTodaySection';
import { MarketInsightsPanel } from '../components/MarketInsightsPanel';
import { ForecastFanChart } from '../components/ForecastFanChart';
import { TelegramConnectSection } from '../components/TelegramConnectSection';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { SignalsTable } from '../components/SignalsTable';
import { AuditTrailSection } from '../components/AuditTrailSection';
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
import {
  MarketLatestSnapshot,
  MarketHistoryPoint,
  SignalHistoryPoint,
  ForecastLatest,
  ForecastRunsResponse,
  WeatherTodayResponse,
  MarketInsightsResponse,
  TelegramOnboardingInfo,
} from '../types';

export default function DashboardPage() {
  const [market, setMarket] = useState<MarketLatestSnapshot | null>(null);
  const [marketHistory, setMarketHistory] = useState<MarketHistoryPoint[]>([]);
  const [signalsHistory, setSignalsHistory] = useState<SignalHistoryPoint[]>([]);
  const [forecast, setForecast] = useState<ForecastLatest | null>(null);
  const [runsData, setRunsData] = useState<ForecastRunsResponse | null>(null);
  const [weather, setWeather] = useState<WeatherTodayResponse | null>(null);
  const [insights, setInsights] = useState<MarketInsightsResponse | null>(null);
  const [telegramInfo, setTelegramInfo] = useState<TelegramOnboardingInfo | null>(null);

  const [historyRange, setHistoryRange] = useState<string>('90');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);

  const loadAllData = useCallback(
    async (range: string = historyRange) => {
      try {
        const [mLatest, mHist, sHist, fLatest, fRuns, wToday, mInsights, tInfo] =
          await Promise.all([
            fetchMarketLatest(),
            fetchMarketHistory(range),
            fetchSignalsHistory(range),
            fetchForecastLatest(),
            fetchForecastRuns(20, 0),
            fetchWeatherToday(),
            fetchInsightsLatest(),
            fetchTelegramInfo(),
          ]);

        setMarket(mLatest);
        setMarketHistory(mHist);
        setSignalsHistory(sHist);
        setForecast(fLatest);
        setRunsData(fRuns);
        setWeather(wToday);
        setInsights(mInsights);
        setTelegramInfo(tInfo);
        setLastRefreshed(new Date().toLocaleTimeString('vi-VN'));
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
      }
    },
    [historyRange],
  );

  useEffect(() => {
    loadAllData(historyRange);
  }, [historyRange, loadAllData]);

  useEffect(() => {
    if (!isTelegramModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsTelegramModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isTelegramModalOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      <Header
        lastUpdated={lastRefreshed}
        onRefresh={() => loadAllData(historyRange)}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tier 1: Today's Coffee Price Hero */}
        <TodayCoffeePriceHero market={market} />

        {/* Tier 2: Central Highlands Weather Today */}
        <WeatherTodaySection weather={weather} />

        {/* Tier 3: Explainable Market Insights & 6-Month Probabilistic Forecast */}
        <div className="space-y-6">
          <MarketInsightsPanel insights={insights} />
          <ForecastFanChart
            forecast={forecast}
            transparency={insights?.forecast_transparency || null}
          />
        </div>

        {/* Tier 4: Dedicated Telegram Bot Onboarding Guide */}
        <TelegramConnectSection info={telegramInfo} />

        {/* Tier 5: Historical Price Dynamics, Quant Signals & Model Audit Trail */}
        <div className="space-y-6">
          <PriceHistoryChart
            history={marketHistory}
            currentRange={historyRange}
            onRangeChange={setHistoryRange}
          />
          <SignalsTable signals={signalsHistory} />
          <AuditTrailSection latestForecast={forecast} runsData={runsData} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 px-4 text-center text-xs text-stone-500 space-y-1">
        <p className="font-semibold text-stone-700">
          COFFEE TRACKER — Giám sát Giá Cà phê Tây Nguyên, Thời tiết & Dự báo 6 Tháng
        </p>
        <p>
          Nguồn dữ liệu: giacaphe.com, ICE London Robusta, Vietcombank, Yahoo Finance, NOAA ONI & Open-Meteo API.
        </p>
      </footer>

      {/* Telegram Onboarding Modal (triggered from Header button) */}
      {isTelegramModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTelegramModalOpen(false);
          }}
        >
          <TelegramConnectSection
            info={telegramInfo}
            isModal
            onClose={() => setIsTelegramModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
