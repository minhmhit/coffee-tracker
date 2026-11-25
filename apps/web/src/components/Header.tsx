'use client';

import React, { useState } from 'react';
import { Coffee, RefreshCw, Play, Send } from 'lucide-react';
import { triggerForecastJob } from '../lib/api';

interface HeaderProps {
  lastUpdated?: string;
  onRefresh?: () => void;
  onOpenTelegramModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lastUpdated,
  onRefresh,
  onOpenTelegramModal,
}) => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const handleTriggerForecast = async () => {
    setIsTriggering(true);
    setTriggerMessage(null);
    try {
      const result = await triggerForecastJob();
      if (result.success) {
        setTriggerMessage('Đã kích hoạt tính toán dự báo mới (đang xử lý nền).');
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
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-800 flex items-center justify-center shadow-sm shrink-0">
            <Coffee className="w-5 h-5 text-amber-50" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                COFFEE TRACKER
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Tây Nguyên
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Giá cà phê hôm nay, thời tiết vùng trồng & phân tích thị trường minh bạch
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {triggerMessage && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
              {triggerMessage}
            </span>
          )}

          {lastUpdated && (
            <div className="text-xs text-stone-500 hidden lg:block mr-1">
              Làm mới: <span className="text-stone-800 font-mono">{lastUpdated}</span>
            </div>
          )}

          {onOpenTelegramModal && (
            <button
              type="button"
              onClick={onOpenTelegramModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nhận tin Telegram</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors border border-stone-200"
              title="Làm mới dữ liệu"
              aria-label="Làm mới dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleTriggerForecast}
            disabled={isTriggering}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors shadow-sm ${
              isTriggering
                ? 'bg-amber-700/60 cursor-not-allowed'
                : 'bg-amber-800 hover:bg-amber-900'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
            <span>{isTriggering ? 'Đang xử lý...' : 'Chạy Dự báo Mới'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
