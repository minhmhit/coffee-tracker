import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { AdapterResult, ExchangeRateData } from '../types/market-data.types';

@Injectable()
export class ExchangeRateAdapter {
  private readonly logger = new Logger(ExchangeRateAdapter.name);
  private readonly URL =
    'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
  private readonly TIMEOUT_MS = 15000;

  async fetch(): Promise<AdapterResult<ExchangeRateData>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Fetching official USD/VND exchange rate from Vietcombank: ${this.URL}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.URL, {
        signal: controller.signal,
        headers: {
          Accept: 'application/xml, text/xml, */*',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();
      const data = this.parseXml(xml);

      return {
        success: true,
        data,
        source: 'vietcombank.com.vn (XML Feed)',
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error(`Failed to fetch Vietcombank exchange rate: ${err.message}`);
      return {
        success: false,
        error: err.message,
        source: 'vietcombank.com.vn',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  parseXml(xml: string): ExchangeRateData {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const parsed = parser.parse(xml);
    const exrateList = parsed?.ExrateList;
    if (!exrateList) {
      throw new Error('Invalid Vietcombank XML structure: ExrateList not found');
    }

    const dateTime = exrateList.DateTime || new Date().toISOString();
    const rates: any[] = Array.isArray(exrateList.Exrate)
      ? exrateList.Exrate
      : [exrateList.Exrate];

    const usdItem = rates.find(
      (r) => r?.['@_CurrencyCode'] === 'USD' || r?.['CurrencyCode'] === 'USD',
    );

    if (!usdItem) {
      throw new Error('USD currency item not found in Vietcombank XML');
    }

    // Commercial exchange rate: Prefer Transfer rate, fallback to Sell rate, then Buy rate
    const rawTransfer = (usdItem['@_Transfer'] || usdItem['Transfer'] || '').replace(/,/g, '');
    const rawSell = (usdItem['@_Sell'] || usdItem['Sell'] || '').replace(/,/g, '');
    const rawBuy = (usdItem['@_Buy'] || usdItem['Buy'] || '').replace(/,/g, '');

    const transferVal = parseFloat(rawTransfer);
    const sellVal = parseFloat(rawSell);
    const buyVal = parseFloat(rawBuy);

    const usdVnd = !isNaN(transferVal) && transferVal > 10000
      ? transferVal
      : !isNaN(sellVal) && sellVal > 10000
        ? sellVal
        : buyVal;

    if (isNaN(usdVnd) || usdVnd <= 10000) {
      throw new Error(`Failed to parse valid USD/VND rate from: ${JSON.stringify(usdItem)}`);
    }

    return {
      usdVnd,
      source: 'Vietcombank XML Feed',
      publishedAt: dateTime,
    };
  }
}
