import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Optional,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { AlertScheduler, ALERT_CRONS } from './schedulers/alert.scheduler';
import { TelegramService } from './telegram.service';
import { MorningBriefingService } from './morning-briefing.service';
import { TelegramBotService } from './telegram-bot.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';

@Controller('api/alerts')
export class AlertsController {
  constructor(
    private readonly alertScheduler: AlertScheduler,
    private readonly telegramService: TelegramService,
    private readonly briefingService: MorningBriefingService,
    private readonly prisma: PrismaService,
    @Optional() private readonly telegramBotService?: TelegramBotService,
  ) {}

  /**
   * Triggers an immediate morning market briefing dispatch to Telegram bot subscribers.
   * Guarded by X-Admin-Key to prevent unauthorized spam.
   */
  @Post('briefing/trigger')
  @UseGuards(AdminApiKeyGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerBriefing(@Body() body?: { force?: boolean }) {
    const job: any = await this.alertScheduler.triggerImmediateBriefing(body?.force ?? true);
    return {
      success: true,
      mode: job?.mode || 'bullmq',
      message:
        job?.mode === 'direct'
          ? 'Morning briefing executed directly (QUEUE_MODE=direct)'
          : 'Morning briefing alert successfully enqueued for dispatch to Telegram bot',
      jobId: job.id,
      schedule: ALERT_CRONS.MORNING_BRIEFING_0600,
      timezone: ALERT_CRONS.TIMEZONE,
    };
  }

  /**
   * Telegram Bot Webhook receiver for cloud serverless/PaaS deployments (TELEGRAM_MODE=webhook).
   * Validates X-Telegram-Bot-Api-Secret-Token against process.env.TELEGRAM_WEBHOOK_SECRET.
   */
  @Post('telegram/webhook')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async handleTelegramWebhook(
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | string[] | undefined,
    @Body() update: any,
  ) {
    const provided = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

    if (!expected || typeof provided !== 'string' || !provided.trim()) {
      throw new UnauthorizedException('Valid X-Telegram-Bot-Api-Secret-Token header is required');
    }

    const providedBuf = Buffer.from(provided.trim(), 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid Telegram webhook secret token');
    }

    if (!this.telegramBotService) {
      return { ok: true, handled: false, reason: 'Bot service unavailable' };
    }

    const result = await this.telegramBotService.handleUpdate(update);
    return { ok: true, ...result };
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
