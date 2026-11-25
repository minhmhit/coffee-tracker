import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AdapterResult, IceRobustaStockData } from '../types/market-data.types';
import { ICE_STOCK_BOUNDS } from '../validators/ice-stocks-sanity.validator';

@Injectable()
export class IceStocksAdapter {
  private readonly logger = new Logger(IceStocksAdapter.name);
  private readonly PRIMARY_URL = 'https://www.ice.com/report/173';
  private readonly FALLBACK_INDEX_URL = 'https://vietnambiz.vn/gia-ca-phe.html';
  private readonly TIMEOUT_MS = 12000;
  private readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  /**
   * Fetches latest ICE Certified Robusta Coffee Stocks:
   *  1. Primary: ICE Report Center (report/173) if accessible without click-through/SPA block.
   *  2. Fallback: VietnamBiz daily coffee market reports parsing Robusta certified lots.
   */
  async fetch(): Promise<AdapterResult<IceRobustaStockData>> {
    const startTime = Date.now();

    // 1. Try Primary Source: ICE Report Center 173
    try {
      this.logger.log(`Fetching ICE Certified Robusta Stocks from primary source: ${this.PRIMARY_URL}`);
      const response = await this.fetchWithTimeout(this.PRIMARY_URL);
      if (!response.ok) {
        throw new Error(`ICE Primary HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const parsed = this.parseIceReportHtml(html);

      return {
        success: true,
        data: parsed,
        source: 'ICE Report Center (173)',
        latencyMs: Date.now() - startTime,
      };
    } catch (primaryErr: any) {
      this.logger.warn(`ICE Report 173 primary fetch unavailable (${primaryErr.message}). Trying VietnamBiz fallback...`);

      // 2. Try Fallback Source: VietnamBiz recent coffee articles
      try {
        const fallbackData = await this.fetchFromVietnambiz();
        return {
          success: true,
          data: fallbackData,
          source: 'vietnambiz.vn (fallback)',
          latencyMs: Date.now() - startTime,
        };
      } catch (fallbackErr: any) {
        this.logger.warn(
          `Both ICE primary and VietnamBiz fallback failed for Robusta stocks: ${fallbackErr.message}`,
        );
        return {
          success: false,
          error: `Primary failed (${primaryErr.message}) & Fallback failed (${fallbackErr.message})`,
          source: 'none',
          latencyMs: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * Parses direct table/CSV/JSON data from ICE Report 173 if present.
   * Explicitly detects interactive React SPA shells or Click-Through gates and refuses to guess.
   */
  parseIceReportHtml(html: string): IceRobustaStockData {
    if (!html || html.includes('ICE_Report_Center_Click_Through_Agreement') || html.includes('data-is-cms-page="true"')) {
      throw new Error('ICE Report 173 returned client-side SPA / click-through agreement shell');
    }

    const $ = cheerio.load(html);
    const totalMatch = $('table tr')
      .toArray()
      .map((tr) => $(tr).text().replace(/\s+/g, ' ').trim())
      .find((rowText) => /total/i.test(rowText) && /[\d,]+/.test(rowText));

    if (!totalMatch) {
      throw new Error('Certified Robusta stock summary row not found in ICE HTML');
    }

    const numMatches = totalMatch.match(/[\d,]+/g) || [];
    for (const raw of numMatches) {
      const lots = parseInt(raw.replace(/,/g, ''), 10);
      if (lots >= ICE_STOCK_BOUNDS.MIN_LOTS && lots <= ICE_STOCK_BOUNDS.MAX_LOTS) {
        return {
          reportDate: this.getTodayIsoVn(),
          certifiedLots: lots,
          certifiedTonnes: lots * ICE_STOCK_BOUNDS.TONNES_PER_LOT,
          sourceName: 'ICE Report Center (173)',
          isStale: false,
          rawMeta: { matchedRow: totalMatch },
        };
      }
    }

    throw new Error(`No valid Robusta lots within bounds found in ICE row: ${totalMatch}`);
  }

  /**
   * Fetches VietnamBiz coffee category page and scans up to 5 recent articles
   * until a verified ICE Robusta certified lot count is extracted.
   */
  async fetchFromVietnambiz(): Promise<IceRobustaStockData> {
    const indexRes = await this.fetchWithTimeout(this.FALLBACK_INDEX_URL);
    if (!indexRes.ok) {
      throw new Error(`VietnamBiz index HTTP ${indexRes.status}`);
    }

    const indexHtml = await indexRes.text();
    const articleUrls = this.extractCoffeeArticleUrls(indexHtml).slice(0, 5);
    if (articleUrls.length === 0) {
      throw new Error('No coffee market articles found on VietnamBiz index');
    }

    for (const url of articleUrls) {
      try {
        const res = await this.fetchWithTimeout(url);
        if (!res.ok) continue;
        const html = await res.text();
        const parsed = this.parseVietnambizArticle(html, url);
        if (parsed) {
          return parsed;
        }
      } catch (err: any) {
        this.logger.debug(`Skipping VietnamBiz article ${url}: ${err.message}`);
      }
    }

    throw new Error('None of the latest 5 VietnamBiz articles contained ICE Robusta stock lot counts');
  }

  extractCoffeeArticleUrls(indexHtml: string): string[] {
    const $ = cheerio.load(indexHtml);
    const urls = new Set<string>();

    $('a[href*="gia-ca-phe-hom-nay"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || !href.endsWith('.htm')) return;
      const fullUrl = href.startsWith('http') ? href : `https://vietnambiz.vn${href}`;
      urls.add(fullUrl);
    });

    return Array.from(urls);
  }

  /**
   * Extracts ICE Robusta Certified Stocks (measured in `lô`) from a VietnamBiz article.
   * Explicitly isolates Robusta stock clauses from Arabica bag counts (`bao`).
   */
  parseVietnambizArticle(html: string, articleUrl = ''): IceRobustaStockData | null {
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();

    const rawText = $('body').text().replace(/\s+/g, ' ').trim();
    if (!rawText) return null;

    // Match clauses specifically discussing Robusta inventories on ICE / London exchange
    // Examples: "Đối với Robusta, tồn kho tại các kho của ICE... còn 5.776 lô... nhích nhẹ lên 5.791 lô..."
    const robustaClauseRegex =
      /(?:đối với\s+(?:cà phê\s+)?robusta[^.]*?tồn kho|tồn kho\s+(?:cà phê\s+)?robusta(?:\s+trên\s+sàn\s+ice|\s+tại\s+các\s+kho\s+của\s+ice)?)[\s\S]{0,450}?(?=(?:tồn kho\s+arabica|giá\s+cà\s+phê\s+hôm\s+nay|$))/gi;

    let candidateClauses: string[] = Array.from(rawText.match(robustaClauseRegex) || []);

    // Secondary pattern: sentence mentioning both "tồn kho" and "robusta" and "lô" (never "bao")
    if (candidateClauses.length === 0) {
      const sentences = rawText.split(/(?<=[.!?])\s+/);
      candidateClauses = sentences.filter(
        (s) =>
          /tồn kho/i.test(s) &&
          /robusta/i.test(s) &&
          /(?:\s|^)lô(?=\s|[,.;:!?)]|$)/i.test(s) &&
          !/\bbao\b/i.test(s),
      );
    }

    for (const clause of candidateClauses) {
      // Take all `<number> lô` matches in chronological order inside the clause; the last is the latest figure
      const lotMatches = [
        ...clause.matchAll(/(\d{1,2}(?:[.,]\d{3})+|\d{3,5})\s*lô(?=\s|[,.;:!?)]|$)/gi),
      ];
      if (lotMatches.length === 0) continue;

      for (let i = lotMatches.length - 1; i >= 0; i--) {
        const rawLotStr = lotMatches[i][1].replace(/[.,]/g, '');
        const lots = parseInt(rawLotStr, 10);
        if (lots >= ICE_STOCK_BOUNDS.MIN_LOTS && lots <= ICE_STOCK_BOUNDS.MAX_LOTS) {
          const reportDate = this.extractReportDate(rawText, articleUrl);
          return {
            reportDate,
            certifiedLots: lots,
            certifiedTonnes: lots * ICE_STOCK_BOUNDS.TONNES_PER_LOT,
            sourceName: 'vietnambiz.vn (fallback)',
            isStale: false,
            rawMeta: {
              articleUrl,
              matchedSnippet: clause.slice(0, 280),
            },
          };
        }
      }
    }

    return null;
  }

  private extractReportDate(text: string, articleUrl: string): string {
    // 1. Try URL suffix timestamp e.g. ...-2026112410355362.htm
    const urlDateMatch = articleUrl.match(/-(20\d{2})(\d{2})(\d{2})\d+\.htm$/);
    if (urlDateMatch) {
      return `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
    }

    // 2. Try DD/MM/YYYY published timestamp in page text
    const textDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (textDateMatch) {
      const day = textDateMatch[1].padStart(2, '0');
      const month = textDateMatch[2].padStart(2, '0');
      return `${textDateMatch[3]}-${month}-${day}`;
    }

    return this.getTodayIsoVn();
  }

  private getTodayIsoVn(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      clearTimeout(timeout);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
