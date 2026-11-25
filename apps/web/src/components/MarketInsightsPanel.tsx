'use client';

import React from 'react';
import { InsightFactorCard, MarketInsightsResponse, OverallStance } from '../types';

interface MarketInsightsPanelProps {
  insights: MarketInsightsResponse | null;
}

const FACTOR_META: Record<
  string,
  {
    eyebrow: string;
    plainTitle?: string;
  }
> = {
  oil: {
    eyebrow: 'Vận tải Biển & Năng lượng',
  },
  inventory_supply: {
    eyebrow: 'Tồn kho & Nguồn cung Sàn London',
  },
  fx: {
    eyebrow: 'Tài chính Tiền tệ',
  },
  weather_climate: {
    eyebrow: 'Thời tiết & Khí hậu Tây Nguyên',
    plainTitle: 'Khí hậu & Lượng mưa Tây Nguyên',
  },
};

function getStanceStyles(stance: OverallStance): string {
  switch (stance) {
    case 'TÍCH CỰC':
      return 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]';
    case 'THẬN TRỌNG':
      return 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';
    default:
      return 'bg-[#F5F3EF] text-[#18181B] border-[#D4D4D8]';
  }
}

function getTrendBadgeStyles(trend: InsightFactorCard['trend']): string {
  if (trend === 'UP') {
    return 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]';
  }
  if (trend === 'DOWN') {
    return 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';
  }
  return 'bg-[#F5F3EF] text-[#18181B] border-[#D4D4D8]';
}

function toPlainVietnameseBadge(factor: InsightFactorCard): string {
  const raw = factor.badge_label || '';
  if (factor.key === 'inventory_supply') {
    if (raw.includes('BACKWARDATION')) {
      return 'Hàng giao ngay khan hiếm';
    }
    if (raw.includes('CONTANGO')) {
      return 'Nguồn cung giao ngay dồi dào';
    }
  }
  return raw;
}

function toPlainSummary(text: string): string {
  return text
    .replace(/\(backwardation\)/gi, '(hàng giao ngay khan hiếm)')
    .replace(/\(contango\)/gi, '(nguồn cung dồi dào)')
    .replace(/dự báo trung vị/gi, 'dự báo mức giá dự kiến');
}

function formatExplainText(text: string): string {
  return text
    .replace(/BACKWARDATION_STRONG:/gi, 'Hàng giao ngay khan hiếm (Backwardation):')
    .replace(/BACKWARDATION_MILD:/gi, 'Hàng giao ngay hơi khan hiếm (Backwardation nhẹ):')
    .replace(/CONTANGO_STRONG:/gi, 'Nguồn cung dồi dào (Contango):')
    .replace(/CONTANGO_MILD:/gi, 'Nguồn cung ổn định (Contango nhẹ):');
}

export const MarketInsightsPanel: React.FC<MarketInsightsPanelProps> = ({ insights }) => {
  if (!insights) {
    return (
      <section className="bg-white rounded-xl p-6 border border-[#E5E7EB] shadow-sm">
        <h2 className="font-serif text-[24px] text-[#111827] font-semibold">
          Nhận định Thị trường Hôm nay
        </h2>
        <p className="text-[16px] text-[#52525B] mt-2">
          Chưa tải được bản phân tích thị trường mới nhất.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Nhận định thị trường hôm nay" className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[14px] text-[#52525B] uppercase font-bold tracking-wider">
            Phân tích Cung cầu &amp; Vĩ mô
          </div>
          <h2 className="font-serif text-[24px] sm:text-[26px] text-[#111827] font-semibold">
            Nhận định Thị trường Hôm nay
          </h2>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[15px] font-bold border self-start md:self-auto ${getStanceStyles(
            insights.overall_stance,
          )}`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-current" />
          <span>Xu hướng chung: {insights.overall_stance}</span>
        </div>
      </div>

      {/* Executive Summary Banner */}
      <div className="p-5 sm:p-6 rounded-xl bg-white border border-[#E5E7EB] shadow-sm space-y-2 border-l-4 border-l-[#166534]">
        <span className="block text-[14px] text-[#166534] uppercase font-bold tracking-wider">
          Tóm tắt nhanh hôm nay
        </span>
        <p className="text-[16px] sm:text-[17px] text-[#18181B] leading-relaxed">
          {toPlainSummary(insights.executive_summary)}
        </p>
      </div>

      {/* 2x2 Real Factor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {insights.factors.map((factor) => {
          const meta = FACTOR_META[factor.key] || { eyebrow: 'Yếu tố Thị trường' };
          const displayTitle = meta.plainTitle || factor.title;
          const plainBadge = toPlainVietnameseBadge(factor);
          const isBackwardation =
            factor.key === 'inventory_supply' &&
            (factor.badge_label.includes('BACKWARDATION') ||
              String(factor.details?.regime || '').includes('BACKWARDATION'));

          return (
            <article
              key={factor.key}
              className="bg-white p-5 sm:p-6 rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] text-[#52525B] uppercase font-bold tracking-wide">
                    {meta.eyebrow}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded text-[14px] font-mono font-bold border whitespace-nowrap ${getTrendBadgeStyles(
                      factor.trend,
                    )}`}
                  >
                    {plainBadge}
                  </span>
                </div>

                <div>
                  <h3 className="font-serif text-[20px] text-[#111827] font-semibold">
                    {displayTitle}
                  </h3>
                  <div className="font-mono text-[22px] sm:text-[24px] text-[#111827] font-bold mt-1 tabular-nums">
                    {factor.metric_value}
                  </div>
                </div>

                <p className="text-[16px] text-[#27272A] leading-relaxed">
                  {formatExplainText(factor.explanation)}
                </p>
              </div>

              <div className="pt-3 border-t border-[#E5E7EB] space-y-1 text-[14px] text-[#3F3F46]">
                <div>
                  <strong className="text-[#166534]">Tác động giá cà phê: </strong>
                  <span>{factor.impact_on_coffee}</span>
                </div>
                <div className="font-mono text-[#52525B] flex flex-wrap items-center justify-between gap-2">
                  <span>Nguồn: {factor.metric_source}</span>
                  {isBackwardation && (
                    <span className="text-[#52525B]">(Backwardation: giá giao ngay cao hơn kỳ xa)</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
