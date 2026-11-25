'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  Send,
  Copy,
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { TelegramOnboardingInfo } from '../types';

interface TelegramConnectSectionProps {
  info: TelegramOnboardingInfo | null;
  onClose?: () => void;
  isModal?: boolean;
}

const DEFAULT_COMMANDS = [
  { command: '/start', description: 'Đăng ký nhận bản tin giá & thời tiết tự động lúc 06:00 sáng' },
  { command: '/today', description: 'Xem ngay giá cà phê, thời tiết & nhận định thị trường hôm nay' },
  { command: '/stop', description: 'Tạm dừng nhận thông báo tự động hằng ngày' },
];

export const TelegramConnectSection: React.FC<TelegramConnectSectionProps> = ({
  info,
  onClose,
  isModal = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const botUsername = info?.botUsername || 'minhmh_coffee_tracker_bot';
  const deepLink = info?.deepLink || `https://t.me/${botUsername}?start=subscribe`;
  const commands = info?.commands && info.commands.length > 0 ? info.commands : DEFAULT_COMMANDS;
  const scheduleText = info?.briefingSchedule || '06:00 sáng hằng ngày (Giờ Việt Nam)';

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(deepLink, {
      width: 296,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('QR generation failed:', err);
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
      // Clipboard fallback ignored
    }
  };

  return (
    <section
      id={isModal ? undefined : 'telegram-section'}
      aria-label="Kết nối Bot Telegram"
      className={`bg-white rounded-xl border border-[#E5E7EB] ${
        isModal ? 'shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto' : 'shadow-sm'
      } p-5 sm:p-6 space-y-5`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] text-[#166534] uppercase tracking-wider font-bold">
              Tự động hóa Bản tin Hằng ngày
            </span>
            {info && (
              <span className="px-2.5 py-0.5 rounded-full text-[14px] font-semibold bg-[#ECF3EF] text-[#166534] border border-[#86EFAC]">
                {info.activeSubscribersCount} người đã kết nối
              </span>
            )}
          </div>
          <h2 className="font-serif text-[24px] sm:text-[28px] text-[#111827] font-semibold leading-snug">
            Nhận điểm tin giá cà phê &amp; thời tiết lúc 06:00 mỗi sáng
          </h2>
          <p className="text-[16px] text-[#3F3F46] leading-relaxed">
            Dành riêng cho nhà vườn và đại lý thu mua. Miễn phí hoàn toàn qua Telegram ({scheduleText}).
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn Telegram"
            className="p-2 rounded-lg text-[#52525B] hover:text-[#111827] hover:bg-[#F5F3EF] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Big Touch Button + 3 Simple Steps */}
        <div className="lg:col-span-7 space-y-5">
          {/* Primary CTA (Full-width mobile >= 52px tall) & Secondary Copy */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto min-h-[52px] px-6 inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white text-[16px] font-bold shadow-sm transition-colors"
            >
              <Send className="w-5 h-5" />
              <span>Bấm để nhận giá qua Telegram (Miễn phí)</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="w-full sm:w-auto min-h-[52px] px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5F3EF] hover:bg-[#E4E2DE] text-[#18181B] text-[15px] font-semibold border border-[#E5E7EB] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#166534]" />
                  <span>Đã sao chép link</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#52525B]" />
                  <span>Sao chép liên kết</span>
                </>
              )}
            </button>
          </div>

          {/* 3 Clear Steps >= 16px */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-[#DCFCE7] text-[#166534] font-mono text-[14px] font-bold flex items-center justify-center shrink-0 border border-[#86EFAC] mt-0.5">
                1
              </span>
              <span className="text-[16px] text-[#18181B] leading-relaxed">
                Nhấn nút xanh lớn ở trên hoặc dùng camera điện thoại quét mã QR bên cạnh.
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-[#DCFCE7] text-[#166534] font-mono text-[14px] font-bold flex items-center justify-center shrink-0 border border-[#86EFAC] mt-0.5">
                2
              </span>
              <span className="text-[16px] text-[#18181B] leading-relaxed">
                Trong ứng dụng Telegram, bấm chữ <strong>BẮT ĐẦU (START)</strong> để kích hoạt.
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-[#DCFCE7] text-[#166534] font-mono text-[14px] font-bold flex items-center justify-center shrink-0 border border-[#86EFAC] mt-0.5">
                3
              </span>
              <span className="text-[16px] text-[#18181B] leading-relaxed">
                Mỗi sáng lúc <strong>06:00</strong>, hệ thống tự động gửi bảng giá 4 tỉnh, thời tiết
                phơi sấy và nhận định thị trường.
              </span>
            </div>
          </div>

          {/* Quick Commands Reference (>= 14px) */}
          <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] space-y-2.5">
            <div className="text-[14px] font-bold text-[#111827] uppercase tracking-wide">
              Các lệnh hỗ trợ trên Bot Telegram:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {commands.map((cmd) => (
                <div key={cmd.command} className="space-y-1">
                  <code className="inline-block font-mono font-bold text-[14px] text-[#166534] bg-[#ECF3EF] border border-[#86EFAC] px-2 py-0.5 rounded">
                    {cmd.command}
                  </code>
                  <p className="text-[14px] text-[#3F3F46] leading-snug">{cmd.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Scannable QR Code (>= 140x140px) + Sample Preview Toggle */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4">
          <div className="flex flex-col items-center p-4 bg-[#FBF9F5] border border-[#E5E7EB] rounded-2xl text-center w-full sm:w-auto">
            <div className="w-[148px] h-[148px] bg-white p-2 rounded-xl border border-[#D4D4D8] flex items-center justify-center shadow-sm">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt={`Mã QR mở Telegram Bot @${botUsername}`}
                  width={140}
                  height={140}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-[14px] text-[#52525B]">Đang tạo QR...</span>
              )}
            </div>
            <div className="text-[15px] font-bold text-[#111827] mt-3">
              Quét mã bằng điện thoại
            </div>
            <div className="text-[14px] font-mono text-[#52525B]">@{botUsername}</div>
          </div>

          {/* Expandable Live Sample Briefing */}
          {info?.sampleMessagePreview && (
            <div className="w-full border border-[#E5E7EB] rounded-xl overflow-hidden bg-[#FBF9F5]">
              <button
                type="button"
                onClick={() => setShowPreview((prev) => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between text-[14px] font-bold text-[#18181B] hover:bg-[#F5F3EF] transition-colors"
              >
                <span>Xem trước tin nhắn mẫu lúc 06:00 sáng</span>
                {showPreview ? (
                  <ChevronUp className="w-4 h-4 text-[#52525B]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#52525B]" />
                )}
              </button>
              {showPreview && (
                <pre className="p-4 bg-white text-[14px] text-[#18181B] whitespace-pre-wrap font-sans leading-relaxed border-t border-[#E5E7EB]">
                  {info.sampleMessagePreview}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
