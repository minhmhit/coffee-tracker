import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AdapterResult, LondonRobustaPrices } from '../types/market-data.types';

@Injectable()
export class LondonRobustaAdapter {
  private readonly logger = new Logger(LondonRobustaAdapter.name);
  private readonly URL = 'https://giacaphe.com/gia-ca-phe-truc-tuyen/';
  private readonly TIMEOUT_MS = 15000;
  private readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  async fetch(): Promise<AdapterResult<LondonRobustaPrices>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Fetching ICE London Robusta futures from: ${this.URL}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const prices = this.parseHtml(html);

      return {
        success: true,
        data: prices,
        source: 'giacaphe.com (London Robusta Livequote)',
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error(`Failed to fetch London Robusta futures: ${err.message}`);
      return {
        success: false,
        error: err.message,
        source: 'giacaphe.com',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  parseHtml(html: string): LondonRobustaPrices {
    const $ = cheerio.load(html);
    const table = $('table.has-scroll.livequote, table.livequote').first();
    if (!table.length) {
      throw new Error('London Robusta livequote table not found in HTML');
    }

    const rowPrices: number[] = [];

    table.find('tbody tr').each((_, tr) => {
      // Find td with class gnd--price or data-price attribute
      const priceTd = $(tr).find('td[data-price], td.gnd--price').first();
      if (priceTd.length) {
        const dataPrice = priceTd.attr('data-price');
        const textPrice = priceTd.text().replace(/,/g, '').trim();
        const price = dataPrice ? parseFloat(dataPrice) : parseFloat(textPrice);

        if (!isNaN(price) && price > 100 && price < 20000) {
          rowPrices.push(price);
        }
      }
    });

    if (rowPrices.length < 3) {
      throw new Error(
        `Insufficient contract rows found for London Robusta: found ${rowPrices.length} rows (expected >= 3)`,
      );
    }

    // Row 0: M1 (near month), Row 2: M3, Row 4 (or last): M6
    const m1 = rowPrices[0];
    const m3 = rowPrices.length > 2 ? rowPrices[2] : rowPrices[1];
    const m6 = rowPrices.length > 4 ? rowPrices[4] : rowPrices[rowPrices.length - 1];

    return { m1, m3, m6 };
  }
}
