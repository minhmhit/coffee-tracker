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
      <div className="p-8 rounded-2xl bg-gray-900/60 border border-gray-800 text-center">
        <p className="text-gray-400 text-sm">Chưa có dữ liệu lịch sử giá.</p>
      </div>
    );
  }

  // Calculate London converted to VND/kg: london_m1 * usd_vnd / 1000
  const pointsWithLondon = history.map((p) => ({
    ...p,
    londonConverted:
      p.london_m1 && p.usd_vnd ? (p.london_m1 * p.usd_vnd) / 1000 : null,
  }));

  // SVG dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Determine Y range
  const allValues: number[] = [];
  pointsWithLondon.forEach((p) => {
    if (activeSeries.daklak && p.price_daklak) allValues.push(p.price_daklak);
    if (activeSeries.lamdong && p.price_lamdong) allValues.push(p.price_lamdong);
    if (activeSeries.gialai && p.price_gialai) allValues.push(p.price_gialai);
    if (activeSeries.daknong && p.price_daknong) allValues.push(p.price_daknong);
    if (activeSeries.londonConverted && p.londonConverted) allValues.push(p.londonConverted);
  });

  const minY = allValues.length > 0 ? Math.floor(Math.min(...allValues) / 2000) * 2000 - 1000 : 60000;
  const maxY = allValues.length > 0 ? Math.ceil(Math.max(...allValues) / 2000) * 2000 + 1000 : 80000;
  const yRange = maxY - minY || 1;

  const getX = (idx: number) => padding.left + (idx / (pointsWithLondon.length - 1 || 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - ((val - minY) / yRange) * chartHeight;

  // Build path strings
  const buildPath = (extractor: (p: any) => number | null) => {
    const validPoints = pointsWithLondon
      .map((p, i) => ({ x: getX(i), y: extractor(p) }))
      .filter((pt) => pt.y !== null && !isNaN(pt.y!));

    if (validPoints.length === 0) return '';
    return `M ${validPoints.map((pt) => `${pt.x},${getY(pt.y!)}`).join(' L ')}`;
  };

  const daklakPath = activeSeries.daklak ? buildPath((p) => p.price_daklak) : '';
  const lamdongPath = activeSeries.lamdong ? buildPath((p) => p.price_lamdong) : '';
  const gialaiPath = activeSeries.gialai ? buildPath((p) => p.price_gialai) : '';
  const daknongPath = activeSeries.daknong ? buildPath((p) => p.price_daknong) : '';
  const londonPath = activeSeries.londonConverted ? buildPath((p) => p.londonConverted) : '';

  // Y-axis grid ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => minY + pct * yRange);

  return (
    <div className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-xl space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">
            📈 DIỄN BIẾN GIÁ LỊCH SỬ NỘI ĐỊA & LONDON
          </h3>
          <p className="text-xs text-gray-400">
            So sánh giá thu mua Tây Nguyên và giá ICE London M1 quy đổi VNĐ/kg
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center space-x-1.5 bg-gray-800/80 p-1 rounded-lg border border-gray-700/80 text-xs">
          {[
            { label: '30N', value: '30' },
            { label: '90N', value: '90' },
            { label: '180N', value: '180' },
            { label: '1N', value: '365' },
            { label: 'Tất cả', value: 'all' },
          ].map((r) => (
            <button
              key={r.value}
              onClick={() => onRangeChange(r.value)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                currentRange === r.value
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Series Toggles */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          onClick={() => toggleSeries('daklak')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border transition-all ${
            activeSeries.daklak
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span>Đắk Lắk (Benchmark)</span>
        </button>
        <button
          onClick={() => toggleSeries('lamdong')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border transition-all ${
            activeSeries.lamdong
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
          <span>Lâm Đồng</span>
        </button>
        <button
          onClick={() => toggleSeries('gialai')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border transition-all ${
            activeSeries.gialai
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span>Gia Lai</span>
        </button>
        <button
          onClick={() => toggleSeries('daknong')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border transition-all ${
            activeSeries.daknong
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span>Đắk Nông</span>
        </button>
        <button
          onClick={() => toggleSeries('londonConverted')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border transition-all ${
            activeSeries.londonConverted
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
          <span>London M1 (quy đổi VNĐ)</span>
        </button>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[600px] select-none"
        >
          {/* Grid lines & Y labels */}
          {yTicks.map((yVal, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={getY(yVal)}
                x2={width - padding.right}
                y2={getY(yVal)}
                stroke="#374151"
                strokeDasharray="4 4"
                strokeWidth="0.8"
              />
              <text
                x={padding.left - 8}
                y={getY(yVal) + 4}
                textAnchor="end"
                className="text-2xs font-mono fill-gray-400"
              >
                {Math.round(yVal / 1000)}k đ
              </text>
            </g>
          ))}

          {/* Time markers on X */}
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
                    stroke="#4b5563"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className="text-2xs font-mono fill-gray-400"
                  >
                    {p.date.slice(5)}
                  </text>
                </g>
              );
            })}

          {/* Lines */}
          {daklakPath && <path d={daklakPath} fill="none" stroke="#f59e0b" strokeWidth="2.4" />}
          {lamdongPath && <path d={lamdongPath} fill="none" stroke="#c084fc" strokeWidth="1.6" />}
          {gialaiPath && <path d={gialaiPath} fill="none" stroke="#22d3ee" strokeWidth="1.6" />}
          {daknongPath && <path d={daknongPath} fill="none" stroke="#34d399" strokeWidth="1.6" />}
          {londonPath && (
            <path
              d={londonPath}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
          )}

          {/* Invisible interactive vertical slices */}
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
                      stroke="#9ca3af"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    {activeSeries.daklak && p.price_daklak && (
                      <circle cx={x} cy={getY(p.price_daklak)} r="4" fill="#f59e0b" />
                    )}
                    {activeSeries.londonConverted && p.londonConverted && (
                      <circle cx={x} cy={getY(p.londonConverted)} r="4" fill="#60a5fa" />
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-3 right-6 pointer-events-none p-3 rounded-xl bg-gray-950/95 border border-gray-700 shadow-xl text-xs space-y-1 backdrop-blur-md">
            <div className="font-bold text-gray-200 border-b border-gray-800 pb-1">
              Ngày: <span className="font-mono text-amber-400">{hoveredPoint.date}</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-300 font-mono">
              <span>Đắk Lắk:</span>
              <span className="font-bold">
                {hoveredPoint.price_daklak?.toLocaleString('vi-VN')} đ/kg
              </span>
            </div>
            {hoveredPoint.london_m1 && (
              <div className="flex justify-between gap-4 text-blue-300 font-mono text-2xs">
                <span>London M1:</span>
                <span>
                  ${hoveredPoint.london_m1} (≈{' '}
                  {Math.round(
                    ((hoveredPoint.london_m1 * (hoveredPoint.usd_vnd || 25500)) / 1000),
                  ).toLocaleString('vi-VN')}{' '}
                  đ/kg)
                </span>
              </div>
            )}
            {hoveredPoint.usd_vnd && (
              <div className="flex justify-between gap-4 text-gray-400 text-2xs font-mono">
                <span>Tỷ giá USD/VND:</span>
                <span>{hoveredPoint.usd_vnd.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
