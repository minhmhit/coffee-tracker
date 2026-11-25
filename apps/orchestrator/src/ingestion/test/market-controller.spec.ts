import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MarketController } from '../market.controller';
import { ClimateController } from '../climate.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('Market and Climate Controllers (Step 4.2)', () => {
  let marketController: MarketController;
  let climateController: ClimateController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      rawMarketPrice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      macroClimateMonthly: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketController, ClimateController],
      providers: [
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    marketController = module.get<MarketController>(MarketController);
    climateController = module.get<ClimateController>(ClimateController);
  });

  describe('1. MarketController - GET /api/market/latest', () => {
    it('should throw NotFoundException if no records exist', async () => {
      prisma.rawMarketPrice.findMany.mockResolvedValue([]);
      await expect(marketController.getLatestSnapshot()).rejects.toThrow(NotFoundException);
    });

    it('should calculate DoD and WoW percentage and VND changes correctly', async () => {
      const mockRecords = [
        {
          price_date: new Date('2026-11-22T00:00:00.000Z'),
          price_daklak: new Prisma.Decimal(71800),
          price_lamdong: new Prisma.Decimal(71000),
          price_gialai: new Prisma.Decimal(71500),
          price_daknong: new Prisma.Decimal(71900),
          price_avg: new Prisma.Decimal(71550),
          london_m1: new Prisma.Decimal(4565),
          london_m3: new Prisma.Decimal(4410),
          london_m6: new Prisma.Decimal(4228),
          usd_vnd: new Prisma.Decimal(25600),
          brent_oil: new Prisma.Decimal(74.5),
        },
        {
          price_date: new Date('2026-11-21T00:00:00.000Z'),
          price_daklak: new Prisma.Decimal(71200), // DoD diff: +600 (+0.84%)
          price_lamdong: new Prisma.Decimal(70500),
          price_gialai: new Prisma.Decimal(71000),
          price_daknong: new Prisma.Decimal(71300),
          price_avg: new Prisma.Decimal(71000),
          london_m1: new Prisma.Decimal(4520),
          london_m3: new Prisma.Decimal(4380),
          london_m6: new Prisma.Decimal(4200),
          usd_vnd: new Prisma.Decimal(25580),
          brent_oil: new Prisma.Decimal(75.0),
        },
        // 5 filler records
        ...Array.from({ length: 5 }, (_, i) => ({
          price_date: new Date(`2026-11-${20 - i}T00:00:00.000Z`),
          price_daklak: new Prisma.Decimal(70500),
          price_lamdong: new Prisma.Decimal(70000),
          price_gialai: new Prisma.Decimal(70200),
          price_daknong: new Prisma.Decimal(70600),
          price_avg: new Prisma.Decimal(70325),
          london_m1: new Prisma.Decimal(4450),
          london_m3: new Prisma.Decimal(4300),
          london_m6: new Prisma.Decimal(4150),
          usd_vnd: new Prisma.Decimal(25550),
          brent_oil: new Prisma.Decimal(75.2),
        })),
        {
          price_date: new Date('2026-11-15T00:00:00.000Z'),
          price_daklak: new Prisma.Decimal(70050), // WoW diff: +1750 (+2.50%)
          price_lamdong: new Prisma.Decimal(69500),
          price_gialai: new Prisma.Decimal(69800),
          price_daknong: new Prisma.Decimal(70100),
          price_avg: new Prisma.Decimal(69862),
          london_m1: new Prisma.Decimal(4400),
          london_m3: new Prisma.Decimal(4250),
          london_m6: new Prisma.Decimal(4100),
          usd_vnd: new Prisma.Decimal(25500),
          brent_oil: new Prisma.Decimal(76.0),
        },
      ];

      prisma.rawMarketPrice.findMany.mockResolvedValue(mockRecords);

      const result = await marketController.getLatestSnapshot();

      expect(result.date).toBe('2026-11-22');
      expect(result.prices.daklak).toBe(71800);
      expect(result.prices.lamdong).toBe(71000);
      expect(result.futures.london_m1).toBe(4565);
      expect(result.macro.usd_vnd).toBe(25600);
      expect(result.changes.dod_vnd).toBe(600);
      expect(result.changes.dod_pct).toBe(0.0084);
      expect(result.changes.wow_vnd).toBe(1750);
      expect(result.changes.wow_pct).toBe(0.025);
    });
  });

  describe('2. MarketController - GET /api/market/history', () => {
    it('should return chronological market prices with proper number serialization', async () => {
      const mockRecords = [
        {
          price_date: new Date('2026-11-20T00:00:00.000Z'),
          price_daklak: new Prisma.Decimal(71000),
          price_lamdong: new Prisma.Decimal(70500),
          price_gialai: new Prisma.Decimal(70800),
          price_daknong: new Prisma.Decimal(71100),
          price_avg: new Prisma.Decimal(70850),
          london_m1: new Prisma.Decimal(4500),
          london_m3: new Prisma.Decimal(4350),
          london_m6: new Prisma.Decimal(4180),
          usd_vnd: new Prisma.Decimal(25580),
          brent_oil: new Prisma.Decimal(75.1),
        },
        {
          price_date: new Date('2026-11-21T00:00:00.000Z'),
          price_daklak: new Prisma.Decimal(71200),
          price_lamdong: new Prisma.Decimal(70600),
          price_gialai: new Prisma.Decimal(71000),
          price_daknong: new Prisma.Decimal(71300),
          price_avg: new Prisma.Decimal(71025),
          london_m1: new Prisma.Decimal(4520),
          london_m3: new Prisma.Decimal(4380),
          london_m6: new Prisma.Decimal(4200),
          usd_vnd: new Prisma.Decimal(25590),
          brent_oil: new Prisma.Decimal(74.8),
        },
      ];

      prisma.rawMarketPrice.findMany.mockResolvedValue(mockRecords);

      const history = await marketController.getMarketHistory('30');

      expect(history.length).toBe(2);
      expect(history[0].date).toBe('2026-11-20');
      expect(history[0].price_daklak).toBe(71000);
      expect(typeof history[0].price_daklak).toBe('number');
      expect(history[1].date).toBe('2026-11-21');
      expect(history[1].price_daklak).toBe(71200);
    });

    it('should filter by from and to dates if provided', async () => {
      prisma.rawMarketPrice.findMany.mockResolvedValue([]);

      await marketController.getMarketHistory(undefined, '2026-01-01', '2026-06-30');

      expect(prisma.rawMarketPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            price_date: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          },
        }),
      );
    });
  });

  describe('3. ClimateController - GET /api/climate/latest & /history', () => {
    it('should throw NotFoundException if no climate records exist', async () => {
      prisma.macroClimateMonthly.findFirst.mockResolvedValue(null);
      await expect(climateController.getLatestClimate()).rejects.toThrow(NotFoundException);
    });

    it('should return latest climate record with numeric values', async () => {
      prisma.macroClimateMonthly.findFirst.mockResolvedValue({
        month_date: new Date('2026-11-01T00:00:00.000Z'),
        oni_index: new Prisma.Decimal(-0.4),
        vn_rain_anomaly: new Prisma.Decimal(15.2),
        br_rain_anomaly: new Prisma.Decimal(-4.8),
      });

      const latest = await climateController.getLatestClimate();

      expect(latest.month_date).toBe('2026-11-01');
      expect(latest.oni).toBe(-0.4);
      expect(latest.rainfall_anomaly_daklak).toBe(15.2);
      expect(latest.rainfall_anomaly_linhares).toBe(-4.8);
    });

    it('should return historical climate series in ascending order', async () => {
      prisma.macroClimateMonthly.findMany.mockResolvedValue([
        {
          month_date: new Date('2026-11-01T00:00:00.000Z'),
          oni_index: new Prisma.Decimal(-0.4),
          vn_rain_anomaly: new Prisma.Decimal(15.2),
          br_rain_anomaly: new Prisma.Decimal(-4.8),
        },
        {
          month_date: new Date('2026-10-01T00:00:00.000Z'),
          oni_index: new Prisma.Decimal(-0.3),
          vn_rain_anomaly: new Prisma.Decimal(10.1),
          br_rain_anomaly: new Prisma.Decimal(-2.3),
        },
      ]);

      const history = await climateController.getClimateHistory('12');

      expect(history.length).toBe(2);
      expect(history[0].month_date).toBe('2026-10-01');
      expect(history[1].month_date).toBe('2026-11-01');
    });
  });
});
