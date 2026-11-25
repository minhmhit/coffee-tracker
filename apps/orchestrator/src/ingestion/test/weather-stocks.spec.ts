import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WeatherAdapter } from '../adapters/weather.adapter';
import { IceStocksAdapter } from '../adapters/ice-stocks.adapter';
import { IceStocksSanityValidator } from '../validators/ice-stocks-sanity.validator';
import { WeatherController } from '../weather.controller';
import { StocksController } from '../stocks.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('Weather & ICE Certified Robusta Stocks Suite (Step 5.1)', () => {
  const fixturesDir = path.resolve(__dirname, '../../../test/fixtures');

  let weatherAdapter: WeatherAdapter;
  let iceStocksAdapter: IceStocksAdapter;
  let iceValidator: IceStocksSanityValidator;
  let weatherController: WeatherController;
  let stocksController: StocksController;
  let prismaMock: any;

  beforeEach(async () => {
    weatherAdapter = new WeatherAdapter();
    iceStocksAdapter = new IceStocksAdapter();
    iceValidator = new IceStocksSanityValidator();

    prismaMock = {
      dailyWeather: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      iceRobustaStock: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeatherController, StocksController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    weatherController = module.get<WeatherController>(WeatherController);
    stocksController = module.get<StocksController>(StocksController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. WeatherAdapter (Open-Meteo Forecast & WMO Mapping)', () => {
    it('should parse live 4-province Open-Meteo Forecast fixture accurately', () => {
      const json = JSON.parse(
        fs.readFileSync(path.join(fixturesDir, 'open_meteo_forecast_4provinces.json'), 'utf8'),
      );
      const parsed = weatherAdapter.parseForecastResponse(json);

      expect(parsed.length).toBe(4);
      expect(parsed[0].provinceCode).toBe('DAKLAK');
      expect(parsed[0].provinceName).toBe('Đắk Lắk');
      expect(parsed[0].tempCurrent).toBe(28.7);
      expect(parsed[0].tempMin).toBe(22.3);
      expect(parsed[0].tempMax).toBe(30.1);
      expect(parsed[0].weatherCode).toBe(0);
      expect(parsed[0].conditionVi).toBe('Trời quang, nắng ráo');
      expect(parsed[0].farmingImpactVi).toContain('thuận lợi');

      expect(parsed[1].provinceCode).toBe('LAMDONG');
      expect(parsed[1].precipitationMm).toBe(6.3);
      expect(parsed[1].rainProbability).toBe(100);
      expect(parsed[1].farmingImpactVi).toContain('mưa rải rác');
    });

    it('should map WMO codes cleanly to Vietnamese descriptions and farming impact notes', () => {
      expect(weatherAdapter.mapWmoCodeToVietnamese(0)).toBe('Trời quang, nắng ráo');
      expect(weatherAdapter.mapWmoCodeToVietnamese(53)).toBe('Mưa phùn vừa');
      expect(weatherAdapter.mapWmoCodeToVietnamese(95)).toBe('Mưa dông');

      const heavyImpact = weatherAdapter.buildFarmingImpactNote({
        weatherCode: 95,
        precipitationMm: 22.5,
        rainProbability: 90,
        humidityPct: 92,
      });
      expect(heavyImpact).toContain('Cảnh báo mưa to');

      const humidImpact = weatherAdapter.buildFarmingImpactNote({
        weatherCode: 3,
        precipitationMm: 0.2,
        rainProbability: 20,
        humidityPct: 88,
      });
      expect(humidImpact).toContain('Độ ẩm không khí cao');
    });

    it('should reject out-of-range temperatures and invalid humidity', () => {
      expect(() =>
        weatherAdapter.validateWeatherValues({
          provinceCode: 'DAKLAK',
          tempCurrent: 62, // impossible > 50
          tempMin: 20,
          tempMax: 30,
          precipitationMm: 0,
          rainProbability: 10,
          humidityPct: 60,
          windSpeedKmh: 10,
        }),
      ).toThrow(/Invalid tempCurrent/);

      expect(() =>
        weatherAdapter.validateWeatherValues({
          provinceCode: 'DAKLAK',
          tempCurrent: 25,
          tempMin: 28,
          tempMax: 24, // tempMin > tempMax
          precipitationMm: 0,
          rainProbability: 10,
          humidityPct: 60,
          windSpeedKmh: 10,
        }),
      ).toThrow(/tempMin .* exceeds tempMax/);

      expect(() =>
        weatherAdapter.validateWeatherValues({
          provinceCode: 'DAKLAK',
          tempCurrent: 25,
          tempMin: 20,
          tempMax: 30,
          precipitationMm: 0,
          rainProbability: 10,
          humidityPct: 120, // > 100
          windSpeedKmh: 10,
        }),
      ).toThrow(/Invalid humidityPct/);
    });
  });

  describe('2. IceStocksAdapter & Fallback Mechanism', () => {
    it('should reject ICE Report 173 SPA/click-through shell cleanly without guessing', () => {
      const spaHtml = fs.readFileSync(
        path.join(fixturesDir, 'ice_report_173_spa.html'),
        'utf8',
      );
      expect(() => iceStocksAdapter.parseIceReportHtml(spaHtml)).toThrow(
        /SPA \/ click-through/,
      );
    });

    it('should parse ICE Robusta lots (5.791 lô) from VietnamBiz article while ignoring Arabica bag counts (268.614 bao)', () => {
      const vbHtml = fs.readFileSync(
        path.join(fixturesDir, 'vietnambiz_robusta_stocks.html'),
        'utf8',
      );
      const parsed = iceStocksAdapter.parseVietnambizArticle(
        vbHtml,
        'https://vietnambiz.vn/gia-ca-phe-hom-nay-2411-ap-luc-nguon-cung-2026112410355362.htm',
      );

      expect(parsed).not.toBeNull();
      expect(parsed!.certifiedLots).toBe(5791);
      expect(parsed!.certifiedTonnes).toBe(57910);
      expect(parsed!.reportDate).toBe('2026-11-24');
      expect(parsed!.sourceName).toBe('vietnambiz.vn (fallback)');
      expect(parsed!.isStale).toBe(false);
    });

    it('should fall back cleanly from ICE 173 to VietnamBiz when ICE returns SPA shell', async () => {
      const spaHtml = fs.readFileSync(path.join(fixturesDir, 'ice_report_173_spa.html'), 'utf8');
      const vbArticle = fs.readFileSync(
        path.join(fixturesDir, 'vietnambiz_robusta_stocks.html'),
        'utf8',
      );
      const vbIndex = `<html><body><a href="/gia-ca-phe-hom-nay-2411-test-2026112410355362.htm">News</a></body></html>`;

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('ice.com')) {
          return Promise.resolve({ ok: true, status: 200, text: async () => spaHtml } as any);
        }
        if (url.includes('gia-ca-phe.html')) {
          return Promise.resolve({ ok: true, status: 200, text: async () => vbIndex } as any);
        }
        return Promise.resolve({ ok: true, status: 200, text: async () => vbArticle } as any);
      });

      const res = await iceStocksAdapter.fetch();
      expect(res.success).toBe(true);
      expect(res.source).toBe('vietnambiz.vn (fallback)');
      expect(res.data?.certifiedLots).toBe(5791);
      expect(res.data?.certifiedTonnes).toBe(57910);
    });
  });

  describe('3. IceStocksSanityValidator (Hard Integrity Checks)', () => {
    it('should accept valid ICE Robusta stocks (5.791 lots = 57.910 tonnes) within ±25% DoD delta', () => {
      const result = iceValidator.validate(
        {
          reportDate: '2026-11-24',
          certifiedLots: 5791,
          certifiedTonnes: 57910,
          sourceName: 'vietnambiz.vn',
          isStale: false,
        },
        { previousLots: 5776 },
      );

      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should reject Arabica bag counts (~250,000+) and tiny invalid numbers', () => {
      const arabicaLeak = iceValidator.validate({
        reportDate: '2026-11-24',
        certifiedLots: 268614,
        certifiedTonnes: 2686140,
        sourceName: 'bad_parse',
        isStale: false,
      });
      expect(arabicaLeak.valid).toBe(false);
      expect(arabicaLeak.reasons[0]).toContain('[500, 50000]');

      const tooSmall = iceValidator.validate({
        reportDate: '2026-11-24',
        certifiedLots: 50,
        certifiedTonnes: 500,
        sourceName: 'bad_parse',
        isStale: false,
      });
      expect(tooSmall.valid).toBe(false);
    });

    it('should reject corrupted ±30% day-over-day jump exceeding ±25% threshold', () => {
      const corruptedJump = iceValidator.validate(
        {
          reportDate: '2026-11-25',
          certifiedLots: 7528, // +30.3% from 5776
          certifiedTonnes: 75280,
          sourceName: 'corrupt_source',
          isStale: false,
        },
        { previousLots: 5776 },
      );

      expect(corruptedJump.valid).toBe(false);
      expect(corruptedJump.reasons[0]).toContain('exceeds ±25% threshold');
    });
  });

  describe('4. WeatherController & StocksController', () => {
    it('GET /api/weather/today should return serialized 4 provinces with Đắk Lắk benchmark', async () => {
      prismaMock.dailyWeather.findFirst.mockResolvedValue({
        weather_date: new Date('2026-11-25T00:00:00.000Z'),
      });
      prismaMock.dailyWeather.findMany.mockResolvedValue([
        {
          weather_date: new Date('2026-11-25T00:00:00.000Z'),
          province_code: 'LAMDONG',
          province_name: 'Lâm Đồng',
          temp_current: new Prisma.Decimal(23.5),
          temp_min: new Prisma.Decimal(18.2),
          temp_max: new Prisma.Decimal(28.9),
          precipitation_mm: new Prisma.Decimal(6.3),
          rain_probability: 100,
          humidity_pct: 94,
          wind_speed_kmh: new Prisma.Decimal(1.5),
          weather_code: 53,
          condition_vi: 'Mưa phùn vừa',
          farming_impact_vi: 'Có mưa rải rác',
          updated_at: new Date('2026-11-25T05:45:00.000Z'),
        },
        {
          weather_date: new Date('2026-11-25T00:00:00.000Z'),
          province_code: 'DAKLAK',
          province_name: 'Đắk Lắk',
          temp_current: new Prisma.Decimal(28.7),
          temp_min: new Prisma.Decimal(22.3),
          temp_max: new Prisma.Decimal(30.1),
          precipitation_mm: new Prisma.Decimal(0.0),
          rain_probability: 19,
          humidity_pct: 59,
          wind_speed_kmh: new Prisma.Decimal(17.3),
          weather_code: 0,
          condition_vi: 'Trời quang, nắng ráo',
          farming_impact_vi: 'Thuận lợi phơi sấy',
          updated_at: new Date('2026-11-25T05:45:00.000Z'),
        },
      ]);

      const result = await weatherController.getTodayWeather();
      expect(result.date).toBe('2026-11-25');
      expect(result.benchmark?.province_code).toBe('DAKLAK');
      expect(result.benchmark?.temp_current).toBe(28.7);
      expect(result.provinces[0].province_code).toBe('DAKLAK');
      expect(result.provinces[1].province_code).toBe('LAMDONG');
    });

    it('GET /api/stocks/robusta/latest should throw NotFoundException if empty, otherwise compute 7d delta', async () => {
      prismaMock.iceRobustaStock.findMany.mockResolvedValueOnce([]);
      await expect(stocksController.getLatestRobustaStocks()).rejects.toThrow(NotFoundException);

      prismaMock.iceRobustaStock.findMany.mockResolvedValueOnce([
        {
          report_date: new Date('2026-11-24T00:00:00.000Z'),
          certified_lots: 5791,
          certified_tonnes: new Prisma.Decimal(57910),
          dod_change_lots: 15,
          source_name: 'vietnambiz.vn (fallback)',
          is_stale: false,
          raw_meta: {},
          updated_at: new Date('2026-11-25T01:00:00.000Z'),
        },
        {
          report_date: new Date('2026-11-17T00:00:00.000Z'),
          certified_lots: 6100,
          certified_tonnes: new Prisma.Decimal(61000),
          dod_change_lots: -40,
          source_name: 'vietnambiz.vn (fallback)',
          is_stale: false,
          raw_meta: {},
          updated_at: new Date('2026-11-17T01:00:00.000Z'),
        },
      ]);

      const latest = await stocksController.getLatestRobustaStocks();
      expect(latest.report_date).toBe('2026-11-24');
      expect(latest.certified_lots).toBe(5791);
      expect(latest.certified_tonnes).toBe(57910);
      expect(latest.change_7d_lots).toBe(-309);
      expect(latest.change_30d_lots).toBeNull();
    });
  });
});
