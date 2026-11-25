import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { InsightsService } from '../insights.service';
import { InsightsController } from '../insights.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('Explainable Market Insights Engine (Step 5.2)', () => {
  let service: InsightsService;
  let controller: InsightsController;
  let prisma: any;

  const makePriceRow = (
    dateStr: string,
    daklak: number,
    brent: number,
    usdVnd: number,
    m1 = 4565,
    m6 = 4228,
  ): any => ({
    price_date: new Date(`${dateStr}T00:00:00.000Z`),
    price_daklak: new Prisma.Decimal(daklak),
    price_lamdong: new Prisma.Decimal(daklak - 600),
    price_gialai: new Prisma.Decimal(daklak),
    price_daknong: new Prisma.Decimal(daklak + 200),
    price_avg: new Prisma.Decimal(daklak - 100),
    london_m1: new Prisma.Decimal(m1),
    london_m3: new Prisma.Decimal(m1 - 200),
    london_m6: new Prisma.Decimal(m6),
    usd_vnd: new Prisma.Decimal(usdVnd),
    brent_oil: new Prisma.Decimal(brent),
  });

  beforeEach(async () => {
    prisma = {
      rawMarketPrice: { findMany: jest.fn() },
      dailySignal: { findFirst: jest.fn() },
      iceRobustaStock: { findMany: jest.fn() },
      dailyWeather: { findMany: jest.fn() },
      macroClimateMonthly: { findMany: jest.fn() },
      forecastRun: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [
        InsightsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
    controller = module.get<InsightsController>(InsightsController);
  });

  describe('1. Full Orchestrated Insights Response', () => {
    it('should synthesize all 5 dimensions with exact DB numbers and zero NaN/undefined', async () => {
      // 10 days of market prices: Brent +4.6% in 7 days (86.00 -> 89.95), FX stable
      const mockPrices = Array.from({ length: 10 }, (_, idx) => {
        const day = 22 - idx;
        const brent = idx === 0 ? 89.95 : idx >= 7 ? 86.0 : 88.0;
        return makePriceRow(`2026-11-${String(day).padStart(2, '0')}`, 71800, brent, 25600);
      });

      prisma.rawMarketPrice.findMany.mockResolvedValue(mockPrices);
      prisma.dailySignal.findFirst.mockResolvedValue({
        signal_date: new Date('2026-11-22T00:00:00.000Z'),
        basis: new Prisma.Decimal(-45064),
        spread: new Prisma.Decimal(337),
        volatility_30d: new Prisma.Decimal(0.0044),
        z_score: new Prisma.Decimal(-0.81),
        is_anomaly: false,
        regime: 'BACKWARDATION_STRONG',
      });
      prisma.iceRobustaStock.findMany.mockResolvedValue([
        {
          report_date: new Date('2026-11-24T00:00:00.000Z'),
          certified_lots: 5791,
          certified_tonnes: new Prisma.Decimal(57910),
          dod_change_lots: 15,
          source_name: 'vietnambiz.vn (fallback)',
          is_stale: false,
        },
      ]);
      prisma.dailyWeather.findMany.mockResolvedValue([
        {
          weather_date: new Date('2026-11-25T00:00:00.000Z'),
          province_code: 'DAKLAK',
          province_name: 'Đắk Lắk',
          temp_current: new Prisma.Decimal(28.4),
          temp_min: new Prisma.Decimal(22.3),
          temp_max: new Prisma.Decimal(30.1),
          precipitation_mm: new Prisma.Decimal(0),
          humidity_pct: 60,
          condition_vi: 'Trời quang, nắng ráo',
          farming_impact_vi: 'Thời tiết nắng ráo, thuận lợi thu hái phơi sấy.',
        },
      ]);
      // Test non-null ONI fallback across months (Nov/Oct null, Sep +2.46)
      prisma.macroClimateMonthly.findMany.mockResolvedValue([
        {
          month_date: new Date('2026-11-01T00:00:00.000Z'),
          oni_index: null,
          vn_rain_anomaly: new Prisma.Decimal(-80.13),
          br_rain_anomaly: new Prisma.Decimal(38.69),
        },
        {
          month_date: new Date('2026-09-01T00:00:00.000Z'),
          oni_index: new Prisma.Decimal(2.46),
          vn_rain_anomaly: new Prisma.Decimal(172.22),
          br_rain_anomaly: new Prisma.Decimal(36.07),
        },
      ]);
      prisma.forecastRun.findFirst.mockResolvedValue({
        run_id: 'b10e0d43-d324-4253-b76a-472333f4af25',
        forecast_date: new Date('2026-11-22T00:00:00.000Z'),
        status: 'SUCCESS',
        model_version: 'two_legged_walk_forward_v1',
        metrics: {
          wf_mape_4w: 1.36,
          wf_mape_12w: 2.45,
          wf_mape_26w: 5.68,
          pinball_loss: 0.0083,
          beats_naive_baseline: false,
        },
        predictions: [4, 12, 26].map((w) => ({
          horizon_week: w,
          target_date: new Date(`2027-0${w === 4 ? 1 : w === 12 ? 2 : 5}-15T00:00:00.000Z`),
          pred_p10: new Prisma.Decimal(70500 + w * 100),
          pred_p50: new Prisma.Decimal(71800 + w * 135),
          pred_p90: new Prisma.Decimal(75000 + w * 800),
          baseline_rw: new Prisma.Decimal(71800),
          baseline_futures: new Prisma.Decimal(w === 26 ? 69517 : 74000),
        })),
      });

      const res = await controller.getLatestInsights();
      const serialized = JSON.stringify(res);

      expect(serialized).not.toContain('NaN');
      expect(res.as_of_date).toBe('2026-11-22');
      expect(res.overall_stance).toBe('TÍCH CỰC');
      expect(res.factors).toHaveLength(4);

      const oil = res.factors.find((f) => f.key === 'oil')!;
      expect(oil.trend).toBe('UP');
      expect(oil.explanation).toContain('$89.95/thùng');

      const inv = res.factors.find((f) => f.key === 'inventory_supply')!;
      expect(inv.trend).toBe('UP');
      expect(inv.explanation).toContain('5.791 lô');
      expect(inv.explanation).toContain('+$337/tấn');

      const weather = res.factors.find((f) => f.key === 'weather_climate')!;
      expect(weather.explanation).toContain('28.4°C');
      expect(weather.explanation).toContain('+2.46');
      expect(weather.explanation).toContain('-80.1 mm');

      expect(res.forecast_transparency.available).toBe(true);
      expect(res.forecast_transparency.milestones).toHaveLength(3);
      expect(res.forecast_transparency.confidence_note).toContain('1.36%');
      expect(res.forecast_transparency.confidence_note).toContain('5.68%');
      expect(res.forecast_transparency.metrics?.beats_naive_baseline).toBe(false);
    });
  });

  describe('2. Factor Trend Branches & Fallbacks', () => {
    it('should detect Oil DOWN trend when Brent drops >= 1.5% over 7 days', () => {
      const prices = Array.from({ length: 10 }, (_, idx) =>
        makePriceRow(`2026-11-${String(22 - idx).padStart(2, '0')}`, 70000, idx === 0 ? 78.0 : 84.0, 25500),
      );
      const oil = service.analyzeOil(prices);

      expect(oil.trend).toBe('DOWN');
      expect(oil.badge_label).toContain('GIẢM');
      expect(oil.explanation).toContain('$78.00/thùng');
    });

    it('should detect rising ICE Robusta stocks + Contango as bearish supply pressure (DOWN)', () => {
      const stocks: any[] = [
        {
          report_date: new Date('2026-11-24T00:00:00.000Z'),
          certified_lots: 6500,
          certified_tonnes: new Prisma.Decimal(65000),
          dod_change_lots: 120,
          source_name: 'vietnambiz.vn (fallback)',
          is_stale: false,
        },
        {
          report_date: new Date('2026-11-17T00:00:00.000Z'),
          certified_lots: 5900, // +600 lots in 7d
          certified_tonnes: new Prisma.Decimal(59000),
          dod_change_lots: 40,
          source_name: 'vietnambiz.vn (fallback)',
          is_stale: false,
        },
      ];
      const contangoSignal: any = {
        basis: new Prisma.Decimal(-5000),
        spread: new Prisma.Decimal(-210),
        regime: 'CONTANGO_STRONG',
      };

      const card = service.analyzeInventoryAndSupply(stocks, contangoSignal, null);

      expect(card.trend).toBe('DOWN');
      expect(card.badge_label).toContain('TỒN KHO TĂNG (+600 LÔ / 7N)');
      expect(card.explanation).toContain('+600 lô');
      expect(card.explanation).toContain('CONTANGO_STRONG');

      // When 7d stock history is not yet populated, badge reflects Contango
      const contangoOnly = service.analyzeInventoryAndSupply([stocks[0]], contangoSignal, null);
      expect(contangoOnly.trend).toBe('DOWN');
      expect(contangoOnly.badge_label).toContain('CONTANGO');
    });

    it('should disclose stale ICE Robusta stock carry-forward clearly and degrade safely when empty', () => {
      const staleStocks: any[] = [
        {
          report_date: new Date('2026-11-24T00:00:00.000Z'),
          certified_lots: 5791,
          certified_tonnes: new Prisma.Decimal(57910),
          dod_change_lots: 0,
          source_name: 'stale_carry_forward',
          is_stale: true,
        },
      ];

      const staleCard = service.analyzeInventoryAndSupply(staleStocks, null, null);
      expect(staleCard.explanation).toContain('giữ số liệu');

      const emptyCard = service.analyzeInventoryAndSupply([], null, null);
      expect(emptyCard.explanation).toContain('Chưa có bản ghi tồn kho');
    });

    it('should flag heavy Central Highlands rain in Weather card', () => {
      const rainyRows: any[] = [
        {
          weather_date: new Date('2026-11-25T00:00:00.000Z'),
          province_code: 'DAKLAK',
          province_name: 'Đắk Lắk',
          temp_current: new Prisma.Decimal(23.2),
          temp_min: new Prisma.Decimal(19.0),
          temp_max: new Prisma.Decimal(25.5),
          precipitation_mm: new Prisma.Decimal(24.8),
          humidity_pct: 93,
          condition_vi: 'Mưa to',
          farming_impact_vi: 'Cảnh báo mưa to (24.8 mm): tạm hoãn phơi hạt.',
        },
      ];

      const card = service.analyzeWeatherAndClimate(rainyRows, []);
      expect(card.trend).toBe('UP');
      expect(card.badge_label).toContain('CẢNH BÁO MƯA TO');
    });

    it('should handle completely empty database cleanly without throwing HTTP 500', async () => {
      prisma.rawMarketPrice.findMany.mockResolvedValue([]);
      prisma.dailySignal.findFirst.mockResolvedValue(null);
      prisma.iceRobustaStock.findMany.mockResolvedValue([]);
      prisma.dailyWeather.findMany.mockResolvedValue([]);
      prisma.macroClimateMonthly.findMany.mockResolvedValue([]);
      prisma.forecastRun.findFirst.mockResolvedValue(null);

      const res = await service.getLatestInsights();
      expect(res.overall_stance).toBe('TRUNG LẬP');
      expect(res.factors).toHaveLength(4);
      expect(res.forecast_transparency.available).toBe(false);
    });
  });
});
