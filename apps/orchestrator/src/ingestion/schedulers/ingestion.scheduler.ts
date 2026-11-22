import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  INGESTION_CRONS,
  INGESTION_JOBS,
  INGESTION_JOB_OPTIONS,
  INGESTION_QUEUE_NAME,
} from '../ingestion.constants';
import { IngestionJobPayload } from '../processors/ingestion.processor';

@Injectable()
export class IngestionScheduler implements OnModuleInit {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(
    @InjectQueue(INGESTION_QUEUE_NAME)
    private readonly ingestionQueue: Queue<IngestionJobPayload>,
  ) {}

  async onModuleInit() {
    await this.registerRepeatableJobs();
  }

  /**
   * Registers BullMQ repeatable cron jobs for domestic morning and ICE night sessions
   * using BullMQ v5 Job Schedulers API.
   */
  async registerRepeatableJobs() {
    try {
      this.logger.log('Registering BullMQ scheduled repeatable ingestion jobs...');

      // 1. Central Highlands Morning Domestic Ingestion (08:30 Asia/Ho_Chi_Minh)
      await this.ingestionQueue.upsertJobScheduler(
        'morning_domestic_0830',
        {
          pattern: INGESTION_CRONS.MORNING_DOMESTIC,
          tz: INGESTION_CRONS.TIMEZONE,
        },
        {
          name: INGESTION_JOBS.DAILY_MARKET_DATA,
          data: { trigger: 'cron_morning_domestic_0830' },
          opts: {
            attempts: INGESTION_JOB_OPTIONS.attempts,
            backoff: INGESTION_JOB_OPTIONS.backoff,
            removeOnComplete: INGESTION_JOB_OPTIONS.removeOnComplete,
            removeOnFail: INGESTION_JOB_OPTIONS.removeOnFail,
          },
        },
      );
      this.logger.log(
        `Scheduled [${INGESTION_JOBS.DAILY_MARKET_DATA}] at ${INGESTION_CRONS.MORNING_DOMESTIC} (${INGESTION_CRONS.TIMEZONE})`,
      );

      // 2. ICE London Robusta Night Close Ingestion (01:00 Asia/Ho_Chi_Minh)
      await this.ingestionQueue.upsertJobScheduler(
        'night_london_close_0100',
        {
          pattern: INGESTION_CRONS.NIGHT_LONDON_CLOSE,
          tz: INGESTION_CRONS.TIMEZONE,
        },
        {
          name: INGESTION_JOBS.DAILY_MARKET_DATA,
          data: { trigger: 'cron_night_london_close_0100' },
          opts: {
            attempts: INGESTION_JOB_OPTIONS.attempts,
            backoff: INGESTION_JOB_OPTIONS.backoff,
            removeOnComplete: INGESTION_JOB_OPTIONS.removeOnComplete,
            removeOnFail: INGESTION_JOB_OPTIONS.removeOnFail,
          },
        },
      );
      this.logger.log(
        `Scheduled [${INGESTION_JOBS.DAILY_MARKET_DATA}] at ${INGESTION_CRONS.NIGHT_LONDON_CLOSE} (${INGESTION_CRONS.TIMEZONE})`,
      );

      const count = await this.ingestionQueue.getJobSchedulersCount();
      this.logger.log(`Active job schedulers in '${INGESTION_QUEUE_NAME}': ${count}`);
    } catch (error: any) {
      this.logger.error(`Failed to register repeatable jobs: ${error.message}`, error.stack);
    }
  }

  /**
   * Helper to manually dispatch an immediate ingestion job (e.g. for testing, backfill, or user request).
   */
  async triggerImmediateIngestion(targetDate?: string) {
    this.logger.log(`Triggering immediate ingestion job (targetDate: ${targetDate || 'today'})...`);
    return this.ingestionQueue.add(
      INGESTION_JOBS.DAILY_MARKET_DATA,
      {
        trigger: 'manual_dispatch',
        targetDate,
      },
      {
        attempts: INGESTION_JOB_OPTIONS.attempts,
        backoff: INGESTION_JOB_OPTIONS.backoff,
      },
    );
  }
}
