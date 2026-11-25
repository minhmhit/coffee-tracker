'use client';

import React, { useState, useEffect } from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  Droplets,
  Wind,
  CloudRainWind,
  Sprout,
} from 'lucide-react';
import { DailyWeatherItem, WeatherTodayResponse } from '../types';

interface WeatherTodaySectionProps {
  weather: WeatherTodayResponse | null;
}

function getWeatherIcon(code: number, className = 'w-6 h-6') {
  if (code === 0 || code === 1) {
    return <Sun className={`${className} text-amber-500`} />;
  }
  if (code === 2) {
    return <CloudSun className={`${className} text-amber-500`} />;
  }
  if (code === 3 || code === 45 || code === 48) {
    return <Cloud className={`${className} text-stone-500`} />;
  }
  if (code >= 51 && code <= 57) {
    return <CloudDrizzle className={`${className} text-sky-600`} />;
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain className={`${className} text-sky-700`} />;
  }
  if (code >= 95) {
    return <CloudLightning className={`${className} text-indigo-700`} />;
  }
  return <CloudSun className={`${className} text-stone-500`} />;
}

function formatTemp(val: number | null): string {
  if (val == null || Number.isNaN(val)) return '—';
  return `${val.toFixed(1)}°C`;
}

export const WeatherTodaySection: React.FC<WeatherTodaySectionProps> = ({ weather }) => {
  const [selectedCode, setSelectedCode] = useState<string>('daklak');

  useEffect(() => {
    if (weather?.benchmark?.province_code) {
      setSelectedCode(weather.benchmark.province_code);
    }
  }, [weather?.benchmark?.province_code]);

  if (!weather || !weather.provinces || weather.provinces.length === 0) {
    return (
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
            Thời tiết Tây Nguyên Hôm nay
          </h2>
          <span className="text-xs text-stone-400">Open-Meteo</span>
        </div>
        <p className="text-sm text-stone-500 mt-2">
          Chưa có dữ liệu thời tiết hôm nay. Hệ thống sẽ tự động cập nhật vào 05:45 và 08:30 hằng ngày.
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
      className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5 sm:p-6 space-y-5"
    >
      {/* Header + Province Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-3.5">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight">
            Thời tiết Tây Nguyên Hôm nay
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Theo dõi nắng mưa & điều kiện phơi sấy / thu hoạch trực tiếp tại vùng trồng
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-1.5 bg-stone-100 p-1 rounded-xl">
          {weather.provinces.map((prov) => {
            const isSelected = prov.province_code === activeProvince.province_code;
            return (
              <button
                key={prov.province_code}
                type="button"
                onClick={() => setSelectedCode(prov.province_code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {prov.province_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Province Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Temperature & Condition */}
        <div className="lg:col-span-5 rounded-xl bg-stone-50 border border-stone-200/80 p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 flex items-center justify-center shadow-sm">
                {getWeatherIcon(activeProvince.weather_code, 'w-7 h-7')}
              </div>
              <div>
                <div className="text-sm font-bold text-stone-900">
                  {activeProvince.province_name}
                </div>
                <div className="text-xs font-medium text-stone-600">
                  {activeProvince.condition_vi}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-3xl font-extrabold text-stone-900 font-mono tabular-nums">
                {activeProvince.temp_current != null
                  ? `${activeProvince.temp_current.toFixed(1)}°`
                  : activeProvince.temp_max != null
                  ? `${activeProvince.temp_max.toFixed(1)}°`
                  : '—'}
              </div>
              <div className="text-[11px] text-stone-500 font-mono">
                {formatTemp(activeProvince.temp_min)} – {formatTemp(activeProvince.temp_max)}
              </div>
            </div>
          </div>

          {/* Farming Impact Callout */}
          <div
            className={`rounded-lg px-3.5 py-2.5 border text-xs leading-relaxed flex items-start gap-2 ${
              hasRainAlert
                ? 'bg-sky-50 border-sky-200 text-sky-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <Sprout className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{activeProvince.farming_impact_vi}</span>
          </div>
        </div>

        {/* Right: 4 Essential Metrics + Quick All-Province Glance */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <CloudRain className="w-3.5 h-3.5 text-sky-700" />
                <span>Lượng mưa</span>
              </div>
              <div className="mt-1 text-lg font-bold text-stone-900 font-mono tabular-nums">
                {activeProvince.precipitation_mm != null
                  ? `${activeProvince.precipitation_mm.toFixed(1)} mm`
                  : '0.0 mm'}
              </div>
            </div>

            <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <CloudRainWind className="w-3.5 h-3.5 text-sky-700" />
                <span>Khả năng mưa</span>
              </div>
              <div className="mt-1 text-lg font-bold text-stone-900 font-mono tabular-nums">
                {activeProvince.rain_probability != null
                  ? `${Math.round(activeProvince.rain_probability)}%`
                  : '—'}
              </div>
            </div>

            <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Droplets className="w-3.5 h-3.5 text-emerald-700" />
                <span>Độ ẩm</span>
              </div>
              <div className="mt-1 text-lg font-bold text-stone-900 font-mono tabular-nums">
                {activeProvince.humidity_pct != null
                  ? `${Math.round(activeProvince.humidity_pct)}%`
                  : '—'}
              </div>
            </div>

            <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Wind className="w-3.5 h-3.5 text-stone-600" />
                <span>Tốc độ gió</span>
              </div>
              <div className="mt-1 text-lg font-bold text-stone-900 font-mono tabular-nums">
                {activeProvince.wind_speed_kmh != null
                  ? `${activeProvince.wind_speed_kmh.toFixed(1)} km/h`
                  : '—'}
              </div>
            </div>
          </div>

          {/* 4-Province Compact Glance Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {weather.provinces.map((prov) => {
              const isSelected = prov.province_code === activeProvince.province_code;
              return (
                <button
                  key={prov.province_code}
                  type="button"
                  onClick={() => setSelectedCode(prov.province_code)}
                  className={`text-left rounded-xl px-3 py-2 border transition-colors ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-white border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-800">{prov.province_name}</span>
                    {getWeatherIcon(prov.weather_code, 'w-4 h-4')}
                  </div>
                  <div className="mt-1 text-xs font-mono text-stone-600 flex items-center justify-between">
                    <span>
                      {prov.temp_min != null && prov.temp_max != null
                        ? `${Math.round(prov.temp_min)}–${Math.round(prov.temp_max)}°C`
                        : '—'}
                    </span>
                    <span className="text-sky-700 font-medium">
                      {(prov.precipitation_mm ?? 0).toFixed(1)}mm
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
