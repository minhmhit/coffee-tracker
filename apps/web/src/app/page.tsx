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

        const now = new Date();
        const hhmm = now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const ddmm = now.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        setLastRefreshed(`${hhmm} · ${ddmm}`);
      } catch (err: any) {
        console.warn('Failed to load dashboard data:', err);
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
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] text-[#18181B]">
      <Header
        lastUpdated={lastRefreshed}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tier 1: Today's Coffee Price Hero */}
        <TodayCoffeePriceHero market={market} />

        {/* Tier 2: Central Highlands Weather & Drying Outlook */}
        <WeatherTodaySection weather={weather} />

        {/* Tier 3: Explainable Market Insights & 6-Month Forecast */}
        <div className="space-y-6">
          <MarketInsightsPanel insights={insights} />
          <ForecastFanChart
            forecast={forecast}
            transparency={insights?.forecast_transparency || null}
          />
        </div>

        {/* Tier 4: Senior-Friendly Telegram 06:00 Briefing Onboarding */}
        <TelegramConnectSection info={telegramInfo} />

        {/* Tier 5: Historical Prices, Quantitative Signals & Audit Trail (Always Expanded per Choice B) */}
        <div className="space-y-6">
          <PriceHistoryChart
            history={marketHistory}
            currentRange={historyRange}
            onRangeChange={setHistoryRange}
          />
          <SignalsTable signals={signalsHistory} />
          <AuditTrailSection
            latestForecast={forecast}
            runsData={runsData}
            onRefresh={() => loadAllData(historyRange)}
          />
        </div>
      </main>

      {/* Clean Editorial Footer citing only verified live sources */}
      <footer className="w-full bg-[#F5F3EF] border-t border-[#E5E7EB] py-8 mt-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[14px] text-[#47464B]">
            <div className="space-y-1.5">
              <p className="font-serif text-[18px] text-[#18181B] font-semibold">
                Phương pháp Thu thập Dữ liệu
              </p>
              <p className="leading-relaxed">
                Giá cà phê nhân xô tại 4 tỉnh Tây Nguyên (Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông) và
                giá kỳ hạn London được tổng hợp tự động hằng ngày qua hệ thống kiểm tra tính hợp lệ
                dữ liệu.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[14px] text-[#18181B] font-bold uppercase tracking-wider">
                Nguồn Dữ liệu Đang Kết nối
              </p>
              <ul className="space-y-1">
                <li>• Giá nội địa &amp; London: giacaphe.com, vietnambiz.vn</li>
                <li>• Tỷ giá &amp; Vĩ mô: Vietcombank XML, Yahoo Finance (Brent)</li>
                <li>• Thời tiết &amp; Khí hậu: Open-Meteo API, NOAA ONI</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="text-[14px] text-[#18181B] font-bold uppercase tracking-wider">
                Lưu ý Tham khảo
              </p>
              <p className="leading-relaxed">
                Thông tin thị trường và ước tính xu hướng 6 tháng chỉ phục vụ mục đích tham khảo,
                không cấu thành khuyến nghị giao dịch tài chính hay cam kết giá thu mua thực tế.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-2 text-[14px] text-[#52525B] font-mono">
            <p>© 2026 COFFEE TRACKER · Thị trường Cà phê Tây Nguyên</p>
            <p>Cập nhật tự động hằng ngày &amp; Bản tin Telegram 06:00 sáng</p>
          </div>
        </div>
      </footer>

      {/* Telegram Onboarding Modal */}
      {isTelegramModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
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
