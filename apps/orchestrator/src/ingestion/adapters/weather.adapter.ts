import { Injectable, Logger } from '@nestjs/common';
import {
  AdapterResult,
  ProvinceWeatherCode,
  ProvinceWeatherData,
} from '../types/market-data.types';

export interface WeatherProvinceSpec {
  code: ProvinceWeatherCode;
  name: string;
  latitude: number;
  longitude: number;
}

export const CENTRAL_HIGHLANDS_WEATHER_PROVINCES: WeatherProvinceSpec[] = [
  {
    code: 'DAKLAK',
    name: 'Đắk Lắk',
    latitude: 12.6667,
    longitude: 108.05,
  },
  {
    code: 'LAMDONG',
    name: 'Lâm Đồng',
    latitude: 11.548,
    longitude: 107.8077,
  },
  {
    code: 'GIALAI',
    name: 'Gia Lai',
    latitude: 13.9833,
    longitude: 108.0,
  },
  {
    code: 'DAKNONG',
    name: 'Đắk Nông',
    latitude: 12.0033,
    longitude: 107.6876,
  },
];

const WMO_CODE_LABELS_VI: Record<number, string> = {
  0: 'Trời quang, nắng ráo',
  1: 'Ít mây, nắng nhẹ',
  2: 'Có mây rải rác',
  3: 'Nhiều mây, âm u',
  45: 'Sương mù',
  48: 'Sương mù dày',
  51: 'Mưa phùn nhẹ',
  53: 'Mưa phùn vừa',
  55: 'Mưa phùn dày',
  56: 'Mưa phùn lạnh nhẹ',
  57: 'Mưa phùn lạnh dày',
  61: 'Mưa nhỏ',
  63: 'Mưa vừa',
  65: 'Mưa to',
  80: 'Mưa rào nhẹ',
  81: 'Mưa rào vừa',
  82: 'Mưa rào rất to',
  95: 'Mưa dông',
  96: 'Mưa dông kèm gió giật',
  99: 'Mưa dông mạnh',
};

@Injectable()
export class WeatherAdapter {
  private readonly logger = new Logger(WeatherAdapter.name);
  private readonly BASE_URL = 'https://api.open-meteo.com/v1/forecast';
  private readonly TIMEOUT_MS = 10000;

  /**
   * Fetches live daily + current weather for all 4 Central Highlands coffee provinces
   * in a single batch Open-Meteo Forecast API request.
   */
  async fetch(): Promise<AdapterResult<ProvinceWeatherData[]>> {
    const startTime = Date.now();
    const lats = CENTRAL_HIGHLANDS_WEATHER_PROVINCES.map((p) => p.latitude).join(',');
    const lons = CENTRAL_HIGHLANDS_WEATHER_PROVINCES.map((p) => p.longitude).join(',');

    const url =
      `${this.BASE_URL}?latitude=${lats}&longitude=${lons}` +
      '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code' +
      '&timezone=Asia/Ho_Chi_Minh&forecast_days=1';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      this.logger.log('Fetching live daily weather for 4 Central Highlands provinces via Open-Meteo...');
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CoffeeTracker-WeatherIngestion/1.0',
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Open-Meteo Forecast HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const parsed = this.parseForecastResponse(json);

      return {
        success: true,
        data: parsed,
        source: 'Open-Meteo Forecast API',
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errMsg = err.name === 'AbortError' ? `Timeout after ${this.TIMEOUT_MS}ms` : err.message;
      this.logger.warn(`Failed to fetch Open-Meteo forecast: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
        source: 'Open-Meteo Forecast API',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Parses Open-Meteo batch forecast JSON into normalized, sanity-checked province records.
   */
  parseForecastResponse(json: unknown): ProvinceWeatherData[] {
    const items = Array.isArray(json) ? json : [json];
    if (items.length !== CENTRAL_HIGHLANDS_WEATHER_PROVINCES.length) {
      throw new Error(
        `Unexpected Open-Meteo batch length: expected ${CENTRAL_HIGHLANDS_WEATHER_PROVINCES.length}, got ${items.length}`,
      );
    }

    return CENTRAL_HIGHLANDS_WEATHER_PROVINCES.map((spec, idx) =>
      this.parseProvincePayload(items[idx], spec),
    );
  }

  private parseProvincePayload(item: any, spec: WeatherProvinceSpec): ProvinceWeatherData {
    if (!item?.daily?.time?.length) {
      throw new Error(`Missing daily forecast fields for province ${spec.code}`);
    }

    const weatherDate = String(item.daily.time[0]);
    const tempMin = Number(item.daily.temperature_2m_min?.[0]);
    const tempMax = Number(item.daily.temperature_2m_max?.[0]);
    const precipitationMm = Number(item.daily.precipitation_sum?.[0] ?? 0);
    const rainProbabilityRaw = item.daily.precipitation_probability_max?.[0];
    const rainProbability =
      rainProbabilityRaw !== null && rainProbabilityRaw !== undefined
        ? Math.round(Number(rainProbabilityRaw))
        : null;

    const current = item.current || {};
    const tempCurrent =
      current.temperature_2m !== null && current.temperature_2m !== undefined
        ? Number(current.temperature_2m)
        : null;
    const humidityPct =
      current.relative_humidity_2m !== null && current.relative_humidity_2m !== undefined
        ? Math.round(Number(current.relative_humidity_2m))
        : null;
    const windSpeedKmh =
      current.wind_speed_10m !== null && current.wind_speed_10m !== undefined
        ? Number(current.wind_speed_10m)
        : null;

    const weatherCode = Number(current.weather_code ?? item.daily.weather_code?.[0] ?? 0);

    this.validateWeatherValues({
      provinceCode: spec.code,
      tempCurrent,
      tempMin,
      tempMax,
      precipitationMm,
      rainProbability,
      humidityPct,
      windSpeedKmh,
    });

    const conditionVi = this.mapWmoCodeToVietnamese(weatherCode);
    const farmingImpactVi = this.buildFarmingImpactNote({
      weatherCode,
      precipitationMm,
      rainProbability,
      humidityPct,
    });

    return {
      weatherDate,
      provinceCode: spec.code,
      provinceName: spec.name,
      tempCurrent,
      tempMin,
      tempMax,
      precipitationMm,
      rainProbability,
      humidityPct,
      windSpeedKmh,
      weatherCode,
      conditionVi,
      farmingImpactVi,
      rawMeta: {
        latitude: item.latitude ?? spec.latitude,
        longitude: item.longitude ?? spec.longitude,
        currentTime: current.time ?? null,
        dailyWeatherCode: item.daily.weather_code?.[0] ?? null,
      },
    };
  }

  /**
   * Maps WMO weather code (0..99) to readable Vietnamese condition label.
   */
  mapWmoCodeToVietnamese(code: number): string {
    if (WMO_CODE_LABELS_VI[code]) {
      return WMO_CODE_LABELS_VI[code];
    }
    if (code >= 95) return 'Mưa dông';
    if (code >= 80) return 'Mưa rào';
    if (code >= 60) return 'Có mưa';
    if (code >= 50) return 'Mưa phùn nhẹ';
    if (code >= 40) return 'Có sương mù';
    return 'Có mây';
  }

  /**
   * Generates concise agricultural impact guidance for coffee harvesting and drying.
   */
  buildFarmingImpactNote(params: {
    weatherCode: number;
    precipitationMm: number;
    rainProbability: number | null;
    humidityPct: number | null;
  }): string {
    const { weatherCode, precipitationMm, rainProbability, humidityPct } = params;

    if (weatherCode >= 95 || precipitationMm >= 15 || weatherCode === 65 || weatherCode === 82) {
      return `Cảnh báo mưa to (${precipitationMm.toFixed(1)} mm): cần che chắn sân phơi, tạm hoãn phơi hạt ngoài trời và lưu ý thoát nước vườn.`;
    }
    if (precipitationMm >= 1.5 || (rainProbability !== null && rainProbability >= 60)) {
      const probText = rainProbability !== null ? `, xác suất mưa ${rainProbability}%` : '';
      return `Có mưa rải rác (${precipitationMm.toFixed(1)} mm${probText}): hạn chế phơi cà phê trực tiếp, ưu tiên đảo hạt hoặc sấy lò.`;
    }
    if (humidityPct !== null && humidityPct >= 85) {
      return `Độ ẩm không khí cao (${humidityPct}%): tốc độ thoát ẩm chậm, cần đảo hạt thường xuyên để tránh nấm mốc.`;
    }
    return 'Thời tiết nắng ráo, thuận lợi cho hoạt động thu hái và phơi sấy cà phê nhân.';
  }

  validateWeatherValues(values: {
    provinceCode: string;
    tempCurrent: number | null;
    tempMin: number;
    tempMax: number;
    precipitationMm: number;
    rainProbability: number | null;
    humidityPct: number | null;
    windSpeedKmh: number | null;
  }): void {
    const checkTemp = (t: number, label: string) => {
      if (!Number.isFinite(t) || t < -5 || t > 50) {
        throw new Error(`Invalid ${label} for ${values.provinceCode}: ${t}`);
      }
    };

    checkTemp(values.tempMin, 'tempMin');
    checkTemp(values.tempMax, 'tempMax');
    if (values.tempMin > values.tempMax) {
      throw new Error(
        `tempMin (${values.tempMin}) exceeds tempMax (${values.tempMax}) for ${values.provinceCode}`,
      );
    }
    if (values.tempCurrent !== null) {
      checkTemp(values.tempCurrent, 'tempCurrent');
    }

    if (!Number.isFinite(values.precipitationMm) || values.precipitationMm < 0 || values.precipitationMm > 1000) {
      throw new Error(`Invalid precipitationMm for ${values.provinceCode}: ${values.precipitationMm}`);
    }
    if (
      values.humidityPct !== null &&
      (!Number.isFinite(values.humidityPct) || values.humidityPct < 0 || values.humidityPct > 100)
    ) {
      throw new Error(`Invalid humidityPct for ${values.provinceCode}: ${values.humidityPct}`);
    }
    if (
      values.rainProbability !== null &&
      (!Number.isFinite(values.rainProbability) || values.rainProbability < 0 || values.rainProbability > 100)
    ) {
      throw new Error(`Invalid rainProbability for ${values.provinceCode}: ${values.rainProbability}`);
    }
    if (
      values.windSpeedKmh !== null &&
      (!Number.isFinite(values.windSpeedKmh) || values.windSpeedKmh < 0 || values.windSpeedKmh > 300)
    ) {
      throw new Error(`Invalid windSpeedKmh for ${values.provinceCode}: ${values.windSpeedKmh}`);
    }
  }
}
