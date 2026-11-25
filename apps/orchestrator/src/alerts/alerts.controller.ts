import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AlertScheduler, ALERT_CRONS } from './schedulers/alert.scheduler';
import { TelegramService } from './telegram.service';
import { MorningBriefingService } from './morning-briefing.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/alerts')
export class AlertsController {
  constructor(
    private readonly alertScheduler: AlertScheduler,
    private readonly telegramService: TelegramService,
    private readonly briefingService: MorningBriefingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Triggers an immediate morning market briefing dispatch to Telegram bot subscribers.
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

  /**
   * Returns self-service Telegram Bot onboarding metadata, deep link, active subscriber count,
   * and live sample briefing preview for the frontend dashboard.
   */
  @Get('telegram-info')
  async getTelegramOnboardingInfo() {
    const [profile, activeSubscribersCount, briefing] = await Promise.all([
      this.telegramService.getBotProfile(),
      this.prisma.telegramSubscriber
        ? this.prisma.telegramSubscriber.count({ where: { is_active: true } })
        : Promise.resolve(0),
      this.briefingService.buildEnrichedBriefing().catch(() => null),
    ]);

    const botUsername = profile.username || 'minhmh_coffee_tracker_bot';
    return {
      botUsername,
      deepLink: `https://t.me/${botUsername}?start=subscribe`,
      briefingSchedule: '06:00 hàng ngày, giờ VN (Asia/Ho_Chi_Minh)',
      cronExpression: ALERT_CRONS.MORNING_BRIEFING_0600,
      activeSubscribersCount,
      telegramConfigured: this.telegramService.isConfigured(),
      commands: [
        {
          command: '/start',
          description: 'Đăng ký nhận điểm tin 06:00 sáng & xem ngay bản tin mẫu',
        },
        {
          command: '/today',
          description: 'Xem nhanh giá, thời tiết Tây Nguyên, nhận định & dự báo hôm nay',
        },
        {
          command: '/stop',
          description: 'Tạm dừng nhận điểm tin tự động hàng ngày',
        },
      ],
      sampleMessagePreview:
        briefing?.plainPreview ||
        'Bản tin Thị trường Cà phê sáng lúc 06:00 gồm: Giá 4 tỉnh Tây Nguyên, Thời tiết hôm nay, Nhận định Dầu/Tồn kho/Tỷ giá và Dự báo 6 tháng P10–P50–P90.',
      sampleMessageHtml: briefing?.html || null,
    };
  }
}
