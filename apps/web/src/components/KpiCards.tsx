'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Globe,
  Droplets,
  Activity,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { MarketLatestSnapshot, SignalLatest, ClimateLatest } from '../types';

interface KpiCardsProps {
  market: MarketLatestSnapshot | null;
  signal: SignalLatest | null;
  climate: ClimateLatest | null;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ market, signal, climate }) => {
  if (!market) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-800/40 border border-gray-800"></div>
        ))}
      </div>
    );
  }

  const dodPositive = market.changes.dod_pct > 0;
  const dodNegative = market.changes.dod_pct < 0;

  // Regime color formatting
  const getRegimeColor = (regime?: string) => {
    switch (regime) {
      case 'BACKWARDATION_STRONG':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'BACKWARDATION_MILD':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'CONTANGO_STRONG':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'CONTANGO_MILD':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Benchmark Đắk Lắk */}
        <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/60 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-amber-400 flex items-center gap-1">
              📍 ĐẮK LẮK (BENCHMARK)
            </span>
            <span className="font-mono text-gray-400">{market.date}</span>
          </div>
          <div className="flex items-baseline space-x-2 my-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {market.prices.daklak.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs text-gray-400 font-mono">đ/kg</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/40 mt-2">
            <div className="flex items-center space-x-1">
              {dodPositive ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : dodNegative ? (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              ) : null}
              <span
                className={`font-semibold ${
                  dodPositive
                    ? 'text-emerald-400'
                    : dodNegative
                    ? 'text-rose-400'
                    : 'text-gray-400'
                }`}
              >
                {dodPositive ? '+' : ''}
                {(market.changes.dod_pct * 100).toFixed(2)}% ({dodPositive ? '+' : ''}
                {market.changes.dod_vnd.toLocaleString('vi-VN')} đ)
              </span>
            </div>
            <span className="text-gray-400">
              WoW:{' '}
              <span className={market.changes.wow_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {market.changes.wow_pct >= 0 ? '+' : ''}
                {(market.changes.wow_pct * 100).toFixed(2)}%
              </span>
            </span>
          </div>
        </div>

        {/* Card 2: ICE London Robusta */}
        <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/60 shadow-lg relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-blue-400 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> ICE LONDON ROBUSTA
            </span>
            <span className="text-xs text-gray-400">Kỳ hạn M1</span>
          </div>
          <div className="flex items-baseline space-x-2 my-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ${market.futures.london_m1?.toLocaleString('en-US') ?? 'N/A'}
            </span>
            <span className="text-xs text-gray-400 font-mono">USD/tấn</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/40 mt-2">
            <span className="text-gray-400">
              M6: <span className="text-gray-200 font-mono">${market.futures.london_m6 ?? 'N/A'}</span>
            </span>
            <span className="text-gray-400">
              Spread (M1-M6):{' '}
              <span className="font-semibold text-amber-300 font-mono">
                {signal?.calendar_spread != null
                  ? `${signal.calendar_spread > 0 ? '+' : ''}${signal.calendar_spread} $/t`
                  : 'N/A'}
              </span>
            </span>
          </div>
        </div>

        {/* Card 3: Macro (USD/VND & Brent Oil) */}
        <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/60 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> TỶ GIÁ & DẦU THÔ
            </span>
            <span className="text-xs text-gray-400">VCB & Brent</span>
          </div>
          <div className="flex items-baseline space-x-2 my-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {market.macro.usd_vnd ? market.macro.usd_vnd.toLocaleString('vi-VN') : 'N/A'}
            </span>
            <span className="text-xs text-gray-400 font-mono">USD/VND</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/40 mt-2">
            <span className="text-gray-400">
              Brent Crude:{' '}
              <span className="text-amber-300 font-mono font-semibold">
                ${market.macro.brent_oil ? market.macro.brent_oil.toFixed(2) : 'N/A'}
              </span>
            </span>
            <span className="text-gray-400 font-mono text-2xs">Thị trường năng lượng</span>
          </div>
        </div>

        {/* Card 4: Quantitative Signals & Market Regime */}
        <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/60 shadow-lg relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold text-purple-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> TÍN HIỆU ĐỊNH LƯỢNG
            </span>
            {signal?.is_anomaly && (
              <span className="px-1.5 py-0.5 text-2xs font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-0.5">
                <Flame className="w-3 h-3 text-rose-400" /> BẤT THƯỜNG
              </span>
            )}
          </div>
          <div className="flex items-baseline space-x-2 my-1">
            <span
              className={`text-sm sm:text-base font-bold px-2 py-0.5 rounded border ${getRegimeColor(
                signal?.regime,
              )}`}
            >
              {signal?.regime || 'NORMAL'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/40 mt-2">
            <span className="text-gray-400">
              Basis:{' '}
              <span
                className={`font-semibold font-mono ${
                  (signal?.basis_vnd_kg || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {signal?.basis_vnd_kg != null
                  ? `${signal.basis_vnd_kg > 0 ? '+' : ''}${signal.basis_vnd_kg.toLocaleString(
                      'vi-VN',
                    )} đ/kg`
                  : 'N/A'}
              </span>
            </span>
            <span className="text-gray-400">
              Vol 30N:{' '}
              <span className="text-gray-200 font-mono">
                {signal?.volatility_30d != null
                  ? `${(signal.volatility_30d * 100).toFixed(2)}%/d`
                  : 'N/A'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Bar: 4 Provinces Details & Climate Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
        <div className="p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <span className="text-gray-400 block text-2xs">Lâm Đồng:</span>
          <span className="font-semibold text-gray-200 font-mono">
            {market.prices.lamdong.toLocaleString('vi-VN')} đ/kg
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <span className="text-gray-400 block text-2xs">Gia Lai:</span>
          <span className="font-semibold text-gray-200 font-mono">
            {market.prices.gialai.toLocaleString('vi-VN')} đ/kg
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <span className="text-gray-400 block text-2xs">Đắk Nông:</span>
          <span className="font-semibold text-gray-200 font-mono">
            {market.prices.daknong.toLocaleString('vi-VN')} đ/kg
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <span className="text-gray-400 block text-2xs">Trung bình 4 Tỉnh:</span>
          <span className="font-semibold text-amber-300 font-mono">
            {market.prices.average.toLocaleString('vi-VN')} đ/kg
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <span className="text-gray-400 block text-2xs">NOAA ONI ({climate?.month_date ?? 'Mới nhất'}):</span>
          <span className="font-semibold text-gray-200 font-mono">
            {climate?.oni != null ? `${climate.oni > 0 ? '+' : ''}${climate.oni}` : 'Trung tính'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <span className="text-gray-400 block text-2xs">Dị thường Mưa Đắk Lắk:</span>
          <span
            className={`font-semibold font-mono ${
              (climate?.rainfall_anomaly_daklak || 0) < 0 ? 'text-rose-400' : 'text-blue-400'
            }`}
          >
            {climate?.rainfall_anomaly_daklak != null
              ? `${climate.rainfall_anomaly_daklak > 0 ? '+' : ''}${climate.rainfall_anomaly_daklak.toFixed(1)} mm`
              : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};
