'use client';

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
      <section className="p-6 rounded-xl bg-white border border-[#E5E7EB] shadow-sm text-center">
        <p className="text-[#52525B] text-[16px]">Chưa có dữ liệu dự báo 6 tháng khả dụng.</p>
      </section>
    );
  }

  const predictions = forecast.predictions;
  const originPrice = forecast.origin_price_daklak || predictions[0].pred_p50;

  const p4 = predictions.find((p) => p.horizon_week === 4);
  const p12 = predictions.find((p) => p.horizon_week === 12);
  const p26 = predictions.find((p) => p.horizon_week === 26);

  // SVG Chart Geometry with roomy left margin for 14px axis labels
  const width = 880;
  const height = 340;
  const padding = { top: 28, right: 32, bottom: 48, left: 78 };
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
    {
      label: '1 Tháng tới',
      note: 'Tham khảo ngắn hạn theo tuần 4',
      point: p4,
    },
    {
      label: '3 Tháng tới',
      note: 'Tham khảo trung hạn theo tuần 12',
      point: p12,
    },
    {
      label: '6 Tháng tới',
      note: 'Tham khảo xu hướng dài hạn tuần 26',
      point: p26,
    },
  ];

  const mape4w =
    transparency?.metrics?.wf_mape_4w ?? forecast.metrics?.wf_mape_4w ?? null;
  const mape12w =
    transparency?.metrics?.wf_mape_12w ?? forecast.metrics?.wf_mape_12w ?? null;
  const mape26w =
    transparency?.metrics?.wf_mape_26w ?? forecast.metrics?.wf_mape_26w ?? null;

  return (
    <section
      aria-label="Dự báo giá cà phê 6 tháng"
      className="bg-white p-5 sm:p-6 rounded-xl border border-[#E5E7EB] shadow-sm space-y-5"
    >
      {/* Header & Plain-Vietnamese Legends */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-[14px] text-[#166534] uppercase font-bold tracking-wider">
            Ước tính Xu hướng Chu kỳ Thị trường
          </div>
          <h2 className="font-serif text-[24px] sm:text-[26px] text-[#111827] font-semibold">
            Dự báo Giá Cà phê 6 Tháng (26 Tuần)
          </h2>
        </div>

        {/* Legends - Senior Friendly Labels */}
        <div className="flex flex-wrap items-center gap-4 text-[14px] font-medium">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-[#3F6A52]/25 border border-[#3F6A52]/40 inline-block" />
            <span className="text-[#27272A]">Khoảng giá có thể dao động</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-1 bg-[#166534] rounded inline-block" />
            <span className="font-bold text-[#111827]">Mức giá dự kiến</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 border-t-2 border-dashed border-[#71717A] inline-block" />
            <span className="text-[#52525B]">Giá giữ nguyên hiện tại</span>
          </div>
        </div>
      </div>

      {/* SVG Fan Chart Container */}
      <div className="relative w-full bg-[#FBF9F5] rounded-xl p-3 sm:p-4 border border-[#E5E7EB] overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[620px] select-none"
          role="img"
          aria-label="Biểu đồ dự báo giá cà phê 26 tuần với khoảng dao động"
        >
          <defs>
            <linearGradient id="forestFanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#166534" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#166534" stopOpacity="0.28" />
            </linearGradient>
          </defs>

          {/* Horizontal Y-grid & LEFT Y-axis labels (>= 14px) */}
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

          {/* X-axis Timeline Markers (>= 14px) */}
          {[
            { week: 0, label: 'Hôm nay' },
            { week: 4, label: '1 Tháng' },
            { week: 12, label: '3 Tháng' },
            { week: 18, label: '4,5 Tháng' },
            { week: 26, label: '6 Tháng' },
          ].map((tick) => {
            const pred = predictions.find((p) => p.horizon_week === tick.week);
            const x = tick.week === 0 ? xOrigin : getX(tick.week);
            return (
              <g key={tick.week}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 20}
                  textAnchor="middle"
                  className="font-sans text-[14px] font-semibold fill-[#27272A]"
                >
                  {tick.label}
                </text>
                {pred && (
                  <text
                    x={x}
                    y={height - padding.bottom + 38}
                    textAnchor="middle"
                    className="font-mono text-[14px] fill-[#52525B]"
                  >
                    {pred.target_date.slice(5).replace('-', '/')}
                  </text>
                )}
              </g>
            );
          })}

          {/* Shaded Uncertainty Band */}
          <path d={fanAreaD} fill="url(#forestFanGrad)" />

          {/* Reference Lines */}
          <path
            d={naiveD}
            fill="none"
            stroke="#71717A"
            strokeWidth="1.6"
            strokeDasharray="5 4"
          />
          <path
            d={futuresD}
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeDasharray="2 4"
          />

          {/* Primary Forecast Line: 3px Thick Forest Green (#166534) */}
          <path
            d={p50D}
            fill="none"
            stroke="#166534"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Origin Dot + Key Milestone Markers */}
          <circle cx={xOrigin} cy={yOrigin} r="5" fill="#111827" stroke="#ffffff" strokeWidth="2" />
          {[p4, p12, p26].map(
            (pt) =>
              pt && (
                <circle
                  key={pt.horizon_week}
                  cx={getX(pt.horizon_week)}
                  cy={getY(pt.pred_p50)}
                  r="4.5"
                  fill="#166534"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              ),
          )}

          {/* Touch & Hover Interactive Zones */}
          {predictions.map((p, i) => {
            const x = getX(i + 1);
            const isHovered = hoveredPoint?.horizon_week === p.horizon_week;
            return (
              <g
                key={p.horizon_week}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(p)}
                onClick={() => setHoveredPoint(p)}
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
                      stroke="#166534"
                      strokeWidth="1.5"
                    />
                    <circle cx={x} cy={getY(p.pred_p90)} r="4" fill="#3F6A52" />
                    <circle
                      cx={x}
                      cy={getY(p.pred_p50)}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#166534"
                      strokeWidth="2.5"
                    />
                    <circle cx={x} cy={getY(p.pred_p10)} r="4" fill="#3F6A52" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip Overlay */}
        {hoveredPoint && (
          <div className="mt-3 sm:mt-0 sm:absolute sm:top-4 sm:right-4 p-3.5 rounded-xl bg-white border border-[#86EFAC] shadow-md text-[14px] space-y-1">
            <div className="font-bold text-[#166534] border-b border-[#E5E7EB] pb-1">
              Tuần T+{hoveredPoint.horizon_week} ({hoveredPoint.target_date})
            </div>
            <div className="flex justify-between gap-4 text-[#18181B]">
              <span>Mức giá dự kiến:</span>
              <span className="font-bold font-mono">
                {Math.round(hoveredPoint.pred_p50).toLocaleString('vi-VN')} đ/kg
              </span>
            </div>
            <div className="flex justify-between gap-4 text-[#3F3F46]">
              <span>Khoảng dao động:</span>
              <span className="font-mono font-semibold text-[#166534]">
                {Math.round(hoveredPoint.pred_p10).toLocaleString('vi-VN')} –{' '}
                {Math.round(hoveredPoint.pred_p90).toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3 Strategic Milestone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {milestones.map(({ label, note, point }) => {
          const deltaPct = point ? calcDeltaPct(point.pred_p50) : null;
          return (
            <div
              key={label}
              className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[16px] text-[#111827] font-bold">{label}</span>
                <span className="font-mono text-[14px] text-[#166534] font-bold">
                  {point?.target_date || '—'}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono text-[24px] text-[#111827] font-bold tabular-nums">
                  {point ? Math.round(point.pred_p50).toLocaleString('vi-VN') : 'N/A'}{' '}
                  <span className="text-[15px] font-normal text-[#52525B]">đ/kg</span>
                </div>
                {deltaPct != null && (
                  <span
                    className={`text-[14px] font-mono font-bold ${
                      deltaPct > 0.2
                        ? 'text-[#166534]'
                        : deltaPct < -0.2
                        ? 'text-[#991B1B]'
                        : 'text-[#52525B]'
                    }`}
                  >
                    {deltaPct > 0 ? '+' : ''}
                    {deltaPct.toFixed(1)}%
                  </span>
                )}
              </div>

              <div className="font-mono text-[14px] text-[#27272A] font-semibold">
                Dao động:{' '}
                <span className="text-[#166534] font-bold">
                  {point
                    ? `${Math.round(point.pred_p10).toLocaleString('vi-VN')} – ${Math.round(
                        point.pred_p90,
                      ).toLocaleString('vi-VN')} đ`
                    : 'N/A'}
                </span>
              </div>

              <p className="text-[14px] text-[#52525B] pt-0.5">{note}</p>
            </div>
          );
        })}
      </div>

      {/* Model Transparency Box: Strictly 3 Short Scannable Bullets >= 16px */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#F5F3EF] border border-[#E5E7EB] border-l-4 border-l-[#166534] space-y-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#166534]" />
          <h3 className="text-[16px] text-[#111827] uppercase tracking-wide font-bold">
            Công bố Tính minh bạch Của Dự báo
          </h3>
        </div>

        <ul className="space-y-2 text-[16px] text-[#27272A] leading-relaxed">
          <li className="flex items-start gap-2.5">
            <span className="text-[#166534] font-bold leading-none mt-1">•</span>
            <div>
              <strong className="text-[#111827]">Dữ liệu đầu vào:</strong> Tổng hợp giá cà phê Tây
              Nguyên hằng ngày, giá sàn quốc tế London, tồn kho thế giới, tỷ giá USD/VND và thời
              tiết vùng trồng.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-[#166534] font-bold leading-none mt-1">•</span>
            <div>
              <strong className="text-[#111827]">Sai số kiểm định thực tế 1 năm qua:</strong>{' '}
              {mape4w != null && mape12w != null && mape26w != null ? (
                <>
                  Mốc 1 tháng đạt <strong className="text-[#166534]">{mape4w.toFixed(2)}%</strong>, 3
                  tháng đạt <strong className="text-[#166534]">{mape12w.toFixed(2)}%</strong>, 6
                  tháng đạt <strong className="text-[#166534]">{mape26w.toFixed(2)}%</strong>.
                </>
              ) : (
                'Đang cập nhật số liệu kiểm định.'
              )}
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-[#166534] font-bold leading-none mt-1">•</span>
            <div>
              <strong className="text-[#111827]">Lưu ý tham khảo:</strong> Mức giá dự kiến và
              khoảng dao động giúp bà con tham khảo kế hoạch bán hàng hoặc lưu kho — không phải cam
              kết giá thu mua thực tế.
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
};
