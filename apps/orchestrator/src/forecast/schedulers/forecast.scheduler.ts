import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  FORECAST_CRONS,
  FORECAST_JOBS,
  FORECAST_QUEUE_NAME,
  FORECAST_WORKER_CONFIG,
} from '../forecast.constants';
import { isDirectQueueMode } from '../../common/queue-mode';

@Injectable()
export class ForecastScheduler implements OnModuleInit {
  private readonly logger = new Logger(ForecastScheduler.name);

  constructor(
    @InjectQueue(FORECAST_QUEUE_NAME)
    private readonly forecastQueue: Queue,
  ) {}

  async onModuleInit() {
    if (isDirectQueueMode()) {
      this.logger.log(
        'QUEUE_MODE=direct detected — skipping BullMQ repeatable weekly forecast cron registration.',
      );
      return;
    }
    await this.registerRepeatableJobs();
  }

  /**
   * Registers weekly Monday 02:00 AM repeatable forecast cron in BullMQ.
   */
  async registerRepeatableJobs() {
    try {
      this.logger.log('Registering BullMQ scheduled repeatable forecast job...');

      await this.forecastQueue.upsertJobScheduler(
        'weekly_forecast_monday_0200',
        {
          pattern: FORECAST_CRONS.WEEKLY_MONDAY,
          tz: FORECAST_CRONS.TIMEZONE,
        },
        {
          name: FORECAST_JOBS.GENERATE_WEEKLY_FORECAST,
          data: { trigger: 'cron_weekly_forecast_monday_0200' },
          opts: {
            attempts: FORECAST_WORKER_CONFIG.attempts,
            backoff: FORECAST_WORKER_CONFIG.backoff,
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      );

      this.logger.log(
        `Scheduled [${FORECAST_JOBS.GENERATE_WEEKLY_FORECAST}] at ${FORECAST_CRONS.WEEKLY_MONDAY} (${FORECAST_CRONS.TIMEZONE})`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to register forecast repeatable job: ${error.message}`, error.stack);
    }
  }
}
