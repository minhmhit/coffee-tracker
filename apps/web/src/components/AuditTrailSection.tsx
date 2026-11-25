'use client';

import React from 'react';
import { CheckCircle2, XCircle, ShieldCheck, Database, Award } from 'lucide-react';
import { ForecastLatest, ForecastRunsResponse } from '../types';

interface AuditTrailSectionProps {
  latestForecast: ForecastLatest | null;
  runsData: ForecastRunsResponse | null;
}

export const AuditTrailSection: React.FC<AuditTrailSectionProps> = ({
  latestForecast,
  runsData,
}) => {
  const metrics = latestForecast?.metrics;

  return (
    <div className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            🛡️ AUDIT TRAIL & KIỂM ĐỊNH MÔ HÌNH NGOÀI MẪU (OUT-OF-SAMPLE)
          </h3>
          <p className="text-xs text-gray-400">
            Minh bạch 100% chỉ số sai số kiểm toán Walk-Forward CV 12 mốc và lịch sử các lượt chạy mô hình
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
            Phiên bản: {latestForecast?.model_version || 'two_legged_walk_forward_v1'}
          </span>
        </div>
      </div>

      {/* Validation Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        {/* Metric 1: 4W MAPE */}
        <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/60">
          <span className="text-gray-400 block text-2xs mb-0.5">WF MAPE 4 Tuần (1T):</span>
          <span className="text-lg font-extrabold text-white font-mono">
            {metrics?.wf_mape_4w != null ? `${(metrics.wf_mape_4w * 100).toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-3xs text-gray-400 block mt-0.5">Kiểm định ngoài mẫu</span>
        </div>

        {/* Metric 2: 12W MAPE */}
        <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/60">
          <span className="text-gray-400 block text-2xs mb-0.5">WF MAPE 12 Tuần (3T):</span>
          <span className="text-lg font-extrabold text-white font-mono">
            {metrics?.wf_mape_12w != null ? `${(metrics.wf_mape_12w * 100).toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-3xs text-gray-400 block mt-0.5">Kiểm định ngoài mẫu</span>
        </div>

        {/* Metric 3: 26W MAPE */}
        <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/60">
          <span className="text-gray-400 block text-2xs mb-0.5">WF MAPE 26 Tuần (6T):</span>
          <span className="text-lg font-extrabold text-white font-mono">
            {metrics?.wf_mape_26w != null ? `${(metrics.wf_mape_26w * 100).toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-3xs text-gray-400 block mt-0.5">Kiểm định ngoài mẫu</span>
        </div>

        {/* Metric 4: Pinball Loss */}
        <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/60">
          <span className="text-gray-400 block text-2xs mb-0.5">Multi-Quantile Pinball Loss:</span>
          <span className="text-lg font-extrabold text-amber-300 font-mono">
            {metrics?.pinball_loss != null ? metrics.pinball_loss.toFixed(4) : 'N/A'}
          </span>
          <span className="text-3xs text-gray-400 block mt-0.5">Alpha = 0.1, 0.5, 0.9</span>
        </div>

        {/* Metric 5: Beats Naive */}
        <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/60 flex flex-col justify-between">
          <span className="text-gray-400 block text-2xs mb-0.5">Vượt qua Naive Random Walk:</span>
          <div className="flex items-center space-x-1.5 my-auto">
            {metrics?.beats_naive_baseline ? (
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> ĐẠT (YES)
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-amber-400">
                <ShieldCheck className="w-4 h-4" /> BÁO CÁO TRUNG THỰC (NO)
              </span>
            )}
          </div>
          <span className="text-3xs text-gray-400 block mt-0.5">So sánh ngoài mẫu thực tế</span>
        </div>
      </div>

      {/* Historical Forecast Runs Table */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-amber-400" /> Lịch sử Đợt Chạy Dự báo (forecast_runs)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 font-semibold">
                <th className="py-2 px-3">Run ID</th>
                <th className="py-2 px-3">Ngày Dự báo</th>
                <th className="py-2 px-3">Trạng thái</th>
                <th className="py-2 px-3">Số Tuần Dự báo</th>
                <th className="py-2 px-3">Thời điểm Tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {runsData?.runs && runsData.runs.length > 0 ? (
                runsData.runs.map((r) => (
                  <tr key={r.run_id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 px-3 text-amber-300">{r.run_id.slice(0, 8)}...</td>
                    <td className="py-2 px-3 text-gray-200">{r.forecast_date}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-2xs font-bold ${
                          r.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{r.predictions_count} / 26 tuần</td>
                    <td className="py-2 px-3 text-gray-400 text-2xs">
                      {new Date(r.created_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-center text-gray-400">
                    Chưa có lịch sử chạy mô hình nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
