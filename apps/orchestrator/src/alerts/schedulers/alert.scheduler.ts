import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../../signals/signals.constants';

export const ALERT_CRONS = {
  MORNING_BRIEFING: '45 8 * * *', // 08:45 AM Asia/Ho_Chi_Minh daily
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
   * Registers BullMQ repeatable cron job for daily 08:45 AM Morning Briefing.
   */
  async registerRepeatableJobs() {
    try {
      this.logger.log('Registering BullMQ scheduled repeatable alert jobs...');

      await this.alertQueue.upsertJobScheduler(
        'morning_briefing_0845',
        {
          pattern: ALERT_CRONS.MORNING_BRIEFING,
          tz: ALERT_CRONS.TIMEZONE,
        },
        {
          name: ALERT_JOBS.MORNING_BRIEFING,
          data: { trigger: 'cron_morning_briefing_0845' },
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      );

      this.logger.log(
        `Scheduled [${ALERT_JOBS.MORNING_BRIEFING}] at ${ALERT_CRONS.MORNING_BRIEFING} (${ALERT_CRONS.TIMEZONE})`,
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
