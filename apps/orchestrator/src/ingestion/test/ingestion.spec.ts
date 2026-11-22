import * as fs from 'fs';
import * as path from 'path';
import { DomesticCoffeeAdapter } from '../adapters/domestic-coffee.adapter';
import { LondonRobustaAdapter } from '../adapters/london-robusta.adapter';
import { ExchangeRateAdapter } from '../adapters/exchange-rate.adapter';
import { BrentOilAdapter } from '../adapters/brent-oil.adapter';
import { PriceSanityValidator } from '../validators/price-sanity.validator';
import { DailyMarketSnapshot } from '../types/market-data.types';

describe('Market Data Ingestion Suite (Step 1.1)', () => {
  const fixturesDir = path.resolve(__dirname, '../../../test/fixtures');

  let domesticAdapter: DomesticCoffeeAdapter;
  let londonAdapter: LondonRobustaAdapter;
  let fxAdapter: ExchangeRateAdapter;
  let oilAdapter: BrentOilAdapter;
  let validator: PriceSanityValidator;

  beforeEach(() => {
    domesticAdapter = new DomesticCoffeeAdapter();
    londonAdapter = new LondonRobustaAdapter();
    fxAdapter = new ExchangeRateAdapter();
    oilAdapter = new BrentOilAdapter();
    validator = new PriceSanityValidator();
  });

  describe('1. Domestic Coffee Scrapers & Parsers', () => {
    it('should parse giacaphe.com primary HTML with CSS ::after mapping correctly', () => {
      const html = fs.readFileSync(
        path.join(fixturesDir, 'giacaphe_domestic.html'),
        'utf8',
      );
      const result = domesticAdapter.parseGiacaphe(html);

      expect(result).toBeDefined();
      expect(result.daklak).toBe(71800);
      expect(result.lamdong).toBe(71200);
      expect(result.gialai).toBe(71800);
      expect(result.daknong).toBe(72000);
      expect(result.average).toBe(71700);
    });

    it('should parse vietnambiz.vn fallback HTML correctly', () => {
      const html = fs.readFileSync(
        path.join(fixturesDir, 'vietnambiz_domestic.html'),
        'utf8',
      );
      const result = domesticAdapter.parseVietnambiz(html);

      expect(result).toBeDefined();
      expect(result.daklak).toBe(71800);
      expect(result.lamdong).toBe(71200);
      expect(result.gialai).toBe(71800);
      expect(result.daknong).toBe(72000);
      expect(result.average).toBe(71700);
    });

    it('should smoothly fall back to vietnambiz when primary source fails', async () => {
      const fallbackHtml = fs.readFileSync(
        path.join(fixturesDir, 'vietnambiz_domestic.html'),
        'utf8',
      );

      // Mock fetch: reject on primary, resolve on fallback
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('giacaphe.com')) {
          return Promise.reject(new Error('Connection timeout to primary source'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => fallbackHtml,
        } as any);
      });

      const res = await domesticAdapter.fetch();
      global.fetch = originalFetch;

      expect(res.success).toBe(true);
      expect(res.source).toBe('vietnambiz.vn (fallback)');
      expect(res.data?.daklak).toBe(71800);
    });
  });

  describe('2. London Robusta Futures Adapter', () => {
    it('should parse M1, M3, M6 futures prices from London livequote HTML', () => {
      const html = fs.readFileSync(
        path.join(fixturesDir, 'giacaphe_london.html'),
        'utf8',
      );
      const result = londonAdapter.parseHtml(html);

      expect(result).toBeDefined();
      expect(result.m1).toBe(4565);
      expect(result.m3).toBe(4335);
      expect(result.m6).toBe(4228);
    });
  });

  describe('3. Commercial Exchange Rate Adapter', () => {
    it('should parse Vietcombank official USD/VND rate from XML feed', () => {
      const xml = fs.readFileSync(
        path.join(fixturesDir, 'vietcombank_fx.xml'),
        'utf8',
      );
      const result = fxAdapter.parseXml(xml);

      expect(result).toBeDefined();
      expect(result.usdVnd).toBe(25600);
      expect(result.source).toBe('Vietcombank XML Feed');
      expect(result.publishedAt).toContain('11/22/2026');
    });
  });

  describe('4. Brent Crude Oil Adapter', () => {
    it('should parse Brent Oil price from Yahoo Finance chart JSON', () => {
      const jsonStr = fs.readFileSync(
        path.join(fixturesDir, 'yahoo_brent.json'),
        'utf8',
      );
      const json = JSON.parse(jsonStr);
      const result = oilAdapter.parseJson(json);

      expect(result).toBeDefined();
      expect(result.price).toBe(89.95);
      expect(result.currency).toBe('USD');
      expect(result.source).toBe('Yahoo Finance (BZ=F)');
    });
  });

  describe('5. PriceSanityValidator (Hard Integrity Checks)', () => {
    const validSnapshot: DailyMarketSnapshot = {
      date: '2026-11-22',
      domestic: {
        daklak: 71800,
        lamdong: 71200,
        gialai: 71800,
        daknong: 72000,
        average: 71700,
      },
      london: {
        m1: 2998,
        m3: 2865,
        m6: 2841,
      },
      exchangeRate: {
        usdVnd: 25600,
        source: 'Vietcombank',
      },
      brentOil: {
        price: 89.95,
        currency: 'USD',
        source: 'Yahoo Finance',
      },
      sourceMeta: {},
    };

    it('should PASS on normal realistic market prices', () => {
      const result = validator.validate(validSnapshot);
      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should REJECT when a day-over-day price jump exceeds +15% (e.g. +25% spike)', () => {
      const previousSnapshot: Partial<DailyMarketSnapshot> = {
        domestic: {
          daklak: 71800,
          lamdong: 71200,
          gialai: 71800,
          daknong: 72000,
          average: 71700,
        },
      };

      // Corrupt snapshot with +25% abnormal spike in Dak Lak
      const corruptSnapshot: DailyMarketSnapshot = {
        ...validSnapshot,
        domestic: {
          ...validSnapshot.domestic,
          daklak: 71800 * 1.25, // +25% jump!
        },
      };

      const result = validator.validate(corruptSnapshot, { previousSnapshot });
      expect(result.valid).toBe(false);
      expect(
        result.reasons.some((r) => r.includes('exceeds ±15% threshold')),
      ).toBe(true);
    });

    it('should REJECT negative or zero domestic coffee prices', () => {
      const corruptSnapshot: DailyMarketSnapshot = {
        ...validSnapshot,
        domestic: {
          ...validSnapshot.domestic,
          daklak: -50000, // Negative!
          lamdong: 0, // Zero!
        },
      };

      const result = validator.validate(corruptSnapshot);
      expect(result.valid).toBe(false);
      expect(result.reasons.some((r) => r.includes('Đắk Lắk'))).toBe(true);
      expect(result.reasons.some((r) => r.includes('Lâm Đồng'))).toBe(true);
    });

    it('should REJECT when benchmark province Đắk Lắk is NaN or missing', () => {
      const corruptSnapshot: DailyMarketSnapshot = {
        ...validSnapshot,
        domestic: {
          ...validSnapshot.domestic,
          daklak: NaN,
        },
      };

      const result = validator.validate(corruptSnapshot);
      expect(result.valid).toBe(false);
      expect(result.reasons.some((r) => r.includes('Đắk Lắk'))).toBe(true);
    });

    it('should REJECT implausible USD/VND or Brent oil prices', () => {
      const corruptSnapshot: DailyMarketSnapshot = {
        ...validSnapshot,
        exchangeRate: { usdVnd: 500, source: 'corrupted' },
        brentOil: { price: 5, currency: 'USD', source: 'corrupted' },
      };

      const result = validator.validate(corruptSnapshot);
      expect(result.valid).toBe(false);
      expect(result.reasons.some((r) => r.includes('USD/VND'))).toBe(true);
      expect(result.reasons.some((r) => r.includes('Brent oil'))).toBe(true);
    });
  });
});
