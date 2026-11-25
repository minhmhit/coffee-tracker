import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { INGESTION_JOBS, INGESTION_QUEUE_NAME } from '../ingestion.constants';
import { ALERT_JOBS, ALERT_QUEUE_NAME, SIGNALS_JOBS, SIGNALS_QUEUE_NAME } from '../../signals/signals.constants';
import { IngestionService } from '../ingestion.service';

export interface IngestionJobPayload {
  trigger?: string;
  targetDate?: string;
}

@Processor(INGESTION_QUEUE_NAME)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly ingestionService: IngestionService,
    @InjectQueue(SIGNALS_QUEUE_NAME)
    private readonly signalsQueue: Queue,
    @InjectQueue(ALERT_QUEUE_NAME)
    private readonly alertQueue: Queue,
  ) {
    super();
  }

  /**
   * Worker handler triggered by BullMQ queue.
   * Dispatches either daily market price scraping or monthly climate synchronization.
   */
  async process(job: Job<IngestionJobPayload, any, string>): Promise<any> {
    this.logger.log(
      `Processing ingestion job ${job.id} [${job.name}], trigger: ${job.data?.trigger || 'manual'}, attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 5}`,
    );

    // 1. Monthly Climate Indicator Sync (NOAA ONI + Open-Meteo Rainfall Anomalies)
    if (job.name === INGESTION_JOBS.MONTHLY_CLIMATE) {
      this.logger.log('Executing monthly macro climate synchronization job...');
      const syncResult = await this.ingestionService.syncMacroClimateMonthly();
      return {
        success: true,
        type: 'monthly_climate',
        ...syncResult,
      };
    }

    // 1b. Standalone Daily Weather Sync (e.g. early 05:45 AM before 06:00 Telegram briefing)
    if (job.name === INGESTION_JOBS.DAILY_WEATHER) {
      this.logger.log('Executing daily Central Highlands weather synchronization job...');
      const weatherResult = await this.ingestionService.syncDailyWeather(job.data?.targetDate);
      return {
        type: 'daily_weather',
        ...weatherResult,
      };
    }

    // 1c. Standalone ICE Certified Robusta Stocks Sync
    if (job.name === INGESTION_JOBS.DAILY_ICE_STOCKS) {
      this.logger.log('Executing ICE Certified Robusta Stocks synchronization job...');
      const stockResult = await this.ingestionService.syncIceRobustaStocks(job.data?.targetDate);
      return {
        type: 'daily_ice_stocks',
        ...stockResult,
      };
    }

    // 2. Daily Market Price Ingestion (Domestic + London + FX + Oil)
    const { snapshot, sanityResult, errors } = await this.ingestionService.fetchDailySnapshot(
      job.data?.targetDate,
    );

    if (!sanityResult.valid || !snapshot) {
      const reasons = sanityResult.reasons.length > 0 ? sanityResult.reasons.join('; ') : 'Unknown sanity failure';
      const fetchErrors = errors.length > 0 ? ` (Fetch errors: ${errors.join(', ')})` : '';
      const failureMessage = `Ingestion sanity validation failed: ${reasons}${fetchErrors}`;
      this.logger.error(failureMessage);
      throw new Error(failureMessage);
    }

    const record = await this.ingestionService.upsertDailySnapshot(snapshot);

    // 3. Fault-isolated secondary sync: Daily Weather + ICE Certified Robusta Stocks
    // Never abort or fail daily market price ingestion if these secondary feeds fail.
    await Promise.allSettled([
      this.ingestionService.syncDailyWeather?.(snapshot.date).catch((wErr: any) => {
        this.logger.warn(`Isolated weather sync failure: ${wErr.message}`);
      }),
      this.ingestionService.syncIceRobustaStocks?.(snapshot.date).catch((sErr: any) => {
        this.logger.warn(`Isolated ICE stocks sync failure: ${sErr.message}`);
      }),
    ]);

    // 4. Automatically chain pipeline: trigger daily signals calculation
    try {
      this.logger.log(`Enqueuing signals computation job for date: ${snapshot.date}...`);
      await this.signalsQueue.add(
        SIGNALS_JOBS.COMPUTE_DAILY_SIGNALS,
        {
          targetDate: snapshot.date,
          trigger: 'auto_chained_from_ingestion',
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    } catch (queueErr: any) {
      this.logger.error(`Failed to enqueue signals job: ${queueErr.message}`, queueErr.stack);
    }

    return {
      success: true,
      type: 'daily_market_price',
      recordId: record.id,
      date: snapshot.date,
      daklak: record.price_daklak.toString(),
    };
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job<IngestionJobPayload>, error: Error) {
    this.logger.warn(
      `Job ${job.id} [${job.name}] failed attempt ${job.attemptsMade}/${job.opts.attempts || 5}: ${error.message}`,
    );

    if (job.attemptsMade >= (job.opts.attempts || 5)) {
      this.logger.error(
        `[CRITICAL ALERT] Ingestion job ${job.id} [${job.name}] permanently failed after ${job.attemptsMade} attempts! Reason: ${error.message}. Dispatching System Error Alert...`,
      );

      try {
        await this.alertQueue.add(
          ALERT_JOBS.SYSTEM_ERROR,
          {
            queueName: INGESTION_QUEUE_NAME,
            jobId: String(job.id),
            jobName: job.name,
            attempts: job.attemptsMade,
            maxAttempts: job.opts.attempts || 5,
            errorMessage: error.message,
          },
          {
            priority: 1,
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        );
      } catch (alertErr: any) {
        this.logger.error(`Failed to enqueue SYSTEM_ERROR alert: ${alertErr.message}`);
      }
    }
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job<IngestionJobPayload>, result: any) {
    this.logger.log(
      `Job ${job.id} [${job.name}] successfully finished. Type: ${result?.type}, Details: ${JSON.stringify(result)}`,
    );
  }
}
