'use client';

import React, { useState, useEffect } from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  Thermometer,
  Droplets,
  Wind,
  Sprout,
} from 'lucide-react';
import { DailyWeatherItem, WeatherTodayResponse } from '../types';

interface WeatherTodaySectionProps {
  weather: WeatherTodayResponse | null;
}

function getWeatherIcon(code: number, className = 'w-6 h-6') {
  if (code === 0 || code === 1) {
    return <Sun className={`${className} text-[#166534]`} />;
  }
  if (code === 2) {
    return <CloudSun className={`${className} text-[#166534]`} />;
  }
  if (code === 3 || code === 45 || code === 48) {
    return <Cloud className={`${className} text-[#52525B]`} />;
  }
  if (code >= 51 && code <= 57) {
    return <CloudDrizzle className={`${className} text-[#475569]`} />;
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain className={`${className} text-[#1E40AF]`} />;
  }
  if (code >= 95) {
    return <CloudLightning className={`${className} text-[#991B1B]`} />;
  }
  return <CloudSun className={`${className} text-[#3F6A52]`} />;
}

function formatTemp(val: number | null): string {
  if (val == null || Number.isNaN(val)) return '—';
  return `${val.toFixed(1)}°C`;
}

export const WeatherTodaySection: React.FC<WeatherTodaySectionProps> = ({ weather }) => {
  const [selectedCode, setSelectedCode] = useState<string>('DAKLAK');

  useEffect(() => {
    if (weather?.benchmark?.province_code) {
      setSelectedCode(weather.benchmark.province_code);
    }
  }, [weather?.benchmark?.province_code]);

  if (!weather || !weather.provinces || weather.provinces.length === 0) {
    return (
      <section className="bg-white rounded-xl p-5 sm:p-6 border border-[#E5E7EB] shadow-sm space-y-2">
        <h2 className="font-serif text-[22px] text-[#111827] font-semibold">
          Thời tiết &amp; Điều kiện Phơi sấy Tây Nguyên
        </h2>
        <p className="text-[16px] text-[#52525B]">
          Chưa có dữ liệu thời tiết hôm nay. Hệ thống cập nhật tự động lúc 05:45 và 08:30 hằng ngày qua Open-Meteo.
        </p>
      </section>
    );
  }

  const activeProvince: DailyWeatherItem =
    weather.provinces.find((p) => p.province_code === selectedCode) ||
    weather.benchmark ||
    weather.provinces[0];

  const hasRainAlert =
    (activeProvince.precipitation_mm ?? 0) >= 5 ||
    (activeProvince.rain_probability ?? 0) >= 60;

  return (
    <section
      aria-label="Thời tiết Tây Nguyên hôm nay"
      className="bg-white rounded-xl p-5 sm:p-6 border border-[#E5E7EB] shadow-sm space-y-5"
    >
      {/* Header & Province Switch Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#ECF3EF] border border-[#86EFAC] flex items-center justify-center shrink-0">
            {getWeatherIcon(activeProvince.weather_code, 'w-6 h-6')}
          </div>
          <div>
            <h2 className="font-serif text-[22px] sm:text-[24px] text-[#111827] font-semibold leading-snug">
              Thời tiết &amp; Điều kiện Phơi sấy Hôm nay
            </h2>
            <p className="text-[15px] text-[#3F3F46] font-medium">
              {activeProvince.province_name} · {activeProvince.condition_vi} · Nguồn Open-Meteo
            </p>
          </div>
        </div>

        {/* Province Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F5F3EF] rounded-xl border border-[#E5E7EB]">
          {weather.provinces.map((prov) => {
            const isSelected = prov.province_code === activeProvince.province_code;
            return (
              <button
                key={prov.province_code}
                type="button"
                onClick={() => setSelectedCode(prov.province_code)}
                className={`px-3.5 py-1.5 rounded-lg text-[14px] font-semibold transition-colors ${
                  isSelected
                    ? 'bg-white text-[#111827] shadow-sm border border-[#E5E7EB]'
                    : 'text-[#52525B] hover:text-[#111827]'
                }`}
              >
                {prov.province_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Essential Weather Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
            <Thermometer className="w-5 h-5 text-[#166534]" />
          </div>
          <div>
            <div className="text-[14px] text-[#52525B] uppercase font-bold">Nhiệt độ</div>
            <div className="font-mono text-[22px] text-[#111827] font-bold tabular-nums">
              {activeProvince.temp_current != null
                ? `${activeProvince.temp_current.toFixed(1)}°C`
                : formatTemp(activeProvince.temp_max)}
            </div>
            <div className="text-[14px] text-[#3F3F46] font-medium">
              Biên độ: {formatTemp(activeProvince.temp_min)} – {formatTemp(activeProvince.temp_max)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
            <CloudRain className="w-5 h-5 text-[#166534]" />
          </div>
          <div>
            <div className="text-[14px] text-[#52525B] uppercase font-bold">Lượng mưa</div>
            <div className="font-mono text-[22px] text-[#111827] font-bold tabular-nums">
              {activeProvince.precipitation_mm != null
                ? `${activeProvince.precipitation_mm.toFixed(1)} mm`
                : '0.0 mm'}
            </div>
            <div className="text-[14px] text-[#3F3F46] font-medium">
              Xác suất mưa:{' '}
              {activeProvince.rain_probability != null
                ? `${Math.round(activeProvince.rain_probability)}%`
                : '—'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
            <Droplets className="w-5 h-5 text-[#166534]" />
          </div>
          <div>
            <div className="text-[14px] text-[#52525B] uppercase font-bold">Độ ẩm không khí</div>
            <div className="font-mono text-[22px] text-[#111827] font-bold tabular-nums">
              {activeProvince.humidity_pct != null
                ? `${Math.round(activeProvince.humidity_pct)}%`
                : '—'}
            </div>
            <div className="text-[14px] text-[#3F3F46] font-medium">
              {activeProvince.condition_vi}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5E7EB] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
            <Wind className="w-5 h-5 text-[#166534]" />
          </div>
          <div>
            <div className="text-[14px] text-[#52525B] uppercase font-bold">Tốc độ gió</div>
            <div className="font-mono text-[22px] text-[#111827] font-bold tabular-nums">
              {activeProvince.wind_speed_kmh != null
                ? `${activeProvince.wind_speed_kmh.toFixed(1)} km/h`
                : '—'}
            </div>
            <div className="text-[14px] text-[#3F3F46] font-medium">Ngày {weather.date}</div>
          </div>
        </div>
      </div>

      {/* Senior-Friendly Agricultural Advisory Banner */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 ${
          hasRainAlert
            ? 'bg-[#FEF3C7]/70 border-[#FCD34D] text-[#78350F]'
            : 'bg-[#ECF3EF] border-[#86EFAC] text-[#14532D]'
        }`}
      >
        <Sprout className="w-6 h-6 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[16px] font-bold">
            Khuyến nghị canh tác &amp; phơi sấy tại {activeProvince.province_name}:
          </p>
          <p className="text-[16px] leading-relaxed text-[#1F2937]">
            {activeProvince.farming_impact_vi}
          </p>
        </div>
      </div>
    </section>
  );
};
