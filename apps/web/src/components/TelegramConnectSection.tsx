'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Send,
  Copy,
  Check,
  ExternalLink,
  Bell,
  ChevronDown,
  ChevronUp,
  Terminal,
  X,
} from 'lucide-react';
import { TelegramOnboardingInfo } from '../types';

interface TelegramConnectSectionProps {
  info: TelegramOnboardingInfo | null;
  onClose?: () => void;
  isModal?: boolean;
}

const DEFAULT_COMMANDS = [
  { command: '/start', description: 'Đăng ký nhận điểm tin tự động lúc 06:00 sáng hằng ngày' },
  { command: '/today', description: 'Xem ngay giá cà phê, thời tiết & nhận định thị trường hôm nay' },
  { command: '/stop', description: 'Tạm dừng nhận thông báo tự động' },
];

export const TelegramConnectSection: React.FC<TelegramConnectSectionProps> = ({
  info,
  onClose,
  isModal = false,
}) => {
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const botUsername = info?.botUsername || 'minhmh_coffee_tracker_bot';
  const deepLink = info?.deepLink || `https://t.me/${botUsername}?start=subscribe`;
  const commands = info?.commands && info.commands.length > 0 ? info.commands : DEFAULT_COMMANDS;
  const scheduleText = info?.briefingSchedule || '06:00 sáng hằng ngày (Giờ Việt Nam UTC+7)';

  useEffect(() => {
    let active = true;
    QRCode.toString(deepLink, {
      type: 'svg',
      width: 172,
      margin: 2,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
    })
      .then((svg) => {
        if (active) setQrSvg(svg);
      })
      .catch((err) => {
        console.error('QR generation failed:', err);
      });

    return () => {
      active = false;
    };
  }, [deepLink]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored in restricted clipboard environments
    }
  };

  return (
    <section
      aria-label="Kết nối Bot Telegram"
      className={`rounded-2xl bg-white border border-stone-200 ${
        isModal ? 'shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto' : 'shadow-sm'
      } p-5 sm:p-6 space-y-5`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                Nhận Điểm tin Giá Cà phê 06:00 Sáng qua Telegram
              </h2>
              {info && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {info.activeSubscribersCount} người đã kết nối
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-700" />
              <span>Lịch gửi tự động: {scheduleText}</span>
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn Telegram"
            className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 3-Step Guide + CTA + Commands */}
        <div className="lg:col-span-8 space-y-4">
          {/* 3-Step Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3.5">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Bước 1
              </span>
              <div className="font-semibold text-sm text-stone-900 mt-1">Mở Bot Telegram</div>
              <p className="text-xs text-stone-600 mt-1">
                Nhấn nút bên dưới hoặc dùng camera điện thoại quét mã QR.
              </p>
            </div>

            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3.5">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Bước 2
              </span>
              <div className="font-semibold text-sm text-stone-900 mt-1">Bấm Start (/start)</div>
              <p className="text-xs text-stone-600 mt-1">
                Gửi lệnh <code className="font-mono bg-stone-200/70 px-1 rounded">/start</code> để xác nhận đăng ký kênh cá nhân.
              </p>
            </div>

            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3.5">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Bước 3
              </span>
              <div className="font-semibold text-sm text-stone-900 mt-1">Nhận tin 06:00 sáng</div>
              <p className="text-xs text-stone-600 mt-1">
                Tự động nhận giá Đắk Lắk, thời tiết Tây Nguyên & nhận định thị trường.
              </p>
            </div>
          </div>

          {/* CTA Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Mở Bot @{botUsername}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold border border-stone-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Đã sao chép link</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép liên kết</span>
                </>
              )}
            </button>
          </div>

          {/* Commands Quick Reference */}
          <div className="rounded-xl bg-stone-50 border border-stone-200/90 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
              <Terminal className="w-3.5 h-3.5 text-stone-500" />
              <span>Các lệnh hỗ trợ trên Bot:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {commands.map((cmd) => (
                <div key={cmd.command} className="text-xs">
                  <code className="font-mono font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                    {cmd.command}
                  </code>
                  <p className="text-stone-600 mt-1 text-[11px] leading-snug">{cmd.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Expandable Live Sample Briefing Preview */}
          {info?.sampleMessagePreview && (
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPreview((prev) => !prev)}
                className="w-full px-4 py-2.5 bg-stone-50 hover:bg-stone-100 flex items-center justify-between text-xs font-semibold text-stone-800 transition-colors"
              >
                <span>Xem trước mẫu bản tin 06:00 sáng (dữ liệu thực tế hôm nay)</span>
                {showPreview ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </button>
              {showPreview && (
                <pre className="p-4 bg-white text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed border-t border-stone-200">
                  {info.sampleMessagePreview}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Right: Scannable QR Code */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-xl bg-stone-50 border border-stone-200 p-5 text-center space-y-3">
          <div className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-sm">
            {qrSvg ? (
              <div
                aria-label={`Mã QR mở Telegram Bot ${botUsername}`}
                className="w-[172px] h-[172px]"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="w-[172px] h-[172px] flex items-center justify-center text-xs text-stone-400">
                Đang tạo QR...
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-stone-900">Quét mã bằng camera hoặc Telegram</div>
            <div className="text-[11px] font-mono text-stone-500 mt-0.5">@{botUsername}</div>
          </div>
        </div>
      </div>
    </section>
  );
};
