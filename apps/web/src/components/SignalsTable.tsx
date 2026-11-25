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

  // Display most recent 12 days in reverse chronological order
  const recentSignals = [...signals].reverse().slice(0, 12);

  const getRegimeBadge = (regime: string) => {
    switch (regime) {
      case 'BACKWARDATION_STRONG':
        return (
          <span className="px-2 py-0.5 rounded text-2xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            BACKWARDATION_STRONG
          </span>
        );
      case 'BACKWARDATION_MILD':
        return (
          <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            BACKWARDATION_MILD
          </span>
        );
      case 'CONTANGO_STRONG':
        return (
          <span className="px-2 py-0.5 rounded text-2xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            CONTANGO_STRONG
          </span>
        );
      case 'CONTANGO_MILD':
        return (
          <span className="px-2 py-0.5 rounded text-2xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            CONTANGO_MILD
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-2xs font-bold bg-gray-500/10 text-gray-400 border border-gray-500/30">
            {regime}
          </span>
        );
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            ⚡ TÍN HIỆU THỊ TRƯỜNG & PHÁT HIỆN BẤT THƯỜNG
          </h3>
          <p className="text-xs text-gray-400">
            Theo dõi Basis, chênh lệch kỳ hạn Calendar Spread và cảnh báo độ lệch chuẩn (|Z| &gt; 2.5)
          </p>
        </div>
        <span className="text-xs text-gray-400 font-mono">12 phiên gần nhất</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 font-semibold">
              <th className="py-2 px-3">Ngày</th>
              <th className="py-2 px-3">Basis (Nội địa - London)</th>
              <th className="py-2 px-3">Calendar Spread (M1-M6)</th>
              <th className="py-2 px-3">Biến động 30N</th>
              <th className="py-2 px-3">Z-Score 30N</th>
              <th className="py-2 px-3">Trạng thái Thị trường</th>
              <th className="py-2 px-3 text-center">Cảnh báo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 font-mono">
            {recentSignals.map((s) => (
              <tr key={s.date} className="hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-gray-300">{s.date}</td>
                <td
                  className={`py-2.5 px-3 font-semibold ${
                    s.basis >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {s.basis > 0 ? '+' : ''}
                  {s.basis.toLocaleString('vi-VN')} đ/kg
                </td>
                <td className="py-2.5 px-3 text-gray-200">
                  {s.spread != null
                    ? `${s.spread > 0 ? '+' : ''}${s.spread} USD/tấn`
                    : 'N/A'}
                </td>
                <td className="py-2.5 px-3 text-gray-300">
                  {s.volatility_30d != null
                    ? `${(s.volatility_30d * 100).toFixed(2)}%/d`
                    : 'N/A'}
                </td>
                <td
                  className={`py-2.5 px-3 ${
                    s.z_score != null && Math.abs(s.z_score) > 2.5
                      ? 'text-rose-400 font-bold'
                      : 'text-gray-300'
                  }`}
                >
                  {s.z_score != null ? s.z_score.toFixed(2) : 'N/A'}
                </td>
                <td className="py-2.5 px-3">{getRegimeBadge(s.regime)}</td>
                <td className="py-2.5 px-3 text-center">
                  {s.is_anomaly ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                      <Flame className="w-3 h-3 text-rose-400" /> BẤT THƯỜNG
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-2xs text-gray-400">
                      <ShieldCheck className="w-3 h-3 text-gray-400" /> Bình thường
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
