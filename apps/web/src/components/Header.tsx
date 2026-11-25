'use client';

import React, { useState } from 'react';
import { Coffee, RefreshCw, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import { triggerForecastJob } from '../lib/api';

interface HeaderProps {
  lastUpdated?: string;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ lastUpdated, onRefresh }) => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const handleTriggerForecast = async () => {
    setIsTriggering(true);
    setTriggerMessage(null);
    try {
      const result = await triggerForecastJob();
      if (result.success) {
        setTriggerMessage('Đã kích hoạt job dự báo thành công (Đang xử lý trong forecast-queue)!');
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
    <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center shadow-lg shadow-amber-900/30">
            <Coffee className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white tracking-tight">COFFEE TRACKER</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PROD v1.0
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Hệ thống Giám sát Thị trường Tây Nguyên & Dự báo Phân vị Giá Cà phê 6 Tháng
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center flex-wrap gap-2.5">
          {triggerMessage && (
            <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
              {triggerMessage}
            </span>
          )}

          {lastUpdated && (
            <div className="text-xs text-gray-400 hidden sm:block">
              Cập nhật: <span className="text-gray-200 font-mono">{lastUpdated}</span>
            </div>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleTriggerForecast}
            disabled={isTriggering}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-md ${
              isTriggering
                ? 'bg-amber-800 cursor-not-allowed opacity-70'
                : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-900/40'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
            <span>{isTriggering ? 'Đang kích hoạt...' : 'Chạy Dự báo Mới'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
