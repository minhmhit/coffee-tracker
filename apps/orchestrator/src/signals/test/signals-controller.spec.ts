import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SignalsController } from '../signals.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('SignalsController (Step 4.2)', () => {
  let controller: SignalsController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      dailySignal: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SignalsController],
      providers: [
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    controller = module.get<SignalsController>(SignalsController);
  });

  describe('GET /api/signals/latest', () => {
    it('should throw NotFoundException if no signals exist', async () => {
      prisma.dailySignal.findFirst.mockResolvedValue(null);
      await expect(controller.getLatestSignal()).rejects.toThrow(NotFoundException);
    });

    it('should return latest daily signal with numeric fields', async () => {
      prisma.dailySignal.findFirst.mockResolvedValue({
        signal_date: new Date('2026-11-22T00:00:00.000Z'),
        basis: new Prisma.Decimal(5200),
        spread: new Prisma.Decimal(337),
        volatility_30d: new Prisma.Decimal(0.0185),
        z_score: new Prisma.Decimal(1.25),
        is_anomaly: false,
        regime: 'BACKWARDATION_STRONG',
        notes: 'Chênh lệch kỳ hạn duy trì mức cao',
      });

      const result = await controller.getLatestSignal();

      expect(result.date).toBe('2026-11-22');
      expect(result.basis_vnd_kg).toBe(5200);
      expect(result.calendar_spread).toBe(337);
      expect(result.volatility_30d).toBe(0.0185);
      expect(result.z_score_30d).toBe(1.25);
      expect(result.is_anomaly).toBe(false);
      expect(result.regime).toBe('BACKWARDATION_STRONG');
      expect(result.notes).toBe('Chênh lệch kỳ hạn duy trì mức cao');
    });
  });

  describe('GET /api/signals/history', () => {
    it('should return historical signals sorted chronologically', async () => {
      prisma.dailySignal.findMany.mockResolvedValue([
        {
          signal_date: new Date('2026-11-21T00:00:00.000Z'),
          basis: new Prisma.Decimal(5100),
          spread: new Prisma.Decimal(320),
          volatility_30d: new Prisma.Decimal(0.0180),
          z_score: new Prisma.Decimal(1.10),
          is_anomaly: false,
          regime: 'BACKWARDATION_STRONG',
        },
        {
          signal_date: new Date('2026-11-22T00:00:00.000Z'),
          basis: new Prisma.Decimal(5200),
          spread: new Prisma.Decimal(337),
          volatility_30d: new Prisma.Decimal(0.0185),
          z_score: new Prisma.Decimal(1.25),
          is_anomaly: false,
          regime: 'BACKWARDATION_STRONG',
        },
      ]);

      const history = await controller.getSignalsHistory('30');

      expect(history.length).toBe(2);
      expect(history[0].date).toBe('2026-11-21');
      expect(history[0].basis).toBe(5100);
      expect(history[1].date).toBe('2026-11-22');
      expect(history[1].basis).toBe(5200);
    });

    it('should support from and to date filters', async () => {
      prisma.dailySignal.findMany.mockResolvedValue([]);

      await controller.getSignalsHistory(undefined, '2026-10-01', '2026-11-01');

      expect(prisma.dailySignal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            signal_date: {
              gte: new Date('2026-10-01'),
              lte: new Date('2026-11-01'),
            },
          },
        }),
      );
    });
  });
});
