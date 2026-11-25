'use client';

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
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
    lamdong: true,
    gialai: false,
    daknong: false,
    londonConverted: true,
  });

  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!history || history.length === 0) {
    return (
      <section className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm text-center">
        <p className="text-stone-500 text-sm">Chưa có dữ liệu lịch sử giá.</p>
      </section>
    );
  }

  const pointsWithLondon = history.map((p) => ({
    ...p,
    londonConverted:
      p.london_m1 && p.usd_vnd ? (p.london_m1 * p.usd_vnd) / 1000 : null,
  }));

  const width = 800;
  const height = 290;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };
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
    { key: 'daklak', label: 'Đắk Lắk (Chuẩn)', dot: 'bg-amber-700', activeBg: 'bg-amber-50 text-amber-900 border-amber-300' },
    { key: 'lamdong', label: 'Lâm Đồng', dot: 'bg-violet-600', activeBg: 'bg-violet-50 text-violet-900 border-violet-300' },
    { key: 'gialai', label: 'Gia Lai', dot: 'bg-cyan-600', activeBg: 'bg-cyan-50 text-cyan-900 border-cyan-300' },
    { key: 'daknong', label: 'Đắk Nông', dot: 'bg-emerald-600', activeBg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    { key: 'londonConverted', label: 'London M1 (quy đổi VNĐ)', dot: 'bg-blue-600', activeBg: 'bg-blue-50 text-blue-900 border-blue-300' },
  ];

  return (
    <section className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Diễn biến Giá Lịch sử Nội địa & London
            </h3>
            <p className="text-xs text-stone-500">
              So sánh giá thu mua Tây Nguyên và quy đổi sàn ICE London Robusta
            </p>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-xl text-xs">
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
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                currentRange === r.value
                  ? 'bg-white text-stone-900 font-bold shadow-sm border border-stone-200/80'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Series Toggles */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {seriesChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => toggleSeries(chip.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
              activeSeries[chip.key]
                ? chip.activeBg
                : 'bg-stone-50 text-stone-500 border-stone-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${chip.dot}`} />
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[600px] select-none">
          {yTicks.map((yVal, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={getY(yVal)}
                x2={width - padding.right}
                y2={getY(yVal)}
                stroke="#e7e5e4"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={getY(yVal) + 4}
                textAnchor="end"
                className="text-[11px] font-mono fill-stone-500"
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
                    stroke="#d6d3d1"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className="text-[11px] font-mono fill-stone-500"
                  >
                    {p.date.slice(5)}
                  </text>
                </g>
              );
            })}

          {daklakPath && <path d={daklakPath} fill="none" stroke="#b45309" strokeWidth="2.4" />}
          {lamdongPath && <path d={lamdongPath} fill="none" stroke="#7c3aed" strokeWidth="1.6" />}
          {gialaiPath && <path d={gialaiPath} fill="none" stroke="#0891b2" strokeWidth="1.6" />}
          {daknongPath && <path d={daknongPath} fill="none" stroke="#059669" strokeWidth="1.6" />}
          {londonPath && (
            <path
              d={londonPath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
          )}

          {pointsWithLondon.map((p, i) => {
            const x = getX(i);
            const isHovered = hoveredPoint?.date === p.date;
            return (
              <g
                key={p.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(p)}
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
                      stroke="#a8a29e"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    {activeSeries.daklak && p.price_daklak && (
                      <circle cx={x} cy={getY(p.price_daklak)} r="4" fill="#b45309" />
                    )}
                    {activeSeries.londonConverted && p.londonConverted && (
                      <circle cx={x} cy={getY(p.londonConverted)} r="4" fill="#2563eb" />
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {hoveredPoint && (
          <div className="absolute top-3 right-4 pointer-events-none p-3 rounded-xl bg-white/95 border border-stone-200 shadow-lg text-xs space-y-1 backdrop-blur-sm">
            <div className="font-bold text-stone-800 border-b border-stone-100 pb-1">
              Ngày: <span className="font-mono text-amber-800">{hoveredPoint.date}</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-900 font-mono">
              <span>Đắk Lắk:</span>
              <span className="font-bold">
                {hoveredPoint.price_daklak?.toLocaleString('vi-VN')} đ/kg
              </span>
            </div>
            {hoveredPoint.london_m1 && (
              <div className="flex justify-between gap-4 text-blue-700 font-mono text-[11px]">
                <span>London M1:</span>
                <span>
                  ${hoveredPoint.london_m1} (≈{' '}
                  {Math.round(
                    (hoveredPoint.london_m1 * (hoveredPoint.usd_vnd || 25500)) / 1000,
                  ).toLocaleString('vi-VN')}{' '}
                  đ/kg)
                </span>
              </div>
            )}
            {hoveredPoint.usd_vnd && (
              <div className="flex justify-between gap-4 text-stone-500 text-[11px] font-mono">
                <span>USD/VND:</span>
                <span>{hoveredPoint.usd_vnd.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
