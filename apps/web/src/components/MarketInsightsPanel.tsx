'use client';

import React from 'react';
import {
  Flame,
  PackageCheck,
  DollarSign,
  CloudRain,
  TrendingUp,
  TrendingDown,
  Minus,
  Compass,
} from 'lucide-react';
import { InsightFactorCard, MarketInsightsResponse, OverallStance } from '../types';

interface MarketInsightsPanelProps {
  insights: MarketInsightsResponse | null;
}

const FACTOR_ICON_MAP: Record<string, React.ReactNode> = {
  oil: <Flame className="w-4 h-4 text-amber-700" />,
  inventory_supply: <PackageCheck className="w-4 h-4 text-emerald-700" />,
  fx: <DollarSign className="w-4 h-4 text-sky-700" />,
  weather_climate: <CloudRain className="w-4 h-4 text-indigo-700" />,
};

function getStanceBadge(stance: OverallStance) {
  switch (stance) {
    case 'TÍCH CỰC':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'THẬN TRỌNG':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    default:
      return 'bg-amber-50 text-amber-900 border-amber-200';
  }
}

function getTrendBadge(trend: InsightFactorCard['trend']) {
  if (trend === 'UP') {
    return {
      classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: <TrendingUp className="w-3 h-3" />,
    };
  }
  if (trend === 'DOWN') {
    return {
      classes: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: <TrendingDown className="w-3 h-3" />,
    };
  }
  return {
    classes: 'bg-stone-100 text-stone-700 border-stone-200',
    icon: <Minus className="w-3 h-3" />,
  };
}

export const MarketInsightsPanel: React.FC<MarketInsightsPanelProps> = ({ insights }) => {
  if (!insights) {
    return (
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-stone-900">
          Nhận định Thị trường & Yếu tố Dẫn dắt
        </h2>
        <p className="text-sm text-stone-500 mt-2">
          Chưa tải được bản phân tích nhận định thị trường mới nhất.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Nhận định thị trường chi tiết"
      className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5 sm:p-6 space-y-5"
    >
      {/* Header & Overall Stance */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">
              Nhận định Thị trường Chi tiết
            </h2>
            <p className="text-xs text-stone-500">
              Tổng hợp định lượng từ Giá dầu, Tồn kho ICE Robusta, Tỷ giá USD/VND & Thời tiết Tây Nguyên
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${getStanceBadge(
              insights.overall_stance,
            )}`}
          >
            Xu hướng: {insights.overall_stance}
          </span>
          {insights.as_of_date && (
            <span className="text-xs font-mono text-stone-500">{insights.as_of_date}</span>
          )}
        </div>
      </div>

      {/* Executive Summary Callout */}
      <div className="rounded-r-xl bg-amber-50/70 border-l-4 border-amber-700 px-4 py-3.5 text-sm text-stone-800 leading-relaxed">
        {insights.executive_summary}
      </div>

      {/* 4 Key Market Factor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.factors.map((factor) => {
          const trendStyle = getTrendBadge(factor.trend);
          return (
            <article
              key={factor.key}
              className="rounded-xl bg-stone-50/70 border border-stone-200 p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2.5">
                {/* Title & Trend Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center shrink-0">
                      {FACTOR_ICON_MAP[factor.key] || <Compass className="w-4 h-4 text-stone-600" />}
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">{factor.title}</h3>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${trendStyle.classes}`}
                  >
                    {trendStyle.icon}
                    <span>{factor.badge_label}</span>
                  </span>
                </div>

                {/* Primary Metric */}
                <div>
                  <div className="text-base sm:text-lg font-extrabold text-stone-900 font-mono tabular-nums">
                    {factor.metric_value}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">{factor.metric_source}</div>
                </div>

                {/* Plain Explanation */}
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  {factor.explanation}
                </p>
              </div>

              {/* Impact Footer */}
              <div className="pt-2.5 border-t border-stone-200/80 text-xs text-stone-700">
                <span className="font-semibold text-amber-900">Tác động cà phê: </span>
                {factor.impact_on_coffee}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
