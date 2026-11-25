'use client';

import React, { useState } from 'react';
import { TrendingUp, Info, HelpCircle } from 'lucide-react';
import { ForecastLatest, HorizonPrediction } from '../types';

interface ForecastFanChartProps {
  forecast: ForecastLatest | null;
}

export const ForecastFanChart: React.FC<ForecastFanChartProps> = ({ forecast }) => {
  const [hoveredPoint, setHoveredPoint] = useState<HorizonPrediction | null>(null);

  if (!forecast || !forecast.predictions || forecast.predictions.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-gray-900/60 border border-gray-800 text-center">
        <p className="text-gray-400 text-sm">Chưa có dữ liệu dự báo 6 tháng khả dụng.</p>
      </div>
    );
  }

  const predictions = forecast.predictions;
  const originPrice = forecast.origin_price_daklak || predictions[0].pred_p50;

  // Milestone points
  const p4 = predictions.find((p) => p.horizon_week === 4);
  const p12 = predictions.find((p) => p.horizon_week === 12);
  const p26 = predictions.find((p) => p.horizon_week === 26);

  // SVG Chart Geometry
  const width = 800;
  const height = 360;
  const padding = { top: 30, right: 40, bottom: 40, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Determine min & max Y
  const allValues = [
    originPrice,
    ...predictions.flatMap((p) => [
      p.pred_p10,
      p.pred_p50,
      p.pred_p90,
      p.baseline_rw || p.pred_p50,
      p.baseline_futures || p.pred_p50,
    ]),
  ].filter((v) => typeof v === 'number' && !isNaN(v));

  const minY = Math.floor(Math.min(...allValues) / 2000) * 2000 - 2000;
  const maxY = Math.ceil(Math.max(...allValues) / 2000) * 2000 + 2000;
  const yRange = maxY - minY;

  const getX = (index: number) => padding.left + (index / predictions.length) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - ((val - minY) / yRange) * chartHeight;

  // Build points including origin (x=0)
  const xOrigin = padding.left;
  const yOrigin = getY(originPrice);

  // Path for P90 (upper bound of fan)
  const p90Coords = predictions.map((p, i) => `${getX(i + 1)},${getY(p.pred_p90)}`);
  // Path for P10 (lower bound of fan)
  const p10Coords = predictions.map((p, i) => `${getX(i + 1)},${getY(p.pred_p10)}`).reverse();

  // Shaded area path
  const fanAreaD = `M ${xOrigin},${yOrigin} L ${p90Coords.join(' L ')} L ${p10Coords.join(
    ' L ',
  )} Z`;

  // Median P50 line path
  const p50D = `M ${xOrigin},${yOrigin} L ${predictions
    .map((p, i) => `${getX(i + 1)},${getY(p.pred_p50)}`)
    .join(' L ')}`;

  // Naive Random Walk baseline path
  const naiveD = `M ${xOrigin},${yOrigin} L ${predictions
    .map((p, i) => `${getX(i + 1)},${getY(p.baseline_rw || originPrice)}`)
    .join(' L ')}`;

  // Futures-Implied baseline path
  const futuresD = `M ${xOrigin},${yOrigin} L ${predictions
    .map((p, i) => `${getX(i + 1)},${getY(p.baseline_futures || p.pred_p50)}`)
    .join(' L ')}`;

  // Y-axis grid ticks (5 intervals)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => minY + pct * yRange);

  return (
    <div className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-xl space-y-5">
      {/* Header & Legends */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              🔮 NÓN XÁC SUẤT DỰ BÁO GIÁ CÀ PHÊ 6 THÁNG (26 TUẦN)
            </h2>
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {forecast.model_version}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Dự báo đa phân vị phân rã trực tiếp (Direct Multi-Horizon) kết hợp mô hình kinh lượng VECM và Gradient Boosting LightGBM
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-500/60 inline-block"></span>
            <span className="text-gray-300">Vùng tin cậy 80% (P10 - P90)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 bg-amber-400 inline-block"></span>
            <span className="text-gray-300 font-semibold">Dự báo Trung vị (P50)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 border-b-2 border-dashed border-blue-400 inline-block"></span>
            <span className="text-gray-400">Naive Random Walk</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 border-b-2 border-dotted border-emerald-400 inline-block"></span>
            <span className="text-gray-400">Futures-Implied</span>
          </div>
        </div>
      </div>

      {/* SVG Fan Chart Container */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[650px] select-none"
        >
          <defs>
            <linearGradient id="fanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.04" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines & Y-axis labels */}
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

          {/* X-axis ticks (Every 4 weeks) */}
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
                  stroke="#2d3748"
                  strokeWidth="0.8"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 16}
                  textAnchor="middle"
                  className="text-2xs font-mono fill-gray-400"
                >
                  T+{w}
                </text>
                {pred && (
                  <text
                    x={x}
                    y={height - padding.bottom + 28}
                    textAnchor="middle"
                    className="text-3xs fill-gray-400 font-mono"
                  >
                    {pred.target_date.slice(5)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Probabilistic Fan Area (P10 to P90) */}
          <path d={fanAreaD} fill="url(#fanGradient)" />
          <path d={`M ${p90Coords.join(' L ')}`} fill="none" stroke="#f59e0b" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 2" />
          <path d={`M ${p10Coords.join(' L ')}`} fill="none" stroke="#f59e0b" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 2" />

          {/* Baselines */}
          <path
            d={naiveD}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.6"
            strokeDasharray="5 4"
          />
          <path
            d={futuresD}
            fill="none"
            stroke="#34d399"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />

          {/* Median P50 Line */}
          <path
            d={p50D}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.8"
            filter="url(#glow)"
          />

          {/* Origin Point t0 */}
          <circle cx={xOrigin} cy={yOrigin} r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />

          {/* Interactive Hover Vertical Line & Markers */}
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
                {/* Invisible hover slice hit area */}
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
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                    />
                    <circle cx={x} cy={getY(p.pred_p90)} r="4" fill="#f59e0b" />
                    <circle cx={x} cy={getY(p.pred_p50)} r="5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
                    <circle cx={x} cy={getY(p.pred_p10)} r="4" fill="#f59e0b" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute top-4 right-6 pointer-events-none p-3 rounded-xl bg-gray-950/95 border border-amber-500/40 shadow-2xl text-xs space-y-1 backdrop-blur-md transition-all"
          >
            <div className="font-bold text-amber-400 border-b border-gray-800 pb-1">
              Tuần T+{hoveredPoint.horizon_week} ({hoveredPoint.target_date})
            </div>
            <div className="text-gray-200 flex justify-between gap-4">
              <span>Dự báo Trung vị (P50):</span>
              <span className="font-bold text-white font-mono">
                {Math.round(hoveredPoint.pred_p50).toLocaleString('vi-VN')} đ/kg
              </span>
            </div>
            <div className="text-gray-300 flex justify-between gap-4">
              <span>Dải phân vị (P10 - P90):</span>
              <span className="font-mono text-amber-300">
                {Math.round(hoveredPoint.pred_p10).toLocaleString('vi-VN')} -{' '}
                {Math.round(hoveredPoint.pred_p90).toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="text-gray-400 flex justify-between gap-4 pt-1 border-t border-gray-800 text-2xs">
              <span>Naive Random Walk:</span>
              <span className="font-mono text-blue-300">
                {hoveredPoint.baseline_rw ? Math.round(hoveredPoint.baseline_rw).toLocaleString('vi-VN') : 'N/A'} đ
              </span>
            </div>
            <div className="text-gray-400 flex justify-between gap-4 text-2xs">
              <span>Futures-Implied:</span>
              <span className="font-mono text-emerald-300">
                {hoveredPoint.baseline_futures ? Math.round(hoveredPoint.baseline_futures).toLocaleString('vi-VN') : 'N/A'} đ
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3 Strategic Milestone Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
        {/* 1 Month (Week 4) */}
        <div className="p-3.5 rounded-xl bg-gray-800/50 border border-gray-700/60 hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-bold text-amber-400">📅 1 THÁNG (TUẦN 4)</span>
            <span className="font-mono">{p4?.target_date}</span>
          </div>
          <div className="text-xl font-extrabold text-white font-mono">
            {p4 ? Math.round(p4.pred_p50).toLocaleString('vi-VN') : 'N/A'} <span className="text-xs text-gray-400">đ/kg</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Biên P10-P90:{' '}
            <span className="text-amber-200 font-mono">
              {p4 ? `${Math.round(p4.pred_p10).toLocaleString('vi-VN')} - ${Math.round(p4.pred_p90).toLocaleString('vi-VN')}` : 'N/A'}
            </span>
          </div>
        </div>

        {/* 3 Months (Week 12) */}
        <div className="p-3.5 rounded-xl bg-gray-800/50 border border-gray-700/60 hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-bold text-amber-400">📅 3 THÁNG (TUẦN 12)</span>
            <span className="font-mono">{p12?.target_date}</span>
          </div>
          <div className="text-xl font-extrabold text-white font-mono">
            {p12 ? Math.round(p12.pred_p50).toLocaleString('vi-VN') : 'N/A'} <span className="text-xs text-gray-400">đ/kg</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Biên P10-P90:{' '}
            <span className="text-amber-200 font-mono">
              {p12 ? `${Math.round(p12.pred_p10).toLocaleString('vi-VN')} - ${Math.round(p12.pred_p90).toLocaleString('vi-VN')}` : 'N/A'}
            </span>
          </div>
        </div>

        {/* 6 Months (Week 26) */}
        <div className="p-3.5 rounded-xl bg-gray-800/50 border border-gray-700/60 hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-bold text-amber-400">📅 6 THÁNG (TUẦN 26)</span>
            <span className="font-mono">{p26?.target_date}</span>
          </div>
          <div className="text-xl font-extrabold text-white font-mono">
            {p26 ? Math.round(p26.pred_p50).toLocaleString('vi-VN') : 'N/A'} <span className="text-xs text-gray-400">đ/kg</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Biên P10-P90:{' '}
            <span className="text-amber-200 font-mono">
              {p26 ? `${Math.round(p26.pred_p10).toLocaleString('vi-VN')} - ${Math.round(p26.pred_p90).toLocaleString('vi-VN')}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
