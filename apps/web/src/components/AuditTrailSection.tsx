'use client';

import React from 'react';
import { CheckCircle2, ShieldCheck, Database, Shield } from 'lucide-react';
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
    <section className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Kiểm định Mô hình Ngoài mẫu & Nhật ký Chạy (Audit Trail)
            </h3>
            <p className="text-xs text-stone-500">
              Sai số Walk-Forward CV trung thực (đơn vị %) và lịch sử các lượt chạy dự báo
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 text-xs font-mono self-start sm:self-auto">
          {latestForecast?.model_version || 'two_legged_walk_forward_v1'}
        </span>
      </div>

      {/* Validation Metrics Grid (wf_mape_* values are already stored in percentage points, e.g. 1.36 = 1.36%) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <span className="text-stone-500 block text-[11px] mb-0.5">WF MAPE 4 Tuần (1T)</span>
          <span className="text-lg font-extrabold text-stone-900 font-mono tabular-nums">
            {metrics?.wf_mape_4w != null ? `${metrics.wf_mape_4w.toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-[11px] text-stone-400 block mt-0.5">Sai số ngoài mẫu</span>
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <span className="text-stone-500 block text-[11px] mb-0.5">WF MAPE 12 Tuần (3T)</span>
          <span className="text-lg font-extrabold text-stone-900 font-mono tabular-nums">
            {metrics?.wf_mape_12w != null ? `${metrics.wf_mape_12w.toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-[11px] text-stone-400 block mt-0.5">Sai số ngoài mẫu</span>
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <span className="text-stone-500 block text-[11px] mb-0.5">WF MAPE 26 Tuần (6T)</span>
          <span className="text-lg font-extrabold text-stone-900 font-mono tabular-nums">
            {metrics?.wf_mape_26w != null ? `${metrics.wf_mape_26w.toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-[11px] text-stone-400 block mt-0.5">Sai số ngoài mẫu</span>
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <span className="text-stone-500 block text-[11px] mb-0.5">Pinball Loss</span>
          <span className="text-lg font-extrabold text-amber-800 font-mono tabular-nums">
            {metrics?.pinball_loss != null ? metrics.pinball_loss.toFixed(4) : 'N/A'}
          </span>
          <span className="text-[11px] text-stone-400 block mt-0.5">Phân vị 0.1 / 0.5 / 0.9</span>
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-stone-500 block text-[11px] mb-0.5">So với Naive Random Walk</span>
          <div className="my-auto py-1">
            {metrics?.beats_naive_baseline ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> Vượt trội (Đạt)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                <ShieldCheck className="w-4 h-4" /> Chưa vượt qua (Trung thực)
              </span>
            )}
          </div>
          <span className="text-[11px] text-stone-400 block">Walk-Forward CV</span>
        </div>
      </div>

      {/* Historical Forecast Runs Table */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-amber-800" />
          <span>Lịch sử Đợt Chạy Dự báo gần nhất</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                <th className="py-2 px-3">Run ID</th>
                <th className="py-2 px-3">Ngày Dự báo</th>
                <th className="py-2 px-3">Trạng thái</th>
                <th className="py-2 px-3">Số Tuần</th>
                <th className="py-2 px-3">Thời điểm Tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {runsData?.runs && runsData.runs.length > 0 ? (
                runsData.runs.map((r) => (
                  <tr key={r.run_id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-2 px-3 text-amber-900">{r.run_id.slice(0, 8)}...</td>
                    <td className="py-2 px-3 text-stone-800">{r.forecast_date}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          r.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-stone-700">{r.predictions_count} / 26 tuần</td>
                    <td className="py-2 px-3 text-stone-500 text-[11px]">
                      {new Date(r.created_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-center text-stone-400 font-sans">
                    Chưa có lịch sử chạy mô hình nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
