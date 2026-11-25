import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface LocationCoords {
  id: 'daklak' | 'brazil';
  name: string;
  latitude: number;
  longitude: number;
}

export const CLIMATE_LOCATIONS: Record<'DAKLAK' | 'BRAZIL', LocationCoords> = {
  DAKLAK: {
    id: 'daklak',
    name: 'Đắk Lắk (Buôn Ma Thuột)',
    latitude: 12.6667,
    longitude: 108.0500,
  },
  BRAZIL: {
    id: 'brazil',
    name: 'Espírito Santo (Linhares)',
    latitude: -19.3911,
    longitude: -40.0722,
  },
};

export interface MonthlyRainfallResult {
  monthDate: string; // YYYY-MM-01
  totalRainfallMm: number;
  anomalyMm: number;
}

@Injectable()
export class OpenMeteoAdapter {
  private readonly logger = new Logger(OpenMeteoAdapter.name);
  private readonly BASE_URL = 'https://archive-api.open-meteo.com/v1/archive';
  private readonly TIMEOUT_MS = 6000;
  private readonly LOCAL_CACHE_PATH = path.resolve(__dirname, '../data/climate-rainfall-cache.json');

  /**
   * Fetches daily precipitation from Open-Meteo Historical Archive API.
   */
  async fetchDailyPrecipitation(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string,
  ): Promise<{ dates: string[]; precipitations: number[] }> {
    const url = `${this.BASE_URL}?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=auto`;
    this.logger.log(`Fetching daily precipitation from: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CoffeeTracker-MacroClimateIngestion/1.0 (+https://github.com/coffee-tracker)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Open-Meteo API returned HTTP ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (!json.daily || !json.daily.time || !json.daily.precipitation_sum) {
        throw new Error('Malformed Open-Meteo daily response');
      }

      return {
        dates: json.daily.time,
        precipitations: json.daily.precipitation_sum.map((v: number | null) => (v != null && !isNaN(v) ? v : 0)),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errMsg = err.name === 'AbortError' ? `Connection timeout (${this.TIMEOUT_MS}ms)` : err.message;
      this.logger.warn(`Open-Meteo online fetch failed: ${errMsg}`);
      throw new Error(`Failed to fetch precipitation from Open-Meteo: ${errMsg}`);
    }
  }

  /**
   * Aggregates daily precipitation array into monthly sums (keyed by YYYY-MM-01).
   */
  aggregateMonthlySums(dates: string[], precipitations: number[]): Map<string, number> {
    const monthlyMap = new Map<string, number>();

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const precip = precipitations[i];
      const monthKey = `${date.substring(0, 7)}-01`;

      const current = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, current + precip);
    }

    // Round all monthly sums to 2 decimal places
    for (const [key, val] of monthlyMap.entries()) {
      monthlyMap.set(key, Math.round(val * 100) / 100);
    }

    return monthlyMap;
  }

  /**
   * Computes the 2010–2020 baseline monthly climatological mean for each calendar month (1..12).
   */
  computeBaselineMeans(monthlySums: Map<string, number>, baselineStartYear = 2010, baselineEndYear = 2020): Map<number, number> {
    const monthAccumulator: Record<number, { sum: number; count: number }> = {};
    for (let m = 1; m <= 12; m++) {
      monthAccumulator[m] = { sum: 0, count: 0 };
    }

    for (const [monthKey, totalRain] of monthlySums.entries()) {
      const year = parseInt(monthKey.substring(0, 4), 10);
      const month = parseInt(monthKey.substring(5, 7), 10);

      if (year >= baselineStartYear && year <= baselineEndYear) {
        monthAccumulator[month].sum += totalRain;
        monthAccumulator[month].count += 1;
      }
    }

    const baselineMeans = new Map<number, number>();
    for (let m = 1; m <= 12; m++) {
      const { sum, count } = monthAccumulator[m];
      const mean = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
      baselineMeans.set(m, mean);
    }

    return baselineMeans;
  }

  /**
   * Computes monthly rainfall anomalies (Actual Month Rainfall - Baseline Month Mean) from 2018 onwards.
   */
  computeAnomalies(
    monthlySums: Map<string, number>,
    baselineMeans: Map<number, number>,
    startYear = 2018,
  ): Map<string, number> {
    const anomalies = new Map<string, number>();

    for (const [monthKey, totalRain] of monthlySums.entries()) {
      const year = parseInt(monthKey.substring(0, 4), 10);
      const month = parseInt(monthKey.substring(5, 7), 10);

      if (year >= startYear) {
        const baseline = baselineMeans.get(month) || 0;
        const anomaly = Math.round((totalRain - baseline) * 100) / 100;
        anomalies.set(monthKey, anomaly);
      }
    }

    return anomalies;
  }

  /**
   * Coordinated helper to fetch historical daily precipitation from 2010 to present
   * and return computed monthly anomalies from 2018 onwards.
   * Smoothly falls back to local verified rainfall dataset if online fetch fails.
   */
  async getHistoricalAnomalies(
    location: LocationCoords,
    startDate = '2010-01-01',
    endDate?: string,
  ): Promise<Map<string, number>> {
    const effectiveEndDate = endDate || new Date().toISOString().split('T')[0];
    this.logger.log(
      `Calculating rainfall anomalies for ${location.name} (${startDate} to ${effectiveEndDate})...`,
    );

    try {
      const { dates, precipitations } = await this.fetchDailyPrecipitation(
        location.latitude,
        location.longitude,
        startDate,
        effectiveEndDate,
      );

      const monthlySums = this.aggregateMonthlySums(dates, precipitations);
      const baselineMeans = this.computeBaselineMeans(monthlySums, 2010, 2020);
      const anomalies = this.computeAnomalies(monthlySums, baselineMeans, 2018);

      this.logger.log(
        `Generated ${anomalies.size} monthly anomalies for ${location.name} from online Open-Meteo API`,
      );

      return anomalies;
    } catch (err: any) {
      this.logger.warn(`Open-Meteo online fetch failed: ${err.message}. Activating local fallback rainfall dataset...`);
      return this.loadFallbackCache(location.id);
    }
  }

  /**
   * Loads local verified monthly rainfall anomaly cache when online fetch fails.
   */
  private loadFallbackCache(locationId: 'daklak' | 'brazil'): Map<string, number> {
    try {
      if (fs.existsSync(this.LOCAL_CACHE_PATH)) {
        const json = JSON.parse(fs.readFileSync(this.LOCAL_CACHE_PATH, 'utf8'));
        const regionData = json[locationId];
        if (regionData && regionData.anomalies) {
          const map = new Map<string, number>();
          for (const [dateKey, anomalyVal] of Object.entries(regionData.anomalies)) {
            map.set(dateKey, Number(anomalyVal));
          }
          this.logger.log(`Loaded ${map.size} monthly anomalies for ${locationId} from local fallback dataset`);
          return map;
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to load local rainfall cache: ${err.message}`);
    }

    return new Map();
  }
}
