'use client';

import React from 'react';
import { Flame, ShieldCheck } from 'lucide-react';
import { SignalHistoryPoint } from '../types';

interface SignalsTableProps {
  signals: SignalHistoryPoint[];
}

export const SignalsTable: React.FC<SignalsTableProps> = ({ signals }) => {
  if (!signals || signals.length === 0) {
    return null;
  }

  const recentSignals = [...signals].reverse().slice(0, 12);

  const renderRegimeLabel = (regime: string) => {
    switch (regime) {
      case 'BACKWARDATION_STRONG':
        return (
          <span className="inline-block px-2.5 py-1 rounded text-[14px] font-semibold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
            Hàng giao ngay khan hiếm <span className="font-normal text-[14px]">(Backwardation)</span>
          </span>
        );
      case 'BACKWARDATION_MILD':
        return (
          <span className="inline-block px-2.5 py-1 rounded text-[14px] font-semibold bg-[#ECF3EF] text-[#3F6A52] border border-[#86EFAC]">
            Khan hiếm nhẹ <span className="font-normal text-[14px]">(Backwardation)</span>
          </span>
        );
      case 'CONTANGO_STRONG':
        return (
          <span className="inline-block px-2.5 py-1 rounded text-[14px] font-semibold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
            Nguồn cung dồi dào <span className="font-normal text-[14px]">(Contango)</span>
          </span>
        );
      case 'CONTANGO_MILD':
        return (
          <span className="inline-block px-2.5 py-1 rounded text-[14px] font-semibold bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]">
            Nguồn cung ổn định <span className="font-normal text-[14px]">(Contango)</span>
          </span>
        );
      default:
        return (
          <span className="inline-block px-2.5 py-1 rounded text-[14px] font-semibold bg-[#F5F3EF] text-[#3F3F46] border border-[#E5E7EB]">
            {regime}
          </span>
        );
    }
  };

  return (
    <section
      aria-label="Tín hiệu định lượng và cảnh báo bất thường"
      className="bg-white rounded-xl p-5 sm:p-6 border border-[#E5E7EB] shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3.5">
        <div>
          <h2 className="font-serif text-[22px] text-[#111827] font-semibold">
            Tín hiệu Thị trường &amp; Cảnh báo Biến động
          </h2>
          <p className="text-[15px] text-[#52525B] mt-0.5">
            Theo dõi chênh lệch giá nội địa – London, chênh lệch kỳ hạn và cảnh báo biến động bất thường
          </p>
        </div>
        <span className="text-[14px] text-[#52525B] font-mono font-medium">12 phiên gần nhất</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px] sm:text-[15px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#FBF9F5] text-[#52525B] font-bold">
              <th className="py-3 px-3 whitespace-nowrap">Ngày</th>
              <th className="py-3 px-3 whitespace-nowrap">Chênh Nội địa – London</th>
              <th className="py-3 px-3 whitespace-nowrap">Chênh kỳ hạn (M1–M6)</th>
              <th className="py-3 px-3 whitespace-nowrap">Biến động 30 ngày</th>
              <th className="py-3 px-3 whitespace-nowrap">Z-Score</th>
              <th className="py-3 px-3 whitespace-nowrap">Tình trạng cung cầu</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">Cảnh báo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {recentSignals.map((s) => (
              <tr key={s.date} className="hover:bg-[#FDFCFB] transition-colors">
                <td className="py-3 px-3 font-mono font-semibold text-[#18181B] whitespace-nowrap">
                  {s.date}
                </td>
                <td
                  className={`py-3 px-3 font-mono font-semibold whitespace-nowrap ${
                    s.basis >= 0 ? 'text-[#166534]' : 'text-[#991B1B]'
                  }`}
                >
                  {s.basis > 0 ? '+' : ''}
                  {s.basis.toLocaleString('vi-VN')} đ/kg
                </td>
                <td className="py-3 px-3 font-mono text-[#27272A] whitespace-nowrap">
                  {s.spread != null ? `${s.spread > 0 ? '+' : ''}${s.spread} USD/tấn` : 'N/A'}
                </td>
                <td className="py-3 px-3 font-mono text-[#27272A] whitespace-nowrap">
                  {s.volatility_30d != null ? `${(s.volatility_30d * 100).toFixed(2)}%/ngày` : 'N/A'}
                </td>
                <td
                  className={`py-3 px-3 font-mono whitespace-nowrap ${
                    s.z_score != null && Math.abs(s.z_score) > 2.5
                      ? 'text-[#991B1B] font-bold'
                      : 'text-[#27272A]'
                  }`}
                >
                  {s.z_score != null ? s.z_score.toFixed(2) : 'N/A'}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{renderRegimeLabel(s.regime)}</td>
                <td className="py-3 px-3 text-center whitespace-nowrap">
                  {s.is_anomaly ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[14px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
                      <Flame className="w-4 h-4" /> Bất thường
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[14px] text-[#52525B]">
                      <ShieldCheck className="w-4 h-4 text-[#166534]" /> Bình thường
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
