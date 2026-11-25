'use client';

import React, { useState } from 'react';
import { MarketHistoryPoint } from '../types';

interface PriceHistoryChartProps {
  history: MarketHistoryPoint[];
  currentRange: string;
  onRangeChange: (range: string) => void;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  history,
  currentRange,
  onRangeChange,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<MarketHistoryPoint | null>(null);
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>({
    daklak: true,
    lamdong: false,
    gialai: false,
    daknong: false,
    londonConverted: true,
  });

  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!history || history.length === 0) {
    return (
      <section className="p-6 rounded-xl bg-white border border-[#E5E7EB] shadow-sm text-center">
        <p className="text-[#52525B] text-[16px]">Chưa có dữ liệu lịch sử giá.</p>
      </section>
    );
  }

  const pointsWithLondon = history.map((p) => ({
    ...p,
    londonConverted:
      p.london_m1 && p.usd_vnd ? (p.london_m1 * p.usd_vnd) / 1000 : null,
  }));

  // Compute genuine period stats from loaded history
  const daklakPrices = history
    .map((p) => p.price_daklak)
    .filter((v) => typeof v === 'number' && !Number.isNaN(v) && v > 0);
  const periodHigh = daklakPrices.length > 0 ? Math.max(...daklakPrices) : null;
  const periodLow = daklakPrices.length > 0 ? Math.min(...daklakPrices) : null;
  const periodAvg =
    daklakPrices.length > 0
      ? Math.round(daklakPrices.reduce((a, b) => a + b, 0) / daklakPrices.length)
      : null;

  const width = 880;
  const height = 300;
  const padding = { top: 24, right: 30, bottom: 42, left: 78 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allValues: number[] = [];
  pointsWithLondon.forEach((p) => {
    if (activeSeries.daklak && p.price_daklak) allValues.push(p.price_daklak);
    if (activeSeries.lamdong && p.price_lamdong) allValues.push(p.price_lamdong);
    if (activeSeries.gialai && p.price_gialai) allValues.push(p.price_gialai);
    if (activeSeries.daknong && p.price_daknong) allValues.push(p.price_daknong);
    if (activeSeries.londonConverted && p.londonConverted) allValues.push(p.londonConverted);
  });

  const minY =
    allValues.length > 0 ? Math.floor(Math.min(...allValues) / 2000) * 2000 - 1000 : 60000;
  const maxY =
    allValues.length > 0 ? Math.ceil(Math.max(...allValues) / 2000) * 2000 + 1000 : 80000;
  const yRange = maxY - minY || 1;

  const getX = (idx: number) =>
    padding.left + (idx / (pointsWithLondon.length - 1 || 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - ((val - minY) / yRange) * chartHeight;

  const buildPath = (extractor: (p: any) => number | null) => {
    const validPoints = pointsWithLondon
      .map((p, i) => ({ x: getX(i), y: extractor(p) }))
      .filter((pt) => pt.y !== null && !Number.isNaN(pt.y!));

    if (validPoints.length === 0) return '';
    return `M ${validPoints.map((pt) => `${pt.x},${getY(pt.y!)}`).join(' L ')}`;
  };

  const daklakPath = activeSeries.daklak ? buildPath((p) => p.price_daklak) : '';
  const lamdongPath = activeSeries.lamdong ? buildPath((p) => p.price_lamdong) : '';
  const gialaiPath = activeSeries.gialai ? buildPath((p) => p.price_gialai) : '';
  const daknongPath = activeSeries.daknong ? buildPath((p) => p.price_daknong) : '';
  const londonPath = activeSeries.londonConverted ? buildPath((p) => p.londonConverted) : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => minY + pct * yRange);

  const seriesChips = [
    {
      key: 'daklak',
      label: 'Đắk Lắk (Chuẩn)',
      dot: 'bg-[#166534]',
      activeCls: 'bg-[#ECF3EF] text-[#14532D] border-[#86EFAC]',
    },
    {
      key: 'londonConverted',
      label: 'Giá London quy đổi VNĐ',
      dot: 'bg-[#475569]',
      activeCls: 'bg-[#F1F5F9] text-[#1E293B] border-[#94A3B8]',
    },
    {
      key: 'lamdong',
      label: 'Lâm Đồng',
      dot: 'bg-[#B45309]',
      activeCls: 'bg-[#FEF3C7] text-[#78350F] border-[#FCD34D]',
    },
    {
      key: 'gialai',
      label: 'Gia Lai',
      dot: 'bg-[#0E7490]',
      activeCls: 'bg-[#ECFEFF] text-[#155E75] border-[#67E8F9]',
    },
    {
      key: 'daknong',
      label: 'Đắk Nông',
      dot: 'bg-[#7C3AED]',
      activeCls: 'bg-[#F5F3FF] text-[#5B21B6] border-[#C4B5FD]',
    },
  ];

  return (
    <section
      aria-label="Biểu đồ lịch sử giá cà phê"
      className="bg-white rounded-xl p-5 sm:p-6 border border-[#E5E7EB] shadow-sm space-y-5"
    >
      {/* Header and Range Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-[22px] text-[#111827] font-semibold">
            Diễn biến Giá Lịch sử Nội địa &amp; Sàn London
          </h3>
          <p className="text-[15px] text-[#52525B] mt-0.5">
            So sánh giá thu mua thực tế Tây Nguyên và giá kỳ hạn London quy đổi sang đ/kg
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#F5F3EF] p-1 rounded-xl border border-[#E5E7EB] text-[14px] self-start md:self-auto">
          {[
            { label: '30N', value: '30' },
            { label: '90N', value: '90' },
            { label: '180N', value: '180' },
            { label: '1N', value: '365' },
            { label: 'Tất cả', value: 'all' },
          ].map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onRangeChange(r.value)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                currentRange === r.value
                  ? 'bg-white text-[#111827] shadow-sm border border-[#E5E7EB]'
                  : 'text-[#52525B] hover:text-[#111827]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Series Toggle Chips */}
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        {seriesChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => toggleSeries(chip.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              activeSeries[chip.key]
                ? chip.activeCls
                : 'bg-[#FBF9F5] text-[#52525B] border-[#E5E7EB]'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${chip.dot}`} />
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Pure SVG Chart Container */}
      <div className="relative w-full bg-[#FBF9F5] rounded-xl p-3 sm:p-4 border border-[#E5E7EB] overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[600px] select-none"
          role="img"
          aria-label="Biểu đồ đường giá cà phê lịch sử Tây Nguyên và London"
        >
          {yTicks.map((yVal, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={getY(yVal)}
                x2={width - padding.right}
                y2={getY(yVal)}
                stroke="#D1D5DB"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={getY(yVal) + 5}
                textAnchor="end"
                className="font-mono text-[14px] font-semibold fill-[#3F3F46]"
              >
                {Math.round(yVal / 1000)}k đ
              </text>
            </g>
          ))}

          {pointsWithLondon
            .filter((_, i) => i % Math.max(1, Math.floor(pointsWithLondon.length / 6)) === 0)
            .map((p, idx) => {
              const originalIdx = pointsWithLondon.indexOf(p);
              const x = getX(originalIdx);
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={height - padding.bottom}
                    x2={x}
                    y2={height - padding.bottom + 5}
                    stroke="#A1A1AA"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 22}
                    textAnchor="middle"
                    className="font-mono text-[14px] font-medium fill-[#3F3F46]"
                  >
                    {p.date.slice(5).replace('-', '/')}
                  </text>
                </g>
              );
            })}

          {daklakPath && (
            <path d={daklakPath} fill="none" stroke="#166534" strokeWidth="2.8" />
          )}
          {londonPath && (
            <path
              d={londonPath}
              fill="none"
              stroke="#475569"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          )}
          {lamdongPath && (
            <path d={lamdongPath} fill="none" stroke="#B45309" strokeWidth="1.8" />
          )}
          {gialaiPath && (
            <path d={gialaiPath} fill="none" stroke="#0E7490" strokeWidth="1.8" />
          )}
          {daknongPath && (
            <path d={daknongPath} fill="none" stroke="#7C3AED" strokeWidth="1.8" />
          )}

          {pointsWithLondon.map((p, i) => {
            const x = getX(i);
            const isHovered = hoveredPoint?.date === p.date;
            return (
              <g
                key={p.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(p)}
                onClick={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <rect
                  x={x - chartWidth / (pointsWithLondon.length * 2)}
                  y={padding.top}
                  width={chartWidth / pointsWithLondon.length}
                  height={chartHeight}
                  fill="transparent"
                />
                {isHovered && (
                  <g>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={height - padding.bottom}
                      stroke="#71717A"
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                    />
                    {activeSeries.daklak && p.price_daklak && (
                      <circle cx={x} cy={getY(p.price_daklak)} r="4.5" fill="#166534" />
                    )}
                    {activeSeries.londonConverted && p.londonConverted && (
                      <circle cx={x} cy={getY(p.londonConverted)} r="4.5" fill="#475569" />
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {hoveredPoint && (
          <div className="mt-3 sm:mt-0 sm:absolute sm:top-4 sm:right-4 p-3.5 rounded-xl bg-white border border-[#E5E7EB] shadow-md text-[14px] space-y-1">
            <div className="font-bold text-[#111827] border-b border-[#E5E7EB] pb-1">
              Ngày <span className="font-mono text-[#166534]">{hoveredPoint.date}</span>
            </div>
            <div className="flex justify-between gap-4 font-mono text-[#14532D]">
              <span>Đắk Lắk:</span>
              <span className="font-bold">
                {hoveredPoint.price_daklak?.toLocaleString('vi-VN')} đ/kg
              </span>
            </div>
            {hoveredPoint.london_m1 && (
              <div className="flex justify-between gap-4 font-mono text-[#334155]">
                <span>London M1:</span>
                <span>
                  ${hoveredPoint.london_m1} (≈{' '}
                  {Math.round(
                    (hoveredPoint.london_m1 * (hoveredPoint.usd_vnd || 25600)) / 1000,
                  ).toLocaleString('vi-VN')}{' '}
                  đ/kg)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real Period Summary Stats (Calculated from Live History Array) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[14px]">
        <div className="p-3 rounded-lg bg-[#F5F3EF] border border-[#E5E7EB]">
          <span className="text-[#52525B] block">Cao nhất trong kỳ (Đắk Lắk)</span>
          <strong className="font-mono text-[16px] text-[#166534]">
            {periodHigh != null ? `${periodHigh.toLocaleString('vi-VN')} đ/kg` : '—'}
          </strong>
        </div>
        <div className="p-3 rounded-lg bg-[#F5F3EF] border border-[#E5E7EB]">
          <span className="text-[#52525B] block">Thấp nhất trong kỳ (Đắk Lắk)</span>
          <strong className="font-mono text-[16px] text-[#991B1B]">
            {periodLow != null ? `${periodLow.toLocaleString('vi-VN')} đ/kg` : '—'}
          </strong>
        </div>
        <div className="p-3 rounded-lg bg-[#F5F3EF] border border-[#E5E7EB]">
          <span className="text-[#52525B] block">Trung bình trong kỳ</span>
          <strong className="font-mono text-[16px] text-[#111827]">
            {periodAvg != null ? `${periodAvg.toLocaleString('vi-VN')} đ/kg` : '—'}
          </strong>
        </div>
        <div className="p-3 rounded-lg bg-[#F5F3EF] border border-[#E5E7EB]">
          <span className="text-[#52525B] block">Số phiên dữ liệu</span>
          <strong className="font-mono text-[16px] text-[#111827]">{history.length} ngày</strong>
        </div>
      </div>
    </section>
  );
};
