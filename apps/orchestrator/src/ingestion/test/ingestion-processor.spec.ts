import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { IngestionProcessor } from '../processors/ingestion.processor';
import { IngestionScheduler } from '../schedulers/ingestion.scheduler';
import { IngestionService } from '../ingestion.service';
import { INGESTION_CRONS, INGESTION_JOBS, INGESTION_QUEUE_NAME } from '../ingestion.constants';
import { ALERT_JOBS, ALERT_QUEUE_NAME, SIGNALS_JOBS, SIGNALS_QUEUE_NAME } from '../../signals/signals.constants';
import { Prisma } from '@prisma/client';

describe('IngestionProcessor & Scheduler Suite (Step 1.2 & 1.3)', () => {
  let processor: IngestionProcessor;
  let scheduler: IngestionScheduler;
  let ingestionService: jest.Mocked<Partial<IngestionService>>;
  let queueMock: jest.Mocked<Partial<Queue>>;
  let signalsQueueMock: jest.Mocked<Partial<Queue>>;
  let alertQueueMock: jest.Mocked<Partial<Queue>>;

  const mockSnapshot = {
    date: '2026-11-22',
    domestic: {
      daklak: 71800,
      lamdong: 71200,
      gialai: 71800,
      daknong: 72000,
      average: 71700,
    },
    london: {
      m1: 4565,
      m3: 4335,
      m6: 4228,
    },
    exchangeRate: {
      usdVnd: 25600,
      source: 'Vietcombank XML',
      publishedAt: '2026-11-22',
    },
    brentOil: {
      price: 89.95,
      currency: 'USD',
      source: 'Yahoo',
    },
    sourceMeta: {
      domestic_source: 'giacaphe.com',
    },
  };

  const mockRecord: any = {
    id: 1234,
    price_date: new Date('2026-11-22T00:00:00.000Z'),
    price_daklak: new Prisma.Decimal(71800),
    price_lamdong: new Prisma.Decimal(71200),
    price_gialai: new Prisma.Decimal(71800),
    price_daknong: new Prisma.Decimal(72000),
    price_avg: new Prisma.Decimal(71700),
    london_m1: new Prisma.Decimal(4565),
    london_m3: new Prisma.Decimal(4335),
    london_m6: new Prisma.Decimal(4228),
    usd_vnd: new Prisma.Decimal(25600),
    brent_oil: new Prisma.Decimal(89.95),
  };

  beforeEach(async () => {
    ingestionService = {
      fetchDailySnapshot: jest.fn(),
      upsertDailySnapshot: jest.fn(),
      getLatestDaklakPrice: jest.fn(),
      syncMacroClimateMonthly: jest.fn(),
    };

    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' } as any),
      upsertJobScheduler: jest.fn().mockResolvedValue({} as any),
      getJobSchedulersCount: jest.fn().mockResolvedValue(3),
    };

    signalsQueueMock = {
      add: jest.fn().mockResolvedValue({ id: 'sig-job-1' } as any),
    };

    alertQueueMock = {
      add: jest.fn().mockResolvedValue({ id: 'alert-job-1' } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionProcessor,
        IngestionScheduler,
        {
          provide: IngestionService,
          useValue: ingestionService,
        },
        {
          provide: getQueueToken(INGESTION_QUEUE_NAME),
          useValue: queueMock,
        },
        {
          provide: getQueueToken(SIGNALS_QUEUE_NAME),
          useValue: signalsQueueMock,
        },
        {
          provide: getQueueToken(ALERT_QUEUE_NAME),
          useValue: alertQueueMock,
        },
      ],
    }).compile();

    processor = module.get<IngestionProcessor>(IngestionProcessor);
    scheduler = module.get<IngestionScheduler>(IngestionScheduler);
  });

  describe('1. IngestionProcessor', () => {
    it('should successfully process a valid daily ingestion job, perform idempotent upsert, and chain signals-queue', async () => {
      ingestionService.fetchDailySnapshot!.mockResolvedValue({
        snapshot: mockSnapshot,
        sanityResult: { valid: true, reasons: [] },
        errors: [],
      });
      ingestionService.upsertDailySnapshot!.mockResolvedValue(mockRecord);

      const job = {
        id: 'job-test-1',
        name: INGESTION_JOBS.DAILY_MARKET_DATA,
        data: { trigger: 'test_run' },
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as unknown as Job;

      const result = await processor.process(job as any);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe(1234);
      expect(result.daklak).toBe('71800');
      expect(ingestionService.fetchDailySnapshot).toHaveBeenCalledTimes(1);
      expect(ingestionService.upsertDailySnapshot).toHaveBeenCalledWith(mockSnapshot);

      // Verify automatic pipeline chaining
      expect(signalsQueueMock.add).toHaveBeenCalledWith(
        SIGNALS_JOBS.COMPUTE_DAILY_SIGNALS,
        expect.objectContaining({
          targetDate: '2026-11-22',
          trigger: 'auto_chained_from_ingestion',
        }),
        expect.any(Object),
      );
    });

    it('should successfully process monthly climate sync job', async () => {
      ingestionService.syncMacroClimateMonthly!.mockResolvedValue({
        syncedCount: 107,
        earliestDate: '2018-01-01',
        latestDate: '2026-11-01',
        latestOni: 2.46,
      });

      const job = {
        id: 'job-climate-1',
        name: INGESTION_JOBS.MONTHLY_CLIMATE,
        data: { trigger: 'cron_monthly_climate_05_0300' },
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as unknown as Job;

      const result = await processor.process(job as any);

      expect(result.success).toBe(true);
      expect(result.type).toBe('monthly_climate');
      expect(result.syncedCount).toBe(107);
      expect(ingestionService.syncMacroClimateMonthly).toHaveBeenCalledTimes(1);
    });

    it('should throw an Error to trigger BullMQ retry when sanity validation rejects snapshot', async () => {
      ingestionService.fetchDailySnapshot!.mockResolvedValue({
        snapshot: mockSnapshot,
        sanityResult: {
          valid: false,
          reasons: ['Price jump 25% exceeds ±15% threshold'],
        },
        errors: [],
      });

      const job = {
        id: 'job-test-fail',
        name: INGESTION_JOBS.DAILY_MARKET_DATA,
        data: { trigger: 'test_spike' },
        attemptsMade: 1,
        opts: { attempts: 5 },
      } as unknown as Job;

      await expect(processor.process(job as any)).rejects.toThrow(
        /Ingestion sanity validation failed/,
      );
      expect(ingestionService.upsertDailySnapshot).not.toHaveBeenCalled();
      expect(signalsQueueMock.add).not.toHaveBeenCalled();
    });

    it('should log warning and dispatch SYSTEM_ERROR alert when all retries are exhausted', async () => {
      const job = {
        id: 'job-retry',
        name: INGESTION_JOBS.DAILY_MARKET_DATA,
        attemptsMade: 5,
        opts: { attempts: 5 },
      } as unknown as Job;

      await processor.onJobFailed(job as any, new Error('Network timeout'));

      expect(alertQueueMock.add).toHaveBeenCalledWith(
        ALERT_JOBS.SYSTEM_ERROR,
        expect.objectContaining({
          queueName: INGESTION_QUEUE_NAME,
          jobId: 'job-retry',
          jobName: INGESTION_JOBS.DAILY_MARKET_DATA,
          attempts: 5,
          maxAttempts: 5,
          errorMessage: 'Network timeout',
        }),
        expect.any(Object),
      );
    });
  });

  describe('2. IngestionScheduler', () => {
    it('should register morning domestic, London close, and monthly climate repeatable jobs on module init', async () => {
      await scheduler.onModuleInit();

      expect(queueMock.upsertJobScheduler).toHaveBeenCalledTimes(3);

      // 1. Morning Central Highlands cron
      expect(queueMock.upsertJobScheduler).toHaveBeenNthCalledWith(
        1,
        'morning_domestic_0830',
        {
          pattern: INGESTION_CRONS.MORNING_DOMESTIC,
          tz: INGESTION_CRONS.TIMEZONE,
        },
        expect.objectContaining({
          name: INGESTION_JOBS.DAILY_MARKET_DATA,
          data: { trigger: 'cron_morning_domestic_0830' },
        }),
      );

      // 2. ICE London close cron
      expect(queueMock.upsertJobScheduler).toHaveBeenNthCalledWith(
        2,
        'night_london_close_0100',
        {
          pattern: INGESTION_CRONS.NIGHT_LONDON_CLOSE,
          tz: INGESTION_CRONS.TIMEZONE,
        },
        expect.objectContaining({
          name: INGESTION_JOBS.DAILY_MARKET_DATA,
          data: { trigger: 'cron_night_london_close_0100' },
        }),
      );

      // 3. Monthly Climate cron (05th at 03:00)
      expect(queueMock.upsertJobScheduler).toHaveBeenNthCalledWith(
        3,
        'monthly_climate_05_0300',
        {
          pattern: INGESTION_CRONS.MONTHLY_CLIMATE,
          tz: INGESTION_CRONS.TIMEZONE,
        },
        expect.objectContaining({
          name: INGESTION_JOBS.MONTHLY_CLIMATE,
          data: { trigger: 'cron_monthly_climate_05_0300' },
        }),
      );
    });

    it('should allow immediate manual job dispatch', async () => {
      await scheduler.triggerImmediateIngestion('2026-11-22');

      expect(queueMock.add).toHaveBeenCalledWith(
        INGESTION_JOBS.DAILY_MARKET_DATA,
        {
          trigger: 'manual_dispatch',
          targetDate: '2026-11-22',
        },
        expect.objectContaining({
          attempts: 5,
        }),
      );
    });

    it('should allow immediate climate sync job dispatch', async () => {
      await scheduler.triggerImmediateClimateSync();

      expect(queueMock.add).toHaveBeenCalledWith(
        INGESTION_JOBS.MONTHLY_CLIMATE,
        {
          trigger: 'manual_dispatch',
        },
        expect.objectContaining({
          attempts: 5,
        }),
      );
    });
  });
});
