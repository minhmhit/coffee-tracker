'use client';

import React, { useState } from 'react';
import { LineChart, ShieldCheck, Info } from 'lucide-react';
import {
  ForecastLatest,
  ForecastTransparencySummary,
  HorizonPrediction,
} from '../types';

interface ForecastFanChartProps {
  forecast: ForecastLatest | null;
  transparency?: ForecastTransparencySummary | null;
}

export const ForecastFanChart: React.FC<ForecastFanChartProps> = ({
  forecast,
  transparency,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<HorizonPrediction | null>(null);

  if (!forecast || !forecast.predictions || forecast.predictions.length === 0) {
    return (
      <section className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm text-center">
        <p className="text-stone-500 text-sm">Chưa có dữ liệu dự báo 6 tháng khả dụng.</p>
      </section>
    );
  }

  const predictions = forecast.predictions;
  const originPrice = forecast.origin_price_daklak || predictions[0].pred_p50;

  const p4 = predictions.find((p) => p.horizon_week === 4);
  const p12 = predictions.find((p) => p.horizon_week === 12);
  const p26 = predictions.find((p) => p.horizon_week === 26);

  // SVG Chart Geometry
  const width = 800;
  const height = 340;
  const padding = { top: 28, right: 36, bottom: 42, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allValues = [
    originPrice,
    ...predictions.flatMap((p) => [
      p.pred_p10,
      p.pred_p50,
      p.pred_p90,
      p.baseline_rw || p.pred_p50,
      p.baseline_futures || p.pred_p50,
    ]),
  ].filter((v) => typeof v === 'number' && !Number.isNaN(v));

  const minY = Math.floor(Math.min(...allValues) / 2000) * 2000 - 2000;
  const maxY = Math.ceil(Math.max(...allValues) / 2000) * 2000 + 2000;
  const yRange = maxY - minY || 1;

  const getX = (index: number) => padding.left + (index / predictions.length) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - ((val - minY) / yRange) * chartHeight;

  const xOrigin = padding.left;
  const yOrigin = getY(originPrice);

  const p90Coords = predictions.map((p, i) => `${getX(i + 1)},${getY(p.pred_p90)}`);
  const p10Coords = predictions.map((p, i) => `${getX(i + 1)},${getY(p.pred_p10)}`).reverse();

  const fanAreaD = `M ${xOrigin},${yOrigin} L ${p90Coords.join(' L ')} L ${p10Coords.join(
    ' L ',
  )} Z`;

  const p50D = `M ${xOrigin},${yOrigin} L ${predictions
    .map((p, i) => `${getX(i + 1)},${getY(p.pred_p50)}`)
    .join(' L ')}`;

  const naiveD = `M ${xOrigin},${yOrigin} L ${predictions
    .map((p, i) => `${getX(i + 1)},${getY(p.baseline_rw || originPrice)}`)
    .join(' L ')}`;

  const futuresD = `M ${xOrigin},${yOrigin} L ${predictions
    .map((p, i) => `${getX(i + 1)},${getY(p.baseline_futures || p.pred_p50)}`)
    .join(' L ')}`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => minY + pct * yRange);

  const calcDeltaPct = (target: number) => {
    if (!originPrice) return null;
    return ((target - originPrice) / originPrice) * 100;
  };

  const milestones = [
    { label: '1 Tháng (Tuần 4)', point: p4 },
    { label: '3 Tháng (Tuần 12)', point: p12 },
    { label: '6 Tháng (Tuần 26)', point: p26 },
  ];

  return (
    <section
      aria-label="Dự báo giá cà phê 6 tháng và minh bạch mô hình"
      className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-5"
    >
      {/* Header & Legends */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-stone-100 pb-3.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <LineChart className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                Dự báo Xác suất Giá Cà phê 6 Tháng (26 Tuần)
              </h2>
              {transparency?.direction_label && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                  {transparency.direction_label}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Biểu đồ dải phân vị P10–P90 (80% tin cậy) từ mô hình VECM + LightGBM Quantile
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-600/50 inline-block" />
            <span>Vùng 80% (P10–P90)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-700 inline-block" />
            <span className="font-semibold text-stone-800">Trung vị (P50)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-b-2 border-dashed border-blue-600 inline-block" />
            <span>Random Walk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-b-2 border-dotted border-emerald-600 inline-block" />
            <span>Futures-Implied</span>
          </div>
        </div>
      </div>

      {/* Plain-Language Forecast Transparency Callout */}
      {transparency?.available && (
        <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
              <Info className="w-3.5 h-3.5" />
              <span>Minh bạch Dự báo</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>{transparency.confidence_note}</span>
            </div>
          </div>

          <p className="text-sm text-stone-800 leading-relaxed">{transparency.summary}</p>

          {transparency.key_drivers && transparency.key_drivers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-stone-500">Yếu tố đầu vào chính:</span>
              {transparency.key_drivers.map((driver, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-white text-stone-700 border border-stone-200 px-2.5 py-1 rounded-lg"
                >
                  {driver}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SVG Fan Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[640px] select-none"
        >
          <defs>
            <linearGradient id="fanGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b45309" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Horizontal Y-grid */}
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

          {/* X-axis Ticks */}
          {[1, 4, 8, 12, 16, 20, 26].map((w) => {
            const pred = predictions.find((p) => p.horizon_week === w);
            const x = getX(w);
            return (
              <g key={w}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="#f5f5f4"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 16}
                  textAnchor="middle"
                  className="text-[11px] font-mono fill-stone-600"
                >
                  T+{w}
                </text>
                {pred && (
                  <text
                    x={x}
                    y={height - padding.bottom + 29}
                    textAnchor="middle"
                    className="text-[10px] fill-stone-400 font-mono"
                  >
                    {pred.target_date.slice(5)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Fan Area */}
          <path d={fanAreaD} fill="url(#fanGradientLight)" />
          <path
            d={`M ${p90Coords.join(' L ')}`}
            fill="none"
            stroke="#d97706"
            strokeOpacity="0.55"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <path
            d={`M ${p10Coords.join(' L ')}`}
            fill="none"
            stroke="#d97706"
            strokeOpacity="0.55"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />

          {/* Baselines */}
          <path
            d={naiveD}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.6"
            strokeDasharray="5 4"
          />
          <path
            d={futuresD}
            fill="none"
            stroke="#059669"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />

          {/* Median P50 */}
          <path d={p50D} fill="none" stroke="#b45309" strokeWidth="2.8" />

          {/* Origin Marker */}
          <circle cx={xOrigin} cy={yOrigin} r="4.5" fill="#b45309" stroke="#ffffff" strokeWidth="2" />

          {/* Interactive Hover Zones */}
          {predictions.map((p, i) => {
            const x = getX(i + 1);
            const isHovered = hoveredPoint?.horizon_week === p.horizon_week;
            return (
              <g
                key={p.horizon_week}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <rect
                  x={x - chartWidth / (predictions.length * 2)}
                  y={padding.top}
                  width={chartWidth / predictions.length}
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
                      stroke="#b45309"
                      strokeWidth="1.2"
                    />
                    <circle cx={x} cy={getY(p.pred_p90)} r="3.5" fill="#d97706" />
                    <circle
                      cx={x}
                      cy={getY(p.pred_p50)}
                      r="5"
                      fill="#ffffff"
                      stroke="#b45309"
                      strokeWidth="2.2"
                    />
                    <circle cx={x} cy={getY(p.pred_p10)} r="3.5" fill="#d97706" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Light Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-3 right-4 pointer-events-none p-3 rounded-xl bg-white/95 border border-amber-300 shadow-lg text-xs space-y-1 backdrop-blur-sm">
            <div className="font-bold text-amber-900 border-b border-stone-100 pb-1">
              Tuần T+{hoveredPoint.horizon_week} ({hoveredPoint.target_date})
            </div>
            <div className="text-stone-700 flex justify-between gap-4">
              <span>Trung vị (P50):</span>
              <span className="font-bold text-stone-900 font-mono">
                {Math.round(hoveredPoint.pred_p50).toLocaleString('vi-VN')} đ/kg
              </span>
            </div>
            <div className="text-stone-600 flex justify-between gap-4">
              <span>Biên P10–P90:</span>
              <span className="font-mono text-amber-800">
                {Math.round(hoveredPoint.pred_p10).toLocaleString('vi-VN')} –{' '}
                {Math.round(hoveredPoint.pred_p90).toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="text-stone-500 flex justify-between gap-4 pt-1 border-t border-stone-100 text-[11px]">
              <span>Random Walk:</span>
              <span className="font-mono text-blue-700">
                {hoveredPoint.baseline_rw
                  ? Math.round(hoveredPoint.baseline_rw).toLocaleString('vi-VN')
                  : 'N/A'}{' '}
                đ
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3 Milestone Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
        {milestones.map(({ label, point }) => {
          const deltaPct = point ? calcDeltaPct(point.pred_p50) : null;
          return (
            <div
              key={label}
              className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900">{label}</span>
                <span className="font-mono text-stone-500">{point?.target_date || '—'}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xl font-extrabold text-stone-900 font-mono tabular-nums">
                  {point ? Math.round(point.pred_p50).toLocaleString('vi-VN') : 'N/A'}{' '}
                  <span className="text-xs font-normal text-stone-500">đ/kg</span>
                </div>
                {deltaPct != null && (
                  <span
                    className={`text-xs font-semibold font-mono ${
                      deltaPct > 0.2
                        ? 'text-emerald-700'
                        : deltaPct < -0.2
                        ? 'text-rose-700'
                        : 'text-stone-600'
                    }`}
                  >
                    {deltaPct > 0 ? '+' : ''}
                    {deltaPct.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-xs text-stone-500">
                Biên P10–P90:{' '}
                <span className="text-stone-700 font-mono">
                  {point
                    ? `${Math.round(point.pred_p10).toLocaleString('vi-VN')} – ${Math.round(
                        point.pred_p90,
                      ).toLocaleString('vi-VN')}`
                    : 'N/A'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
