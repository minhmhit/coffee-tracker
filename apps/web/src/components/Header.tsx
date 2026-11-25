'use client';

import React from 'react';
import { Send } from 'lucide-react';

interface HeaderProps {
  lastUpdated?: string;
  onOpenTelegramModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ lastUpdated, onOpenTelegramModal }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#FDFBF7]/95 backdrop-blur-md border-b border-[#E5E7EB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Title */}
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-[22px] sm:text-[24px] tracking-tight text-[#111827] font-semibold">
            COFFEE TRACKER
          </span>
          <span className="hidden sm:inline-block text-[15px] text-[#3F3F46] font-medium">
            · Giá Cà phê Tây Nguyên
          </span>
        </div>

        {/* Timestamp + Single Clear Telegram CTA */}
        <div className="flex items-center gap-3 sm:gap-4">
          {lastUpdated && (
            <div className="hidden md:flex items-center gap-2 font-mono text-[14px] text-[#27272A] font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#166534]" />
              <span>Cập nhật: {lastUpdated}</span>
            </div>
          )}

          {onOpenTelegramModal ? (
            <button
              type="button"
              onClick={onOpenTelegramModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#71717A] bg-white text-[#18181B] text-[15px] font-semibold hover:bg-[#F5F3EF] transition-colors shadow-sm"
            >
              <Send className="w-4 h-4 text-[#166534]" />
              <span>Nhận tin Telegram</span>
            </button>
          ) : (
            <a
              href="#telegram-section"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#71717A] bg-white text-[#18181B] text-[15px] font-semibold hover:bg-[#F5F3EF] transition-colors shadow-sm"
            >
              <Send className="w-4 h-4 text-[#166534]" />
              <span>Nhận tin Telegram</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
