'use client';

import React from 'react';
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
      <section className="space-y-4" aria-label="Đang tải giá cà phê hôm nay">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#166534]" />
              <span className="text-[14px] uppercase tracking-wider text-[#166534] font-bold">
                Thị trường Giao ngay Tây Nguyên
              </span>
            </div>
            <h1 className="font-serif text-[28px] sm:text-[32px] text-[#111827] tracking-tight font-semibold leading-tight">
              Giá Cà phê Hôm nay &amp; Dự báo Thị trường
            </h1>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#E5E7EB] shadow-sm space-y-5 animate-pulse min-h-[296px]">
          <div className="h-[116px] bg-[#F5F3EF] rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[104px] bg-[#F5F3EF] rounded-xl" />
            ))}
          </div>
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

  const londonConvertedVnd =
    market.futures.london_m1 && market.macro.usd_vnd
      ? (market.futures.london_m1 * market.macro.usd_vnd) / 1000
      : null;

  const otherProvinces = [
    { name: 'Lâm Đồng', price: market.prices.lamdong },
    { name: 'Gia Lai', price: market.prices.gialai },
    { name: 'Đắk Nông', price: market.prices.daknong },
  ];

  const avgDiffVnd =
    market.prices.average != null && market.prices.daklak != null
      ? Math.round(market.prices.average - market.prices.daklak)
      : null;

  return (
    <section aria-label="Giá cà phê Tây Nguyên hôm nay" className="space-y-4">
      {/* Editorial Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#166534]" />
            <span className="text-[14px] uppercase tracking-wider text-[#166534] font-bold">
              Thị trường Giao ngay Tây Nguyên
            </span>
          </div>
          <h1 className="font-serif text-[28px] sm:text-[32px] text-[#111827] tracking-tight font-semibold leading-tight">
            Giá Cà phê Hôm nay &amp; Dự báo Thị trường
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] shadow-sm text-[14px]">
            <span className="text-[#52525B] font-semibold">Phiên ngày:</span>
            <span className="font-mono font-bold text-[#18181B]">
              {formatDateVi(market.date)}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] shadow-sm text-[14px]">
            <span className="text-[#52525B] font-semibold">Đơn vị:</span>
            <span className="font-mono font-bold text-[#18181B]">đ/kg (Nhân xô)</span>
          </div>
        </div>
      </div>

      {/* Main Pure White Benchmark Card */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-[#E5E7EB] shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-[#E5E7EB]">
          {/* Benchmark Left Column: Dak Lak */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-md bg-[#E4E2DE] text-[14px] text-[#18181B] uppercase font-bold tracking-wide">
                Đắk Lắk (Chuẩn thị trường)
              </span>
              <span className="text-[14px] text-[#52525B] font-medium">
                7 ngày: {wowVnd > 0 ? '+' : ''}
                {formatVnd(wowVnd)} đ ({wowPct > 0 ? '+' : ''}
                {(wowPct * 100).toFixed(2)}%)
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 pt-0.5">
              <div className="font-serif text-[44px] sm:text-[52px] leading-none text-[#111827] font-bold tracking-tight tabular-nums">
                {formatVnd(market.prices.daklak)}{' '}
                <span className="font-sans text-[22px] sm:text-[26px] text-[#3F3F46] font-semibold">
                  đ/kg
                </span>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-mono text-[15px] sm:text-[16px] font-bold border ${
                  isUp
                    ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]'
                    : isDown
                    ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
                    : 'bg-[#F5F3EF] text-[#3F3F46] border-[#E5E7EB]'
                }`}
              >
                <span className="leading-none">{isUp ? '▲' : isDown ? '▼' : '—'}</span>
                <span>
                  {dodVnd > 0 ? '+' : ''}
                  {formatVnd(dodVnd)} đ ({dodPct > 0 ? '+' : ''}
                  {(dodPct * 100).toFixed(2)}%)
                </span>
                <span className="font-sans font-medium text-[14px]">so với hôm qua</span>
              </div>
            </div>
          </div>

          {/* Right Inset Box: London M1 & USD/VND */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F5F3EF] rounded-xl border border-[#E5E7EB] lg:min-w-[380px]">
            <div className="space-y-1">
              <div className="text-[14px] text-[#52525B] uppercase font-bold tracking-wide">
                Sàn ICE London (M1)
              </div>
              <div className="font-mono text-[22px] text-[#111827] font-bold tabular-nums">
                {market.futures.london_m1 != null
                  ? `$${Math.round(market.futures.london_m1).toLocaleString('en-US')}`
                  : 'N/A'}{' '}
                <span className="text-[14px] text-[#52525B] font-semibold">/tấn</span>
              </div>
              {londonConvertedVnd != null && (
                <div className="font-mono text-[14px] text-[#3F6A52] font-semibold">
                  Quy đổi ≈ {formatVnd(londonConvertedVnd)} đ/kg
                </div>
              )}
            </div>

            <div className="space-y-1 sm:border-l sm:border-[#E5E7EB] sm:pl-4">
              <div className="text-[14px] text-[#52525B] uppercase font-bold tracking-wide">
                Tỷ giá USD/VND
              </div>
              <div className="font-mono text-[22px] text-[#111827] font-bold tabular-nums">
                {market.macro.usd_vnd != null ? formatVnd(market.macro.usd_vnd) : 'N/A'}{' '}
                <span className="text-[14px] text-[#52525B] font-semibold">đ</span>
              </div>
              <div className="text-[14px] text-[#52525B] font-medium">Nguồn: Vietcombank</div>
            </div>
          </div>
        </div>

        {/* Other Provinces + Regional Average Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {otherProvinces.map((prov) => {
            const diffVsDakLak =
              prov.price != null && market.prices.daklak != null
                ? Math.round(prov.price - market.prices.daklak)
                : null;
            return (
              <div
                key={prov.name}
                className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] text-[#18181B] font-bold">{prov.name}</span>
                  <span className="text-[14px] px-2 py-0.5 bg-[#E4E2DE] rounded text-[#27272A] font-medium">
                    Hôm nay
                  </span>
                </div>
                <div className="font-mono text-[22px] sm:text-[24px] text-[#111827] font-bold tabular-nums">
                  {formatVnd(prov.price)}{' '}
                  <span className="text-[15px] font-semibold text-[#52525B]">đ/kg</span>
                </div>
                {diffVsDakLak != null && (
                  <div className="text-[14px] font-mono text-[#52525B]">
                    So Đắk Lắk: {diffVsDakLak > 0 ? '+' : ''}
                    {formatVnd(diffVsDakLak)} đ
                  </div>
                )}
              </div>
            );
          })}

          {/* 4-Province Average */}
          <div className="p-4 rounded-xl bg-[#ECF3EF] border border-[#86EFAC] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[16px] text-[#14532D] font-bold">Trung bình 4 tỉnh</span>
              <span className="text-[14px] px-2 py-0.5 bg-white/80 rounded text-[#166534] font-semibold">
                Tây Nguyên
              </span>
            </div>
            <div className="font-mono text-[22px] sm:text-[24px] text-[#14532D] font-bold tabular-nums">
              {formatVnd(market.prices.average)}{' '}
              <span className="text-[15px] font-semibold text-[#166534]">đ/kg</span>
            </div>
            {avgDiffVnd != null && (
              <div className="text-[14px] font-mono text-[#166534]">
                So Đắk Lắk: {avgDiffVnd > 0 ? '+' : ''}
                {formatVnd(avgDiffVnd)} đ
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
