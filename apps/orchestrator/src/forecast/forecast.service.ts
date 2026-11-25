import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  FORECAST_JOBS,
  FORECAST_QUEUE_NAME,
  FORECAST_WORKER_CONFIG,
} from './forecast.constants';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../signals/signals.constants';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface MLHorizonPrediction {
  horizon_week: number;
  target_date: string;
  pred_p10: number;
  pred_p50: number;
  pred_p90: number;
  baseline_naive?: number | null;
  baseline_futures?: number | null;
}

export interface MLForecastMetrics {
  wf_mape_4w?: number | null;
  wf_mape_12w?: number | null;
  wf_mape_26w?: number | null;
  pinball_loss?: number | null;
  beats_naive_baseline?: boolean;
}

export interface MLForecastResponse {
  run_id?: string | null;
  run_date: string;
  origin_price_daklak: number;
  predictions: MLHorizonPrediction[];
  metrics?: MLForecastMetrics | null;
}

@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FORECAST_QUEUE_NAME)
    private readonly forecastQueue: Queue,
    @InjectQueue(ALERT_QUEUE_NAME)
    private readonly alertQueue: Queue,
  ) {}

  /**
   * Enqueues an on-demand or cron-triggered weekly forecast computation.
   */
  async triggerForecast(trigger: string = 'manual') {
    this.logger.log(`Enqueuing weekly forecast job (trigger: ${trigger})...`);
    return this.forecastQueue.add(
      FORECAST_JOBS.GENERATE_WEEKLY_FORECAST,
      { trigger, requestedAt: new Date().toISOString() },
      {
        attempts: FORECAST_WORKER_CONFIG.attempts,
        backoff: FORECAST_WORKER_CONFIG.backoff,
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  /**
   * Gathers full historical market prices and monthly macro climate data from PostgreSQL
   * and structures the payload for the Python ML service contract.
   */
  async buildForecastPayload() {
    this.logger.log('Querying historical market prices and macro climate for ML payload...');

    const prices = await this.prisma.rawMarketPrice.findMany({
      orderBy: { price_date: 'asc' },
    });

    if (prices.length < 156) {
      throw new Error(
        `Insufficient historical market records in PostgreSQL: found ${prices.length}, require >= 156`,
      );
    }

    const climate = await this.prisma.macroClimateMonthly.findMany({
      orderBy: { month_date: 'asc' },
    });

    const latestPrice = prices[prices.length - 1];
    const runDate = latestPrice.price_date.toISOString().split('T')[0];

    const marketPricesPayload = prices.map((p) => ({
      date: p.price_date.toISOString().split('T')[0],
      price_daklak: p.price_daklak.toNumber(),
      price_lamdong: p.price_lamdong.toNumber(),
      price_gialai: p.price_gialai.toNumber(),
      price_daknong: p.price_daknong.toNumber(),
      price_avg: p.price_avg.toNumber(),
      london_m1: p.london_m1 ? p.london_m1.toNumber() : null,
      london_m3: p.london_m3 ? p.london_m3.toNumber() : null,
      london_m6: p.london_m6 ? p.london_m6.toNumber() : null,
      usd_vnd: p.usd_vnd ? p.usd_vnd.toNumber() : null,
      brent_oil: p.brent_oil ? p.brent_oil.toNumber() : null,
    }));

    const macroClimatePayload = climate.map((c) => ({
      month_date: c.month_date.toISOString().split('T')[0],
      oni: c.oni_index ? c.oni_index.toNumber() : null,
      rainfall_anomaly_daklak: c.vn_rain_anomaly ? c.vn_rain_anomaly.toNumber() : null,
      rainfall_anomaly_linhares: c.br_rain_anomaly ? c.br_rain_anomaly.toNumber() : null,
    }));

    return {
      run_date: runDate,
      market_prices: marketPricesPayload,
      macro_climate: macroClimatePayload,
    };
  }

  /**
   * Calls the stateless Python ML service (POST /api/v1/forecast/weekly)
   * with strict timeout guard.
   */
  async callMlService(payload: any): Promise<MLForecastResponse> {
    const mlUrl = `${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/api/v1/forecast/weekly`;
    this.logger.log(`Dispatching forecast payload to ML service at ${mlUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      FORECAST_WORKER_CONFIG.timeoutMs,
    );

    try {
      const response = await fetch(mlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CoffeeTracker-Orchestrator/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ML service HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as MLForecastResponse;

      if (!data.predictions || data.predictions.length !== 26) {
        throw new Error(
          `Invalid response shape from ML service: expected 26 predictions, received ${data.predictions?.length}`,
        );
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errMsg = err.name === 'AbortError' ? 'ML service timeout after 180s' : err.message;
      this.logger.error(`Failed to call ML service: ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  /**
   * Atomically stores successful forecast run and exactly 26 predictions inside a Prisma transaction.
   * NEVER overwrites old runs; always generates and appends a new run_id.
   */
  async persistSuccessfulForecast(
    forecastDate: Date,
    mlResult: MLForecastResponse,
  ) {
    const runId = mlResult.run_id || randomUUID();
    this.logger.log(`Persisting successful forecast run ${runId} for date ${forecastDate.toISOString().split('T')[0]}...`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create ForecastRun record
      const runRecord = await tx.forecastRun.create({
        data: {
          run_id: runId,
          forecast_date: forecastDate,
          status: 'SUCCESS',
          model_version: 'two_legged_walk_forward_v1',
          metrics: mlResult.metrics as any,
          blend_weights: {
            short: 0.6,
            mid: 0.5,
            long: 0.4,
          },
        },
      });

      // 2. Create 26 ForecastPrediction records
      const predictionData = mlResult.predictions.map((p) => ({
        run_id: runId,
        horizon_week: p.horizon_week,
        target_date: new Date(p.target_date),
        pred_p10: new Prisma.Decimal(p.pred_p10),
        pred_p50: new Prisma.Decimal(p.pred_p50),
        pred_p90: new Prisma.Decimal(p.pred_p90),
        baseline_rw: p.baseline_naive != null ? new Prisma.Decimal(p.baseline_naive) : null,
        baseline_futures: p.baseline_futures != null ? new Prisma.Decimal(p.baseline_futures) : null,
      }));

      await tx.forecastPrediction.createMany({
        data: predictionData,
      });

      return runRecord;
    });
  }

  /**
   * Persists a failed forecast run record and escalates critical alert to alert-queue.
   */
  async persistFailedForecast(
    forecastDate: Date,
    errorMessage: string,
  ) {
    const runId = randomUUID();
    this.logger.warn(`Logging failed forecast run ${runId}: ${errorMessage}`);

    const failedRun = await this.prisma.forecastRun.create({
      data: {
        run_id: runId,
        forecast_date: forecastDate,
        status: 'FAILED',
        error_message: errorMessage,
      },
    });

    try {
      await this.alertQueue.add(
        ALERT_JOBS.SYSTEM_ERROR,
        {
          queueName: FORECAST_QUEUE_NAME,
          jobId: runId,
          jobName: FORECAST_JOBS.GENERATE_WEEKLY_FORECAST,
          attempts: 2,
          maxAttempts: 2,
          errorMessage,
        },
        { priority: 1 },
      );
    } catch (alertErr: any) {
      this.logger.error(`Failed to dispatch alert for failed forecast run: ${alertErr.message}`);
    }

    return failedRun;
  }

  /**
   * Returns the most recent successful forecast run with its full 26 predictions
   * and origin benchmark price.
   */
  async getLatestForecast() {
    const run = await this.prisma.forecastRun.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { forecast_date: 'desc' },
      include: {
        predictions: {
          orderBy: { horizon_week: 'asc' },
        },
      },
    });

    if (!run) return null;

    const originPriceRecord = await this.prisma.rawMarketPrice.findFirst({
      where: { price_date: run.forecast_date },
    });

    return {
      run_id: run.run_id,
      forecast_date: run.forecast_date.toISOString().split('T')[0],
      origin_price_daklak: originPriceRecord ? originPriceRecord.price_daklak.toNumber() : null,
      status: run.status,
      model_version: run.model_version,
      created_at: run.created_at.toISOString(),
      metrics: run.metrics,
      blend_weights: run.blend_weights,
      predictions: run.predictions.map((p) => ({
        horizon_week: p.horizon_week,
        target_date: p.target_date instanceof Date ? p.target_date.toISOString().split('T')[0] : String(p.target_date).split('T')[0],
        pred_p10: p.pred_p10.toNumber(),
        pred_p50: p.pred_p50.toNumber(),
        pred_p90: p.pred_p90.toNumber(),
        baseline_rw: p.baseline_rw ? p.baseline_rw.toNumber() : null,
        baseline_futures: p.baseline_futures ? p.baseline_futures.toNumber() : null,
      })),
    };
  }

  /**
   * Returns paginated list of forecast runs for audit trail.
   */
  async getForecastRuns(limit: number = 20, offset: number = 0) {
    const [runs, total] = await Promise.all([
      this.prisma.forecastRun.findMany({
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { predictions: true },
          },
        },
      }),
      this.prisma.forecastRun.count(),
    ]);

    return {
      runs: runs.map((r) => ({
        run_id: r.run_id,
        forecast_date: r.forecast_date.toISOString().split('T')[0],
        status: r.status,
        model_version: r.model_version,
        error_message: r.error_message,
        metrics: r.metrics,
        predictions_count: (r as any)._count?.predictions || 0,
        created_at: r.created_at.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Returns a specific forecast run by UUID with all 26 predictions.
   */
  async getForecastRunById(runId: string) {
    const run = await this.prisma.forecastRun.findUnique({
      where: { run_id: runId },
      include: {
        predictions: {
          orderBy: { horizon_week: 'asc' },
        },
      },
    });

    if (!run) return null;

    const originPriceRecord = await this.prisma.rawMarketPrice.findFirst({
      where: { price_date: run.forecast_date },
    });

    return {
      run_id: run.run_id,
      forecast_date: run.forecast_date.toISOString().split('T')[0],
      origin_price_daklak: originPriceRecord ? originPriceRecord.price_daklak.toNumber() : null,
      status: run.status,
      model_version: run.model_version,
      error_message: run.error_message,
      created_at: run.created_at.toISOString(),
      metrics: run.metrics,
      blend_weights: run.blend_weights,
      predictions: run.predictions.map((p) => ({
        horizon_week: p.horizon_week,
        target_date: p.target_date instanceof Date ? p.target_date.toISOString().split('T')[0] : String(p.target_date).split('T')[0],
        pred_p10: p.pred_p10.toNumber(),
        pred_p50: p.pred_p50.toNumber(),
        pred_p90: p.pred_p90.toNumber(),
        baseline_rw: p.baseline_rw ? p.baseline_rw.toNumber() : null,
        baseline_futures: p.baseline_futures ? p.baseline_futures.toNumber() : null,
      })),
    };
  }
}
