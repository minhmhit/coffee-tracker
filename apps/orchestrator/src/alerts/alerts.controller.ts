import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AlertScheduler, ALERT_CRONS } from './schedulers/alert.scheduler';

@Controller('api/alerts')
export class AlertsController {
  constructor(private readonly alertScheduler: AlertScheduler) {}

  /**
   * Triggers an immediate morning market briefing dispatch to Telegram bot.
   */
  @Post('briefing/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerBriefing(@Body() body?: { force?: boolean }) {
    const job = await this.alertScheduler.triggerImmediateBriefing(body?.force ?? true);
    return {
      success: true,
      message: 'Morning briefing alert successfully enqueued for dispatch to Telegram bot',
      jobId: job.id,
      schedule: ALERT_CRONS.MORNING_BRIEFING_0600,
      timezone: ALERT_CRONS.TIMEZONE,
    };
  }

  /**
   * Returns Telegram bot configuration status and cron schedules.
   */
  @Get('status')
  getStatus() {
    return {
      service: 'telegram-alerting',
      telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      cronSchedule: ALERT_CRONS.MORNING_BRIEFING_0600,
      cronDescription: 'Hàng ngày lúc 06:00 sáng (Asia/Ho_Chi_Minh)',
      timezone: ALERT_CRONS.TIMEZONE,
    };
  }
}
