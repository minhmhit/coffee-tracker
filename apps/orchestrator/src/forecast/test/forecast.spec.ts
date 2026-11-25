import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { ForecastService } from '../forecast.service';
import { ForecastProcessor } from '../processors/forecast.processor';
import { ForecastScheduler } from '../schedulers/forecast.scheduler';
import { ForecastController, AdminForecastController } from '../forecast.controller';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FORECAST_CRONS,
  FORECAST_JOBS,
  FORECAST_QUEUE_NAME,
} from '../forecast.constants';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../../signals/signals.constants';

describe('Forecast Module Suite (Step 4.1 & 4.2)', () => {
  let forecastService: ForecastService;
  let forecastProcessor: ForecastProcessor;
  let forecastScheduler: ForecastScheduler;
  let forecastController: ForecastController;
  let adminForecastController: AdminForecastController;

  let prismaService: any;
  let forecastQueue: any;
  let alertQueue: any;

  const mockPredictions = Array.from({ length: 26 }, (_, i) => ({
    horizon_week: i + 1,
    target_date: `2026-12-${String((i + 1) * 7).padStart(2, '0')}`,
    pred_p10: 70000 + i * 100,
    pred_p50: 75000 + i * 150,
    pred_p90: 80000 + i * 200,
    baseline_naive: 74000,
    baseline_futures: 74500 + i * 50,
  }));

  const baseDate = new Date('2026-11-29T00:00:00.000Z');
  const mockDbPredictions = Array.from({ length: 26 }, (_, i) => {
    const tDate = new Date(baseDate);
    tDate.setDate(tDate.getDate() + i * 7);
    return {
      horizon_week: i + 1,
      target_date: tDate,
      pred_p10: new Prisma.Decimal(70000 + i * 100),
      pred_p50: new Prisma.Decimal(75000 + i * 150),
      pred_p90: new Prisma.Decimal(80000 + i * 200),
      baseline_rw: new Prisma.Decimal(74000),
      baseline_futures: new Prisma.Decimal(74500 + i * 50),
    };
  });

  const mockMlResponse = {
    run_id: 'test-run-uuid-1234',
    run_date: '2026-11-22',
    origin_price_daklak: 74500,
    predictions: mockPredictions,
    metrics: {
      wf_mape_4w: 0.035,
      wf_mape_12w: 0.052,
      wf_mape_26w: 0.078,
      pinball_loss: 0.0215,
      beats_naive_baseline: true,
    },
  };

  beforeEach(async () => {
    prismaService = {
      rawMarketPrice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      macroClimateMonthly: {
        findMany: jest.fn(),
      },
      forecastRun: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      forecastPrediction: {
        createMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    forecastQueue = {
      add: jest.fn().mockResolvedValue({ id: 'forecast-job-1' }),
      upsertJobScheduler: jest.fn().mockResolvedValue({}),
    };

    alertQueue = {
      add: jest.fn().mockResolvedValue({ id: 'alert-job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForecastController, AdminForecastController],
      providers: [
        ForecastService,
        ForecastProcessor,
        ForecastScheduler,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: getQueueToken(FORECAST_QUEUE_NAME),
          useValue: forecastQueue,
        },
        {
          provide: getQueueToken(ALERT_QUEUE_NAME),
          useValue: alertQueue,
        },
      ],
    }).compile();

    forecastService = module.get<ForecastService>(ForecastService);
    forecastProcessor = module.get<ForecastProcessor>(ForecastProcessor);
    forecastScheduler = module.get<ForecastScheduler>(ForecastScheduler);
    forecastController = module.get<ForecastController>(ForecastController);
    adminForecastController = module.get<AdminForecastController>(AdminForecastController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. ForecastService - Payload Extraction & Validation', () => {
    it('should throw an error if fewer than 156 daily market records exist in PostgreSQL', async () => {
      prismaService.rawMarketPrice.findMany.mockResolvedValue(new Array(100).fill({}));

      await expect(forecastService.buildForecastPayload()).rejects.toThrow(
        /Insufficient historical market records in PostgreSQL: found 100, require >= 156/,
      );
    });

    it('should correctly format payload with numeric conversions and dates when >= 156 records exist', async () => {
      const mockPrices = Array.from({ length: 160 }, (_, i) => ({
        price_date: new Date(`2026-01-01T00:00:00.000Z`),
        price_daklak: new Prisma.Decimal(70000 + i),
        price_lamdong: new Prisma.Decimal(69000 + i),
        price_gialai: new Prisma.Decimal(69500 + i),
        price_daknong: new Prisma.Decimal(70100 + i),
        price_avg: new Prisma.Decimal(69650 + i),
        london_m1: new Prisma.Decimal(4500),
        london_m3: new Prisma.Decimal(4300),
        london_m6: new Prisma.Decimal(4100),
        usd_vnd: new Prisma.Decimal(25500),
        brent_oil: new Prisma.Decimal(82.5),
      }));

      const mockClimate = [
        {
          month_date: new Date('2026-01-01T00:00:00.000Z'),
          oni_index: new Prisma.Decimal(-0.4),
          vn_rain_anomaly: new Prisma.Decimal(12.5),
          br_rain_anomaly: new Prisma.Decimal(-5.2),
        },
      ];

      prismaService.rawMarketPrice.findMany.mockResolvedValue(mockPrices);
      prismaService.macroClimateMonthly.findMany.mockResolvedValue(mockClimate);

      const payload = await forecastService.buildForecastPayload();

      expect(payload.run_date).toBe('2026-01-01');
      expect(payload.market_prices.length).toBe(160);
      expect(payload.market_prices[0].price_daklak).toBe(70000);
      expect(payload.macro_climate.length).toBe(1);
      expect(payload.macro_climate[0].oni).toBe(-0.4);
    });
  });

  describe('2. ForecastService - ML Service Communication', () => {
    it('should successfully parse valid 26-week response from ML service', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockMlResponse),
      } as any);

      const res = await forecastService.callMlService({ test: 'payload' });
      expect(res.run_id).toBe('test-run-uuid-1234');
      expect(res.predictions.length).toBe(26);
      expect(res.origin_price_daklak).toBe(74500);
    });

    it('should throw an error when ML service returns non-200 status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: jest.fn().mockResolvedValue('Insufficient historical weeks'),
      } as any);

      await expect(forecastService.callMlService({ test: 'payload' })).rejects.toThrow(
        /ML service HTTP 422/,
      );
    });

    it('should throw an error if ML service returns fewer than 26 predictions', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          run_id: 'bad-run',
          run_date: '2026-11-22',
          origin_price_daklak: 74500,
          predictions: [{ horizon_week: 1 }], // Only 1 prediction!
        }),
      } as any);

      await expect(forecastService.callMlService({ test: 'payload' })).rejects.toThrow(
        /Invalid response shape from ML service: expected 26 predictions, received 1/,
      );
    });

    it('should handle timeout error gracefully', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expect(forecastService.callMlService({ test: 'payload' })).rejects.toThrow(
        /ML service timeout after 180s/,
      );
    });
  });

  describe('3. ForecastService - Transactional Persistence', () => {
    it('should persist successful forecast run and 26 predictions in a single transaction', async () => {
      const mockRunRecord = {
        run_id: 'test-run-uuid-1234',
        forecast_date: new Date('2026-11-22'),
        status: 'SUCCESS',
      };

      prismaService.forecastRun.create.mockResolvedValue(mockRunRecord);
      prismaService.forecastPrediction.createMany.mockResolvedValue({ count: 26 });

      const result = await forecastService.persistSuccessfulForecast(
        new Date('2026-11-22'),
        mockMlResponse,
      );

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.forecastRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          run_id: 'test-run-uuid-1234',
          status: 'SUCCESS',
          model_version: 'two_legged_walk_forward_v1',
        }),
      });

      expect(prismaService.forecastPrediction.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            run_id: 'test-run-uuid-1234',
            horizon_week: 1,
            pred_p50: expect.any(Prisma.Decimal),
          }),
        ]),
      });

      expect(result.run_id).toBe('test-run-uuid-1234');
    });

    it('should persist failed forecast run and push SYSTEM_ERROR to alert-queue', async () => {
      prismaService.forecastRun.create.mockResolvedValue({
        run_id: 'failed-run-123',
        status: 'FAILED',
      });

      const failedRun = await forecastService.persistFailedForecast(
        new Date('2026-11-22'),
        'VECM rank 0 divergence',
      );

      expect(prismaService.forecastRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          error_message: 'VECM rank 0 divergence',
        }),
      });

      expect(alertQueue.add).toHaveBeenCalledWith(
        ALERT_JOBS.SYSTEM_ERROR,
        expect.objectContaining({
          queueName: FORECAST_QUEUE_NAME,
          errorMessage: 'VECM rank 0 divergence',
        }),
        expect.any(Object),
      );

      expect(failedRun.status).toBe('FAILED');
    });
  });

  describe('4. ForecastProcessor - BullMQ Worker Execution', () => {
    it('should coordinate payload build, ML call, and persistence on job execution', async () => {
      jest.spyOn(forecastService, 'buildForecastPayload').mockResolvedValue({
        run_date: '2026-11-22',
        market_prices: [],
        macro_climate: [],
      });

      jest.spyOn(forecastService, 'callMlService').mockResolvedValue(mockMlResponse);
      jest.spyOn(forecastService, 'persistSuccessfulForecast').mockResolvedValue({
        run_id: 'test-run-uuid-1234',
        forecast_date: new Date('2026-11-22'),
        status: 'SUCCESS',
      } as any);

      const mockJob = {
        id: 'job-forecast-1',
        name: FORECAST_JOBS.GENERATE_WEEKLY_FORECAST,
        data: { trigger: 'manual' },
        attemptsMade: 0,
        opts: { attempts: 2 },
      } as Job;

      const result = await forecastProcessor.process(mockJob);

      expect(result.success).toBe(true);
      expect(result.runId).toBe('test-run-uuid-1234');
      expect(result.predictionsCount).toBe(26);
    });

    it('should escalate to persistFailedForecast on final attempt failure', async () => {
      jest.spyOn(forecastService, 'buildForecastPayload').mockRejectedValue(new Error('Connection failure'));
      const persistFailedSpy = jest.spyOn(forecastService, 'persistFailedForecast').mockResolvedValue({} as any);

      const mockJob = {
        id: 'job-forecast-failed',
        name: FORECAST_JOBS.GENERATE_WEEKLY_FORECAST,
        data: { trigger: 'cron' },
        attemptsMade: 1, // Final attempt (attempt 2 of 2)
        opts: { attempts: 2 },
      } as Job;

      await expect(forecastProcessor.process(mockJob)).rejects.toThrow('Connection failure');
      expect(persistFailedSpy).toHaveBeenCalledWith(expect.any(Date), 'Connection failure');
    });
  });

  describe('5. ForecastScheduler & Controller Suite (Step 4.2)', () => {
    it('should register weekly Monday 02:00 AM repeatable job in BullMQ', async () => {
      await forecastScheduler.onModuleInit();

      expect(forecastQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'weekly_forecast_monday_0200',
        {
          pattern: FORECAST_CRONS.WEEKLY_MONDAY,
          tz: FORECAST_CRONS.TIMEZONE,
        },
        expect.objectContaining({
          name: FORECAST_JOBS.GENERATE_WEEKLY_FORECAST,
        }),
      );
    });

    it('ForecastController.triggerForecast should enqueue job and return accepted status', async () => {
      const res = await forecastController.triggerForecast();
      expect(res.success).toBe(true);
      expect(res.jobId).toBe('forecast-job-1');
      expect(forecastQueue.add).toHaveBeenCalled();
    });

    it('ForecastController.getLatestForecast should return formatted forecast payload with numeric predictions', async () => {
      prismaService.forecastRun.findFirst.mockResolvedValue({
        run_id: 'run-999',
        forecast_date: new Date('2026-11-22T00:00:00.000Z'),
        status: 'SUCCESS',
        model_version: 'two_legged_walk_forward_v1',
        created_at: new Date('2026-11-25T00:00:00.000Z'),
        metrics: { pinball_loss: 0.0083 },
        blend_weights: { short: 0.6 },
        predictions: mockDbPredictions,
      });

      prismaService.rawMarketPrice.findFirst.mockResolvedValue({
        price_daklak: new Prisma.Decimal(71800),
      });

      const res = await forecastController.getLatestForecast();
      expect(res.run_id).toBe('run-999');
      expect(res.origin_price_daklak).toBe(71800);
      expect(res.predictions.length).toBe(26);
      expect(res.predictions[0].pred_p50).toBe(75000);
      expect(typeof res.predictions[0].pred_p50).toBe('number');
    });

    it('ForecastController.getLatestForecast should throw NotFoundException when empty', async () => {
      prismaService.forecastRun.findFirst.mockResolvedValue(null);

      await expect(forecastController.getLatestForecast()).rejects.toThrow(NotFoundException);
    });

    it('ForecastController.getForecastRuns should return paginated runs list', async () => {
      prismaService.forecastRun.findMany.mockResolvedValue([
        {
          run_id: 'run-999',
          forecast_date: new Date('2026-11-22T00:00:00.000Z'),
          status: 'SUCCESS',
          model_version: 'v1',
          error_message: null,
          metrics: {},
          created_at: new Date('2026-11-25T00:00:00.000Z'),
          _count: { predictions: 26 },
        },
      ]);
      prismaService.forecastRun.count.mockResolvedValue(1);

      const res = await forecastController.getForecastRuns('10', '0');
      expect(res.total).toBe(1);
      expect(res.runs.length).toBe(1);
      expect(res.runs[0].predictions_count).toBe(26);
    });

    it('ForecastController.getForecastRunById should return run details by ID', async () => {
      prismaService.forecastRun.findUnique.mockResolvedValue({
        run_id: 'run-999',
        forecast_date: new Date('2026-11-22T00:00:00.000Z'),
        status: 'SUCCESS',
        model_version: 'v1',
        error_message: null,
        created_at: new Date('2026-11-25T00:00:00.000Z'),
        metrics: {},
        blend_weights: {},
        predictions: mockDbPredictions,
      });

      prismaService.rawMarketPrice.findFirst.mockResolvedValue({
        price_daklak: new Prisma.Decimal(71800),
      });

      const res = await forecastController.getForecastRunById('run-999');
      expect(res.run_id).toBe('run-999');
      expect(res.predictions.length).toBe(26);
    });

    it('ForecastController.getForecastRunById should throw NotFoundException if run not found', async () => {
      prismaService.forecastRun.findUnique.mockResolvedValue(null);

      await expect(forecastController.getForecastRunById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('AdminForecastController should support admin routes', async () => {
      prismaService.forecastRun.findFirst.mockResolvedValue(null);
      const latestRes = await adminForecastController.getLatestForecast();
      expect(latestRes.found).toBe(false);

      const triggerRes = await adminForecastController.triggerForecast();
      expect(triggerRes.success).toBe(true);
    });
  });
});
