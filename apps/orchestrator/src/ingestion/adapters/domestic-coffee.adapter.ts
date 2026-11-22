import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AdapterResult, DomesticCoffeePrices } from '../types/market-data.types';

@Injectable()
export class DomesticCoffeeAdapter {
  private readonly logger = new Logger(DomesticCoffeeAdapter.name);
  private readonly PRIMARY_URL = 'https://giacaphe.com/gia-ca-phe-noi-dia/';
  private readonly FALLBACK_URL = 'https://vietnambiz.vn/gia-ca-phe.html';
  private readonly TIMEOUT_MS = 15000;
  private readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  async fetch(): Promise<AdapterResult<DomesticCoffeePrices>> {
    const startTime = Date.now();

    // 1. Try Primary Source: giacaphe.com
    try {
      this.logger.log(`Fetching domestic coffee prices from primary source: ${this.PRIMARY_URL}`);
      const response = await this.fetchWithTimeout(this.PRIMARY_URL);
      if (!response.ok) {
        throw new Error(`Primary HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const prices = this.parseGiacaphe(html);

      return {
        success: true,
        data: prices,
        source: 'giacaphe.com (primary)',
        latencyMs: Date.now() - startTime,
      };
    } catch (primaryErr: any) {
      this.logger.warn(`Primary source failed: ${primaryErr.message}. Attempting fallback...`);

      // 2. Try Fallback Source: vietnambiz.vn
      try {
        const fbResponse = await this.fetchWithTimeout(this.FALLBACK_URL);
        if (!fbResponse.ok) {
          throw new Error(`Fallback HTTP ${fbResponse.status}: ${fbResponse.statusText}`);
        }

        const fbHtml = await fbResponse.text();
        const prices = this.parseVietnambiz(fbHtml);

        return {
          success: true,
          data: prices,
          source: 'vietnambiz.vn (fallback)',
          latencyMs: Date.now() - startTime,
        };
      } catch (fallbackErr: any) {
        this.logger.error(`Both primary and fallback scrapers failed: ${fallbackErr.message}`);
        return {
          success: false,
          error: `Primary failed (${primaryErr.message}) & Fallback failed (${fallbackErr.message})`,
          source: 'none',
          latencyMs: Date.now() - startTime,
        };
      }
    }
  }

  parseGiacaphe(html: string): DomesticCoffeePrices {
    // 1. Extract CSS ::after content mappings from stylesheet
    // Example: .lgfHRZs::after{ content:'71,800'; }
    const cssRuleRegex = /\.([a-zA-Z0-9_-]+)::?after\s*\{\s*content:\s*['"]([0-9,.]+)['"]/g;
    const classToPrice = new Map<string, number>();
    let match: RegExpExecArray | null;

    while ((match = cssRuleRegex.exec(html)) !== null) {
      const className = match[1];
      const priceVal = parseFloat(match[2].replace(/,/g, ''));
      if (!isNaN(priceVal) && priceVal > 1000) {
        classToPrice.set(className, priceVal);
      }
    }

    const $ = cheerio.load(html);
    const result: Partial<DomesticCoffeePrices> = {};

    const provincePaths = [
      { key: 'daklak' as const, path: 'gia-ca-phe-dak-lak' },
      { key: 'lamdong' as const, path: 'gia-ca-phe-lam-dong' },
      { key: 'gialai' as const, path: 'gia-ca-phe-gia-lai' },
      { key: 'daknong' as const, path: 'gia-ca-phe-dak-nong' },
    ];

    for (const p of provincePaths) {
      const link = $(`a[href*="${p.path}"]`);
      if (link.length) {
        const tr = link.closest('tr');
        // Find spans with price classes
        const spans = tr.find('td span');
        spans.each((_, el) => {
          const classAttr = $(el).attr('class') || '';
          const classNames = classAttr.split(/\s+/);
          for (const c of classNames) {
            if (classToPrice.has(c)) {
              result[p.key] = classToPrice.get(c);
              break;
            }
          }
        });
      }
    }

    // Verify all 4 provinces were found
    if (!result.daklak || !result.lamdong || !result.gialai || !result.daknong) {
      throw new Error(
        `Incomplete province parsing from giacaphe.com: ${JSON.stringify(result)}`,
      );
    }

    const average = Math.round(
      (result.daklak + result.lamdong + result.gialai + result.daknong) / 4,
    );

    return {
      daklak: result.daklak,
      lamdong: result.lamdong,
      gialai: result.gialai,
      daknong: result.daknong,
      average,
    };
  }

  parseVietnambiz(html: string): DomesticCoffeePrices {
    const $ = cheerio.load(html);
    const result: Partial<DomesticCoffeePrices> = {};

    const provinceNames = [
      { key: 'daklak' as const, name: 'Đắk Lắk' },
      { key: 'lamdong' as const, name: 'Lâm Đồng' },
      { key: 'gialai' as const, name: 'Gia Lai' },
      { key: 'daknong' as const, name: 'Đắk Nông' },
    ];

    $('tr').each((_, tr) => {
      const text = $(tr).text();
      for (const p of provinceNames) {
        if (text.includes(p.name)) {
          const cells = $(tr).find('td');
          cells.each((_, td) => {
            const raw = $(td).text().replace(/,/g, '').trim();
            const val = parseFloat(raw);
            if (!isNaN(val) && val > 10000 && val < 500000) {
              result[p.key] = val;
            }
          });
        }
      }
    });

    if (!result.daklak || !result.lamdong || !result.gialai || !result.daknong) {
      throw new Error(
        `Incomplete province parsing from vietnambiz: ${JSON.stringify(result)}`,
      );
    }

    const average = Math.round(
      (result.daklak + result.lamdong + result.gialai + result.daknong) / 4,
    );

    return {
      daklak: result.daklak,
      lamdong: result.lamdong,
      gialai: result.gialai,
      daknong: result.daknong,
      average,
    };
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
