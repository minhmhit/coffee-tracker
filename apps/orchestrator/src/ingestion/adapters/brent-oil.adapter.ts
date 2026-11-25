import { Injectable, Logger } from '@nestjs/common';
import { AdapterResult, BrentOilData } from '../types/market-data.types';

@Injectable()
export class BrentOilAdapter {
  private readonly logger = new Logger(BrentOilAdapter.name);
  private readonly PRIMARY_URL =
    'https://query1.finance.yahoo.com/v8/finance/chart/BZ=F';
  private readonly TIMEOUT_MS = 15000;
  private readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  async fetch(): Promise<AdapterResult<BrentOilData>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Fetching Brent Crude Oil price from: ${this.PRIMARY_URL}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.PRIMARY_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json, text/plain, */*',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const data = this.parseJson(json);

      return {
        success: true,
        data,
        source: 'Yahoo Finance (BZ=F)',
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error(`Failed to fetch Brent Crude Oil price: ${err.message}`);
      return {
        success: false,
        error: err.message,
        source: 'Yahoo Finance (BZ=F)',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  parseJson(json: any): BrentOilData {
    const result = json?.chart?.result?.[0];
    if (!result) {
      throw new Error(`Invalid Yahoo Finance chart response: ${JSON.stringify(json?.chart?.error)}`);
    }

    const meta = result.meta;
    const price = meta?.regularMarketPrice || meta?.chartPreviousClose || meta?.previousClose;

    if (typeof price !== 'number' || isNaN(price) || price <= 0) {
      throw new Error(`Invalid Brent Oil price parsed: ${price}`);
    }

    return {
      price,
      currency: meta?.currency || 'USD',
      source: 'Yahoo Finance (BZ=F)',
    };
  }
}
