'use client';

import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { ForecastLatest, ForecastRunsResponse } from '../types';
import { triggerForecastJob } from '../lib/api';

interface AuditTrailSectionProps {
  latestForecast: ForecastLatest | null;
  runsData: ForecastRunsResponse | null;
  onRefresh?: () => void;
}

export const AuditTrailSection: React.FC<AuditTrailSectionProps> = ({
  latestForecast,
  runsData,
  onRefresh,
}) => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const metrics = latestForecast?.metrics;

  const handleManualForecast = async () => {
    setIsTriggering(true);
    setTriggerMessage(null);
    try {
      const result = await triggerForecastJob();
      if (result.success) {
        setTriggerMessage('Đã gửi yêu cầu tính toán dự báo mới (đang xử lý nền).');
        setTimeout(() => {
          setTriggerMessage(null);
          if (onRefresh) onRefresh();
        }, 5000);
      } else {
        setTriggerMessage(`Không thể kích hoạt: ${result.message}`);
      }
    } catch (err: any) {
      setTriggerMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <section
      aria-label="Kiểm định mô hình và nhật ký chạy"
      className="bg-white rounded-xl p-5 sm:p-6 border border-[#E5E7EB] shadow-sm space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <div>
          <h3 className="font-serif text-[22px] text-[#111827] font-semibold">
            Kiểm định Mô hình Ngoài mẫu &amp; Nhật ký Hệ thống
          </h3>
          <p className="text-[15px] text-[#52525B] mt-0.5">
            Báo cáo trung thực sai số kiểm định Walk-Forward CV 1 năm và lịch sử các lần chạy dự báo
          </p>
        </div>

        <span className="px-3 py-1 rounded-lg bg-[#F5F3EF] text-[#27272A] border border-[#E5E7EB] text-[14px] font-mono self-start sm:self-auto">
          Phiên bản: {latestForecast?.model_version || 'two_legged_walk_forward_v1'}
        </span>
      </div>

      {/* Validation Metrics Grid (wf_mape_* values in forecast_runs are already percentage numbers, e.g. 1.36 = 1.36%) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB]">
          <span className="text-[#52525B] block text-[14px] font-medium">Sai số 4 tuần (1T)</span>
          <span className="font-mono text-[22px] font-bold text-[#111827] tabular-nums block mt-1">
            {metrics?.wf_mape_4w != null ? `${metrics.wf_mape_4w.toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-[14px] text-[#52525B] block mt-0.5">WF MAPE ngoài mẫu</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB]">
          <span className="text-[#52525B] block text-[14px] font-medium">Sai số 12 tuần (3T)</span>
          <span className="font-mono text-[22px] font-bold text-[#111827] tabular-nums block mt-1">
            {metrics?.wf_mape_12w != null ? `${metrics.wf_mape_12w.toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-[14px] text-[#52525B] block mt-0.5">WF MAPE ngoài mẫu</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB]">
          <span className="text-[#52525B] block text-[14px] font-medium">Sai số 26 tuần (6T)</span>
          <span className="font-mono text-[22px] font-bold text-[#111827] tabular-nums block mt-1">
            {metrics?.wf_mape_26w != null ? `${metrics.wf_mape_26w.toFixed(2)}%` : 'N/A'}
          </span>
          <span className="text-[14px] text-[#52525B] block mt-0.5">WF MAPE ngoài mẫu</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB]">
          <span className="text-[#52525B] block text-[14px] font-medium">Pinball Loss</span>
          <span className="font-mono text-[22px] font-bold text-[#166534] tabular-nums block mt-1">
            {metrics?.pinball_loss != null ? metrics.pinball_loss.toFixed(4) : 'N/A'}
          </span>
          <span className="text-[14px] text-[#52525B] block mt-0.5">Đánh giá dải dao động</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <span className="text-[#52525B] block text-[14px] font-medium">
            So với đường giữ nguyên giá
          </span>
          <div className="my-1.5">
            {metrics?.beats_naive_baseline ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-[15px] text-[#166534]">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Vượt trội (Đạt)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-bold text-[15px] text-[#78350F]">
                <ShieldCheck className="w-4 h-4 shrink-0" /> Chưa vượt qua (Trung thực)
              </span>
            )}
          </div>
          <span className="text-[14px] text-[#52525B]">Kiểm định 1 năm</span>
        </div>
      </div>

      {/* Historical Forecast Runs Table */}
      <div className="space-y-2.5">
        <h4 className="text-[15px] font-bold text-[#18181B]">
          Lịch sử các lần chạy mô hình dự báo
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] font-mono">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FBF9F5] text-[#52525B] font-bold font-sans">
                <th className="py-2.5 px-3 whitespace-nowrap">Mã lượt chạy</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Ngày gốc dự báo</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Trạng thái</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Số tuần</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Thời điểm tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {runsData?.runs && runsData.runs.length > 0 ? (
                runsData.runs.map((r) => (
                  <tr key={r.run_id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="py-2.5 px-3 text-[#27272A] whitespace-nowrap">
                      {r.run_id.slice(0, 8)}...
                    </td>
                    <td className="py-2.5 px-3 text-[#111827] font-semibold whitespace-nowrap">
                      {r.forecast_date}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[14px] font-bold border ${
                          r.status === 'SUCCESS'
                            ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]'
                            : 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#27272A] whitespace-nowrap">
                      {r.predictions_count} / 26 tuần
                    </td>
                    <td className="py-2.5 px-3 text-[#52525B] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-center text-[#52525B] font-sans">
                    Chưa có lịch sử chạy mô hình nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Relocated Subtle Secondary Forecast Trigger (Hard Override 1) */}
      <div className="pt-3 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px] text-[#52525B]">
        <span>
          {triggerMessage || 'Hệ thống tự động cập nhật dự báo định kỳ vào sáng Thứ Hai hằng tuần.'}
        </span>
        <button
          type="button"
          onClick={handleManualForecast}
          disabled={isTriggering}
          className="inline-flex items-center gap-1.5 text-[#166534] font-semibold hover:underline disabled:opacity-60 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isTriggering ? 'animate-spin' : ''}`} />
          <span>{isTriggering ? 'Đang kích hoạt...' : 'Yêu cầu chạy lại dự báo thủ công'}</span>
        </button>
      </div>
    </section>
  );
};
