'use client';

import React from 'react';
import { Flame, ShieldCheck, Activity } from 'lucide-react';
import { SignalHistoryPoint } from '../types';

interface SignalsTableProps {
  signals: SignalHistoryPoint[];
}

export const SignalsTable: React.FC<SignalsTableProps> = ({ signals }) => {
  if (!signals || signals.length === 0) {
    return null;
  }

  const recentSignals = [...signals].reverse().slice(0, 12);

  const getRegimeBadge = (regime: string) => {
    switch (regime) {
      case 'BACKWARDATION_STRONG':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
            BACKWARDATION_STRONG
          </span>
        );
      case 'BACKWARDATION_MILD':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            BACKWARDATION_MILD
          </span>
        );
      case 'CONTANGO_STRONG':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            CONTANGO_STRONG
          </span>
        );
      case 'CONTANGO_MILD':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
            CONTANGO_MILD
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            {regime}
          </span>
        );
    }
  };

  return (
    <section className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Tín hiệu Định lượng & Cảnh báo Bất thường
            </h3>
            <p className="text-xs text-stone-500">
              Chênh lệch Basis nội địa–London, Calendar Spread (M1–M6) và kiểm tra biến động |Z| &gt; 2.5
            </p>
          </div>
        </div>
        <span className="text-xs text-stone-500 font-mono">12 phiên gần nhất</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500 font-semibold">
              <th className="py-2.5 px-3">Ngày</th>
              <th className="py-2.5 px-3">Basis (Nội địa – London)</th>
              <th className="py-2.5 px-3">Calendar Spread</th>
              <th className="py-2.5 px-3">Biến động 30N</th>
              <th className="py-2.5 px-3">Z-Score 30N</th>
              <th className="py-2.5 px-3">Trạng thái</th>
              <th className="py-2.5 px-3 text-center">Cảnh báo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-mono">
            {recentSignals.map((s) => (
              <tr key={s.date} className="hover:bg-stone-50 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-stone-800">{s.date}</td>
                <td
                  className={`py-2.5 px-3 font-semibold ${
                    s.basis >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {s.basis > 0 ? '+' : ''}
                  {s.basis.toLocaleString('vi-VN')} đ/kg
                </td>
                <td className="py-2.5 px-3 text-stone-700">
                  {s.spread != null ? `${s.spread > 0 ? '+' : ''}${s.spread} USD/tấn` : 'N/A'}
                </td>
                <td className="py-2.5 px-3 text-stone-700">
                  {s.volatility_30d != null ? `${(s.volatility_30d * 100).toFixed(2)}%/d` : 'N/A'}
                </td>
                <td
                  className={`py-2.5 px-3 ${
                    s.z_score != null && Math.abs(s.z_score) > 2.5
                      ? 'text-rose-700 font-bold'
                      : 'text-stone-700'
                  }`}
                >
                  {s.z_score != null ? s.z_score.toFixed(2) : 'N/A'}
                </td>
                <td className="py-2.5 px-3">{getRegimeBadge(s.regime)}</td>
                <td className="py-2.5 px-3 text-center">
                  {s.is_anomaly ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      <Flame className="w-3 h-3 text-rose-600" /> Bất thường
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                      <ShieldCheck className="w-3 h-3 text-stone-400" /> Bình thường
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
