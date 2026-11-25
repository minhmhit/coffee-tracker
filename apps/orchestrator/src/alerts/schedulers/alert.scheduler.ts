import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../../signals/signals.constants';

export const ALERT_CRONS = {
  MORNING_BRIEFING: process.env.TELEGRAM_BRIEFING_CRON || '0 6 * * *', // 06:00 AM Asia/Ho_Chi_Minh daily (mỗi 6h sáng)
  MORNING_BRIEFING_0600: '0 6 * * *', // 06:00 AM Asia/Ho_Chi_Minh daily
  TIMEZONE: 'Asia/Ho_Chi_Minh',
};

@Injectable()
export class AlertScheduler implements OnModuleInit {
  private readonly logger = new Logger(AlertScheduler.name);

  constructor(
    @InjectQueue(ALERT_QUEUE_NAME)
    private readonly alertQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.registerRepeatableJobs();
  }

  /**
   * Registers BullMQ repeatable cron job for daily 06:00 AM Morning Briefing.
   */
  async registerRepeatableJobs() {
    try {
      this.logger.log('Registering BullMQ scheduled repeatable alert jobs...');

      // 1. Daily 06:00 AM Morning Market Briefing (Mỗi 6h sáng)
      await this.alertQueue.upsertJobScheduler(
        'morning_briefing_0600',
        {
          pattern: ALERT_CRONS.MORNING_BRIEFING_0600,
          tz: ALERT_CRONS.TIMEZONE,
        },
        {
          name: ALERT_JOBS.MORNING_BRIEFING,
          data: { trigger: 'cron_morning_briefing_0600', slot: '0600' },
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      );

      this.logger.log(
        `Scheduled [${ALERT_JOBS.MORNING_BRIEFING}] at ${ALERT_CRONS.MORNING_BRIEFING_0600} (${ALERT_CRONS.TIMEZONE}) [Slot: 06:00 AM]`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to register alert repeatable jobs: ${error.message}`, error.stack);
    }
  }

  /**
   * Helper to manually dispatch an immediate morning briefing.
   */
  async triggerImmediateBriefing(force = false) {
    this.logger.log('Triggering immediate morning briefing dispatch...');
    return this.alertQueue.add(
      ALERT_JOBS.MORNING_BRIEFING,
      {
        trigger: 'manual_dispatch',
        force,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }
}
