import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, Optional } from '@nestjs/common';
import { INGESTION_JOBS, INGESTION_QUEUE_NAME } from '../ingestion.constants';
import { ALERT_JOBS, ALERT_QUEUE_NAME, SIGNALS_JOBS, SIGNALS_QUEUE_NAME } from '../../signals/signals.constants';
import { IngestionService } from '../ingestion.service';
import { getBullWorkerOptions, isDirectQueueMode } from '../../common/queue-mode';
import { SignalsService } from '../../signals/signals.service';
import { AlertProcessor } from '../../alerts/processors/alert.processor';

export interface IngestionJobPayload {
  trigger?: string;
  targetDate?: string;
}

@Processor(INGESTION_QUEUE_NAME, getBullWorkerOptions())
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly ingestionService: IngestionService,
    @InjectQueue(SIGNALS_QUEUE_NAME)
    private readonly signalsQueue: Queue,
    @InjectQueue(ALERT_QUEUE_NAME)
    private readonly alertQueue: Queue,
    @Optional() private readonly signalsService?: SignalsService,
    @Optional() private readonly alertProcessor?: AlertProcessor,
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

    return this.executeSync(
      job.name,
      job.data?.trigger || 'manual',
      job.data?.targetDate,
    );
  }

  /**
   * Executes an ingestion job synchronously (invoked both by BullMQ Worker and QUEUE_MODE=direct HTTP sync).
   */
  async executeSync(
    jobType: string,
    trigger: string = 'manual',
    targetDate?: string,
  ): Promise<any> {
    const normalized = jobType.trim();
    const lower = normalized.toLowerCase();

    // 1. Monthly Climate Indicator Sync (NOAA ONI + Open-Meteo Rainfall Anomalies)
    if (
      normalized === INGESTION_JOBS.MONTHLY_CLIMATE ||
      lower === 'monthly_climate'
    ) {
      this.logger.log('Executing monthly macro climate synchronization job...');
      const syncResult = await this.ingestionService.syncMacroClimateMonthly();
      return {
        success: true,
        type: 'monthly_climate',
        ...syncResult,
      };
    }

    // 1b. Standalone Daily Weather Sync (e.g. early 05:45 AM before 06:00 Telegram briefing)
    if (
      normalized === INGESTION_JOBS.DAILY_WEATHER ||
      lower === 'weather' ||
      lower === 'early_weather' ||
      lower === 'daily_weather'
    ) {
      this.logger.log('Executing daily Central Highlands weather synchronization job...');
      const weatherResult = await this.ingestionService.syncDailyWeather(targetDate);
      return {
        type: 'daily_weather',
        ...weatherResult,
      };
    }

    // 1c. Standalone ICE Certified Robusta Stocks Sync
    if (
      normalized === INGESTION_JOBS.DAILY_ICE_STOCKS ||
      lower === 'daily_ice_stocks' ||
      lower === 'ice_stocks'
    ) {
      this.logger.log('Executing ICE Certified Robusta Stocks synchronization job...');
      const stockResult = await this.ingestionService.syncIceRobustaStocks(targetDate);
      return {
        type: 'daily_ice_stocks',
        ...stockResult,
      };
    }

    // 2. Daily Market Price Ingestion (Domestic + London + FX + Oil)
    const { snapshot, sanityResult, errors } = await this.ingestionService.fetchDailySnapshot(
      targetDate,
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

    // 4. Chain daily signals computation (inline when QUEUE_MODE=direct, BullMQ otherwise)
    let signalSummary: { computed: boolean; isAnomaly?: boolean; regime?: string } = {
      computed: false,
    };

    if (isDirectQueueMode() && this.signalsService) {
      try {
        this.logger.log(`QUEUE_MODE=direct: computing daily signals inline for ${snapshot.date}...`);
        const signalRecord = await this.signalsService.computeSignalsForDate(snapshot.date);
        signalSummary = {
          computed: true,
          isAnomaly: signalRecord.is_anomaly,
          regime: signalRecord.regime,
        };

        if (signalRecord.is_anomaly && this.alertProcessor) {
          this.logger.warn(
            `[ANOMALY DETECTED] Direct mode alert dispatch for ${snapshot.date} (Z-Score: ${signalRecord.z_score})`,
          );
          await this.alertProcessor.executeAnomalyAlert({
            signalDate: snapshot.date,
            zScore: signalRecord.z_score ? signalRecord.z_score.toString() : '0',
            basis: signalRecord.basis.toString(),
            spread: signalRecord.spread ? signalRecord.spread.toString() : null,
            regime: signalRecord.regime,
            notes: signalRecord.notes,
          });
        }
      } catch (directErr: any) {
        this.logger.error(`Direct inline signal/alert execution failed: ${directErr.message}`, directErr.stack);
      }
    } else {
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
    }

    return {
      success: true,
      type: 'daily_market_price',
      recordId: record.id,
      date: snapshot.date,
      daklak: record.price_daklak.toString(),
      signalSummary,
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

      if (!isDirectQueueMode()) {
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
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job<IngestionJobPayload>, result: any) {
    this.logger.log(
      `Job ${job.id} [${job.name}] successfully finished. Type: ${result?.type}, Details: ${JSON.stringify(result)}`,
    );
  }
}
