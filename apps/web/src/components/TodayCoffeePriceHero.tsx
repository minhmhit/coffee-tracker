'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, MapPin, Globe, ArrowUpDown } from 'lucide-react';
import { MarketLatestSnapshot } from '../types';

interface TodayCoffeePriceHeroProps {
  market: MarketLatestSnapshot | null;
}

function formatVnd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Math.round(value).toLocaleString('vi-VN');
}

function formatDateVi(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const TodayCoffeePriceHero: React.FC<TodayCoffeePriceHeroProps> = ({ market }) => {
  if (!market) {
    return (
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6 animate-pulse space-y-4">
        <div className="h-4 w-48 bg-stone-200 rounded" />
        <div className="h-12 w-64 bg-stone-200 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-stone-100 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  const dodPct = market.changes?.dod_pct ?? 0;
  const dodVnd = market.changes?.dod_vnd ?? 0;
  const wowPct = market.changes?.wow_pct ?? 0;
  const wowVnd = market.changes?.wow_vnd ?? 0;

  const isUp = dodVnd > 0;
  const isDown = dodVnd < 0;

  const provinces = [
    { name: 'Đắk Lắk', price: market.prices.daklak, benchmark: true },
    { name: 'Lâm Đồng', price: market.prices.lamdong, benchmark: false },
    { name: 'Gia Lai', price: market.prices.gialai, benchmark: false },
    { name: 'Đắk Nông', price: market.prices.daknong, benchmark: false },
  ];

  const londonConvertedVnd =
    market.futures.london_m1 && market.macro.usd_vnd
      ? (market.futures.london_m1 * market.macro.usd_vnd) / 1000
      : null;

  return (
    <section
      aria-label="Giá cà phê hôm nay"
      className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5 sm:p-7 space-y-6"
    >
      {/* Top Eyebrow */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-700" />
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700">
            Giá Cà phê Nhân xô Tây Nguyên Hôm nay
          </h2>
        </div>
        <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
          Phiên ngày <strong className="text-stone-800 font-mono">{formatDateVi(market.date)}</strong>
        </span>
      </div>

      {/* Main Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Focal Benchmark Price: Dak Lak */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <MapPin className="w-3.5 h-3.5" />
            <span>Đắk Lắk (Giá chuẩn tham chiếu)</span>
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-900 font-mono tabular-nums">
              {formatVnd(market.prices.daklak)}
            </span>
            <span className="text-base sm:text-lg font-medium text-stone-500">đ/kg</span>
          </div>

          {/* DoD & WoW Deltas */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isUp
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isDown
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              {isUp ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : isDown ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              <span>
                So hôm qua: {dodVnd > 0 ? '+' : ''}
                {formatVnd(dodVnd)} đ ({dodPct > 0 ? '+' : ''}
                {dodPct.toFixed(2)}%)
              </span>
            </span>

            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
              7 ngày: {wowVnd > 0 ? '+' : ''}
              {formatVnd(wowVnd)} đ ({wowPct > 0 ? '+' : ''}
              {wowPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Right Side: 4 Provinces + Global Essentials */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* 4-Province Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {provinces.map((item) => (
              <div
                key={item.name}
                className={`rounded-xl p-3 border transition-colors ${
                  item.benchmark
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-stone-50/80 border-stone-200'
                }`}
              >
                <div className="text-xs font-medium text-stone-500 flex items-center justify-between">
                  <span>{item.name}</span>
                  {item.benchmark && (
                    <span className="text-[10px] font-semibold text-amber-800 uppercase">Chuẩn</span>
                  )}
                </div>
                <div className="mt-1 text-base sm:text-lg font-bold text-stone-900 font-mono tabular-nums">
                  {formatVnd(item.price)}
                  <span className="text-xs font-normal text-stone-500 ml-1">đ</span>
                </div>
              </div>
            ))}
          </div>

          {/* Essential Reference Strip: London M1 + USD/VND + Regional Average */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
            <div className="flex items-center justify-between sm:block rounded-xl bg-stone-50 border border-stone-200/80 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Globe className="w-3.5 h-3.5 text-sky-700" />
                <span>London Robusta M1</span>
              </div>
              <div className="sm:mt-1 flex items-baseline gap-1.5">
                <span className="text-sm sm:text-base font-bold text-stone-900 font-mono tabular-nums">
                  {market.futures.london_m1 != null
                    ? `$${Math.round(market.futures.london_m1).toLocaleString('en-US')}`
                    : 'N/A'}
                </span>
                {londonConvertedVnd != null && (
                  <span className="text-[11px] text-stone-500 font-mono">
                    (≈{formatVnd(londonConvertedVnd)} đ/kg)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:block rounded-xl bg-stone-50 border border-stone-200/80 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tỷ giá USD/VND</span>
              </div>
              <div className="sm:mt-1 text-sm sm:text-base font-bold text-stone-900 font-mono tabular-nums">
                {market.macro.usd_vnd != null ? `${formatVnd(market.macro.usd_vnd)} đ` : 'N/A'}
              </div>
            </div>

            <div className="flex items-center justify-between sm:block rounded-xl bg-stone-50 border border-stone-200/80 px-3.5 py-2.5">
              <div className="text-xs text-stone-500">Trung bình Tây Nguyên</div>
              <div className="sm:mt-1 text-sm sm:text-base font-bold text-stone-900 font-mono tabular-nums">
                {formatVnd(market.prices.average)} <span className="text-xs font-normal text-stone-500">đ/kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
