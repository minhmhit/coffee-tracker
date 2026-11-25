import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { INGESTION_JOBS, INGESTION_QUEUE_NAME } from '../ingestion.constants';
import { SIGNALS_JOBS, SIGNALS_QUEUE_NAME } from '../../signals/signals.constants';
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

    // 3. Automatically chain pipeline: trigger daily signals calculation
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
  onJobFailed(job: Job<IngestionJobPayload>, error: Error) {
    this.logger.warn(
      `Job ${job.id} [${job.name}] failed attempt ${job.attemptsMade}/${job.opts.attempts || 5}: ${error.message}`,
    );

    if (job.attemptsMade >= (job.opts.attempts || 5)) {
      this.logger.error(
        `[CRITICAL ALERT] Ingestion job ${job.id} [${job.name}] permanently failed after ${job.attemptsMade} attempts! Reason: ${error.message}. Ready for Telegram alert dispatch.`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job<IngestionJobPayload>, result: any) {
    this.logger.log(
      `Job ${job.id} [${job.name}] successfully finished. Type: ${result?.type}, Details: ${JSON.stringify(result)}`,
    );
  }
}
