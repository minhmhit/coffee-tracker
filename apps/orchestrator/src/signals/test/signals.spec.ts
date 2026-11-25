import { SignalsService } from '../signals.service';
import { SignalsProcessor } from '../processors/signals.processor';
import { ALERT_JOBS, REGIME_LABELS, SIGNALS_JOBS } from '../signals.constants';
import { Prisma, RawMarketPrice } from '@prisma/client';
import { Queue } from 'bullmq';

describe('Daily Signals Suite (Step 2.1)', () => {
  let signalsService: SignalsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      rawMarketPrice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      dailySignal: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    signalsService = new SignalsService(prismaMock);
  });

  describe('1. Signals Math & Logic (SignalsService.computeSignals)', () => {
    const createPriceRecord = (
      date: string,
      daklak: number,
      m1?: number,
      m6?: number,
      fx?: number,
    ): RawMarketPrice =>
      ({
        id: 1,
        price_date: new Date(`${date}T00:00:00.000Z`),
        price_daklak: new Prisma.Decimal(daklak),
        price_lamdong: new Prisma.Decimal(daklak - 600),
        price_gialai: new Prisma.Decimal(daklak - 100),
        price_daknong: new Prisma.Decimal(daklak + 200),
        price_avg: new Prisma.Decimal(daklak),
        london_m1: m1 !== undefined ? new Prisma.Decimal(m1) : null,
        london_m3: null,
        london_m6: m6 !== undefined ? new Prisma.Decimal(m6) : null,
        usd_vnd: fx !== undefined ? new Prisma.Decimal(fx) : null,
        brent_oil: null,
        source_meta: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as RawMarketPrice);

    it('should compute exact Basis = DakLak - (LondonM1 / 1000 * USD_VND)', () => {
      // Dak Lak = 71,800 đ/kg, London M1 = 4565 USD/t, USD/VND = 25,600
      // LondonVND = (4565 / 1000) * 25600 = 116,864 VND/kg
      // Basis = 71800 - 116864 = -45064 VND/kg
      const current = createPriceRecord('2026-11-22', 71800, 4565, 4228, 25600);
      const result = signalsService.computeSignals(current, []);

      expect(result.basis).toBe(-45064);
    });

    it('should compute Calendar Spread (M1 - M6) and classify market regimes correctly', () => {
      // 1. Strong Backwardation (> +200 USD)
      const cur1 = createPriceRecord('2024-06-01', 120000, 4500, 4100, 25000);
      const res1 = signalsService.computeSignals(cur1, []);
      expect(res1.spread).toBe(400);
      expect(res1.regime).toBe(REGIME_LABELS.BACKWARDATION_STRONG);

      // 2. Mild Backwardation (0 to +200 USD)
      const cur2 = createPriceRecord('2022-05-01', 45000, 2200, 2100, 23000);
      const res2 = signalsService.computeSignals(cur2, []);
      expect(res2.spread).toBe(100);
      expect(res2.regime).toBe(REGIME_LABELS.BACKWARDATION_MILD);

      // 3. Mild Contango (-150 to 0 USD)
      const cur3 = createPriceRecord('2019-05-01', 32000, 1400, 1450, 23200);
      const res3 = signalsService.computeSignals(cur3, []);
      expect(res3.spread).toBe(-50);
      expect(res3.regime).toBe(REGIME_LABELS.CONTANGO_MILD);

      // 4. Strong Contango (< -150 USD)
      const cur4 = createPriceRecord('2018-05-01', 35000, 1500, 1720, 22800);
      const res4 = signalsService.computeSignals(cur4, []);
      expect(res4.spread).toBe(-220);
      expect(res4.regime).toBe(REGIME_LABELS.CONTANGO_STRONG);

      // 5. Missing M6 -> INSUFFICIENT_DATA
      const cur5 = createPriceRecord('2020-01-01', 32000, 1300, undefined, 23000);
      const res5 = signalsService.computeSignals(cur5, []);
      expect(res5.spread).toBeNull();
      expect(res5.regime).toBe(REGIME_LABELS.INSUFFICIENT_DATA);
    });

    it('should handle division-by-zero safely when returns volatility is zero', () => {
      // All prices completely flat at 70,000 for 5 days -> std = 0
      const preceding = [
        createPriceRecord('2026-11-15', 70000, 4000, 3900, 25000),
        createPriceRecord('2026-11-16', 70000, 4000, 3900, 25000),
        createPriceRecord('2026-11-17', 70000, 4000, 3900, 25000),
      ];
      const current = createPriceRecord('2026-11-18', 70000, 4000, 3900, 25000);

      const result = signalsService.computeSignals(current, preceding);

      expect(result.volatility30d).toBe(0);
      expect(result.zScore).toBe(0);
      expect(result.isAnomaly).toBe(false);
    });

    it('should flag is_anomaly = true when daily price jump creates |Z-score| > 2.5', () => {
      // Stable prices around 70,000 with low daily changes (~0.2%)
      const preceding: RawMarketPrice[] = [];
      let base = 70000;
      for (let i = 1; i <= 20; i++) {
        base += (i % 2 === 0 ? 100 : -100);
        preceding.push(
          createPriceRecord(
            `2026-10-${i < 10 ? '0' + i : i}`,
            base,
            4000,
            3900,
            25000,
          ),
        );
      }

      // Sudden +10% price shock on the target day
      const current = createPriceRecord('2026-11-01', 77000, 4000, 3900, 25000);

      const result = signalsService.computeSignals(current, preceding);

      expect(result.zScore).toBeGreaterThan(2.5);
      expect(result.isAnomaly).toBe(true);
    });
  });

  describe('2. SignalsProcessor Workflow & Alert Dispatch', () => {
    let processor: SignalsProcessor;
    let alertQueueMock: jest.Mocked<Partial<Queue>>;
    let mockService: jest.Mocked<Partial<SignalsService>>;

    beforeEach(() => {
      alertQueueMock = {
        add: jest.fn().mockResolvedValue({ id: 'alert-1' } as any),
      };
      mockService = {
        computeSignalsForDate: jest.fn(),
      };
      processor = new SignalsProcessor(mockService as any, alertQueueMock as any);
    });

    it('should process regular signals job and NOT dispatch anomaly alert if is_anomaly is false', async () => {
      mockService.computeSignalsForDate!.mockResolvedValue({
        signal_date: new Date('2026-11-22'),
        basis: new Prisma.Decimal(-45000),
        spread: new Prisma.Decimal(337),
        volatility_30d: new Prisma.Decimal(0.0125),
        z_score: new Prisma.Decimal(1.15),
        is_anomaly: false,
        regime: REGIME_LABELS.BACKWARDATION_STRONG,
        notes: 'Normal day',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const job: any = {
        id: 'sig-job-1',
        data: { targetDate: '2026-11-22' },
        opts: { attempts: 3 },
        attemptsMade: 0,
      };

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.isAnomaly).toBe(false);
      expect(alertQueueMock.add).not.toHaveBeenCalled();
    });

    it('should dispatch high-priority ANOMALY_ALERT to alert-queue when is_anomaly is true', async () => {
      mockService.computeSignalsForDate!.mockResolvedValue({
        signal_date: new Date('2026-11-22'),
        basis: new Prisma.Decimal(-45000),
        spread: new Prisma.Decimal(337),
        volatility_30d: new Prisma.Decimal(0.045),
        z_score: new Prisma.Decimal(3.2),
        is_anomaly: true,
        regime: REGIME_LABELS.BACKWARDATION_STRONG,
        notes: 'Massive shock',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const job: any = {
        id: 'sig-job-anomaly',
        data: { targetDate: '2026-11-22' },
        opts: { attempts: 3 },
        attemptsMade: 0,
      };

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.isAnomaly).toBe(true);
      expect(alertQueueMock.add).toHaveBeenCalledWith(
        ALERT_JOBS.ANOMALY_ALERT,
        expect.objectContaining({
          signalDate: '2026-11-22',
          zScore: '3.2',
          regime: REGIME_LABELS.BACKWARDATION_STRONG,
        }),
        expect.objectContaining({
          priority: 1,
        }),
      );
    });
  });
});
