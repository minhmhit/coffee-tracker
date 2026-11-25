import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface NoaaOniRecord {
  monthDate: string; // YYYY-MM-01
  season: string; // DJF, JFM, etc.
  year: number;
  totalSst: number;
  oniIndex: number;
}

export const NOAA_SEASON_TO_MONTH: Record<string, string> = {
  DJF: '01',
  JFM: '02',
  FMA: '03',
  MAM: '04',
  AMJ: '05',
  MJJ: '06',
  JJA: '07',
  JAS: '08',
  ASO: '09',
  SON: '10',
  OND: '11',
  NDJ: '12',
};

@Injectable()
export class NoaaOniAdapter {
  private readonly logger = new Logger(NoaaOniAdapter.name);
  private readonly NOAA_URL = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
  private readonly TIMEOUT_MS = 6000;
  private readonly LOCAL_CACHE_PATH = path.resolve(__dirname, '../data/noaa-oni-cache.txt');

  /**
   * Fetches the official NOAA Oceanic Niño Index (ONI) dataset.
   * Smoothly falls back to local verified ASCII dataset if external request fails or times out.
   */
  async fetch(): Promise<{
    success: boolean;
    data: Map<string, number>;
    records: NoaaOniRecord[];
    source: string;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      this.logger.log(`Fetching NOAA ONI dataset from ${this.NOAA_URL}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.NOAA_URL, {
        headers: {
          'User-Agent': 'CoffeeTracker-MacroClimateIngestion/1.0 (+https://github.com/coffee-tracker)',
          Accept: 'text/plain, */*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      const records = this.parseAscii(text);
      const dataMap = new Map<string, number>();

      for (const rec of records) {
        dataMap.set(rec.monthDate, rec.oniIndex);
      }

      const latencyMs = Date.now() - startTime;
      this.logger.log(`Successfully parsed ${records.length} NOAA ONI records in ${latencyMs}ms from primary online source`);

      return {
        success: true,
        data: dataMap,
        records,
        source: 'noaa_cpc_online',
      };
    } catch (err: any) {
      const errMsg = err.name === 'AbortError' ? `Connection timeout (${this.TIMEOUT_MS}ms)` : err.message;
      this.logger.warn(`NOAA ONI online fetch failed: ${errMsg}. Activating local fallback dataset...`);

      return this.loadFallbackCache();
    }
  }

  /**
   * Loads local verified NOAA ONI ASCII dataset when online fetch fails.
   */
  private loadFallbackCache(): {
    success: boolean;
    data: Map<string, number>;
    records: NoaaOniRecord[];
    source: string;
    error?: string;
  } {
    try {
      if (fs.existsSync(this.LOCAL_CACHE_PATH)) {
        const text = fs.readFileSync(this.LOCAL_CACHE_PATH, 'utf8');
        const records = this.parseAscii(text);
        const dataMap = new Map<string, number>();

        for (const rec of records) {
          dataMap.set(rec.monthDate, rec.oniIndex);
        }

        this.logger.log(`Loaded ${records.length} NOAA ONI records from local fallback dataset (${this.LOCAL_CACHE_PATH})`);

        return {
          success: true,
          data: dataMap,
          records,
          source: 'noaa_cpc_local_fallback',
        };
      }
    } catch (cacheErr: any) {
      this.logger.error(`Failed to read local NOAA cache: ${cacheErr.message}`);
    }

    return {
      success: false,
      data: new Map(),
      records: [],
      source: 'failed',
      error: 'Both online fetch and local fallback failed',
    };
  }

  /**
   * Parses the whitespace-delimited ASCII table published by NOAA CPC.
   * Format:
   *  SEAS  YR   TOTAL   ANOM
   *   DJF 1950  25.01  -1.32
   */
  parseAscii(asciiContent: string): NoaaOniRecord[] {
    const lines = asciiContent.split(/\r?\n/);
    const records: NoaaOniRecord[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('SEAS')) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;

      const season = parts[0].toUpperCase();
      const year = parseInt(parts[1], 10);
      const totalSst = parseFloat(parts[2]);
      const oniIndex = parseFloat(parts[3]);

      if (!NOAA_SEASON_TO_MONTH[season] || isNaN(year) || isNaN(oniIndex)) {
        continue;
      }

      const monthStr = NOAA_SEASON_TO_MONTH[season];
      const monthDate = `${year}-${monthStr}-01`;

      records.push({
        monthDate,
        season,
        year,
        totalSst,
        oniIndex,
      });
    }

    return records;
  }
}
