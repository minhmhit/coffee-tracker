import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Optional } from '@nestjs/common';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../../signals/signals.constants';
import { TelegramService, TelegramSendResult } from '../telegram.service';
import { AlertFormatter, AnomalyAlertData, SystemErrorData } from '../alert-formatter';
import { PrismaService } from '../../prisma/prisma.service';
import { MorningBriefingService } from '../morning-briefing.service';

@Processor(ALERT_QUEUE_NAME)
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  // In-memory deduplication guards
  private readonly sentBriefings = new Set<string>();
  private readonly sentAnomalies = new Set<string>();

  constructor(
    private readonly telegramService: TelegramService,
    private readonly prisma: PrismaService,
    @Optional() private readonly briefingService?: MorningBriefingService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing alert job ${job.id} [${job.name}]...`);

    switch (job.name) {
      case ALERT_JOBS.MORNING_BRIEFING:
        return this.handleMorningBriefing(job);

      case ALERT_JOBS.ANOMALY_ALERT:
        return this.handleAnomalyAlert(job);

      case ALERT_JOBS.SYSTEM_ERROR:
        return this.handleSystemError(job);

      default:
        this.logger.warn(`Unknown alert job type: ${job.name}`);
        return { ignored: true };
    }
  }

  /**
   * Handles daily 06:00 AM Morning Market Briefing broadcast across all active subscribers
   * and fallback .env chat_id.
   */
  private async handleMorningBriefing(job: Job<any>): Promise<any> {
    const slot = job.data?.slot || '0600';

    // Build enriched HTML via shared MorningBriefingService when injected, or direct fallback
    let dateStr: string;
    let messageHtml: string;

    if (this.briefingService) {
      const built = await this.briefingService.buildEnrichedBriefing();
      if (!built) {
        this.logger.warn('No market price data available for morning briefing');
        return { skipped: true, reason: 'No market prices found' };
      }
      dateStr = built.dateStr;
      messageHtml = built.html;
    } else {
      const legacyBuilt = await this.buildLegacyFallbackBriefing();
      if (!legacyBuilt) {
        this.logger.warn('No market price data available for morning briefing');
        return { skipped: true, reason: 'No market prices found' };
      }
      dateStr = legacyBuilt.dateStr;
      messageHtml = legacyBuilt.html;
    }

    const briefingKey = `${dateStr}_${slot}`;
    if (this.sentBriefings.has(briefingKey) && !job.data?.force) {
      this.logger.log(`Morning briefing for ${briefingKey} already sent. Skipping duplicate.`);
      return { skipped: true, duplicate: true };
    }

    const recipients = await this.getDeduplicatedRecipients();
    const broadcastResult = await this.broadcastToRecipients(recipients, messageHtml);

    if (broadcastResult.success) {
      this.sentBriefings.add(briefingKey);
    }

    return broadcastResult;
  }

  private async getDeduplicatedRecipients(): Promise<string[]> {
    const recipientSet = new Set<string>();

    if (this.prisma.telegramSubscriber) {
      const subscribers = await this.prisma.telegramSubscriber.findMany({
        where: { is_active: true },
        select: { chat_id: true },
      });
      for (const s of subscribers) {
        if (s.chat_id) recipientSet.add(s.chat_id);
      }
    }

    const defaultChatId = process.env.TELEGRAM_CHAT_ID;
    if (defaultChatId && !defaultChatId.includes('your_telegram_chat_id')) {
      recipientSet.add(defaultChatId);
    }

    return Array.from(recipientSet);
  }

  private async broadcastToRecipients(
    chatIds: string[],
    messageHtml: string,
  ): Promise<TelegramSendResult & { deliveredCount: number; totalRecipients: number; deactivatedCount: number }> {
    // Fallback to legacy single sendMessage if no explicit recipients resolved or in mocked legacy tests
    if (chatIds.length === 0 || !this.telegramService.sendMessageToChat) {
      const res = await this.telegramService.sendMessage(messageHtml);
      return {
        ...res,
        deliveredCount: res.success ? 1 : 0,
        totalRecipients: chatIds.length || 1,
        deactivatedCount: 0,
      };
    }

    let deliveredCount = 0;
    let deactivatedCount = 0;
    let firstSuccessId: number | undefined;
    let lastError: string | undefined;

    for (const chatId of chatIds) {
      const res = await this.telegramService.sendMessageToChat(chatId, messageHtml);
      if (res.success) {
        deliveredCount++;
        if (firstSuccessId === undefined) firstSuccessId = res.messageId;
      } else {
        lastError = res.error;
        if (
          res.errorCode === 403 ||
          (res.error && /forbidden|blocked/i.test(res.error))
        ) {
          this.logger.warn(
            `Subscriber ${chatId} blocked the bot (403). Marking is_active=false cleanly.`,
          );
          if (this.prisma.telegramSubscriber) {
            await this.prisma.telegramSubscriber.updateMany({
              where: { chat_id: chatId },
              data: { is_active: false },
            });
          }
          deactivatedCount++;
        }
      }
    }

    return {
      success: deliveredCount > 0,
      messageId: firstSuccessId,
      error: deliveredCount > 0 ? undefined : lastError,
      deliveredCount,
      totalRecipients: chatIds.length,
      deactivatedCount,
    };
  }

  private async buildLegacyFallbackBriefing(): Promise<{ dateStr: string; html: string } | null> {
    const recentPrices = await this.prisma.rawMarketPrice.findMany({
      orderBy: { price_date: 'desc' },
      take: 2,
    });

    if (recentPrices.length === 0) return null;

    const latest = recentPrices[0];
    const prev = recentPrices.length > 1 ? recentPrices[1] : null;
    const dateStr = latest.price_date.toISOString().split('T')[0];

    const daklak = latest.price_daklak.toNumber();
    const prevDaklak = prev ? prev.price_daklak.toNumber() : daklak;
    const dodChangePct = prevDaklak > 0 ? (daklak - prevDaklak) / prevDaklak : 0;

    const signal = await this.prisma.dailySignal.findUnique({
      where: { signal_date: latest.price_date },
    });

    const londonM1 = latest.london_m1 ? latest.london_m1.toNumber() : null;
    const londonM6 = latest.london_m6 ? latest.london_m6.toNumber() : null;
    const spread = signal?.spread
      ? signal.spread.toNumber()
      : londonM1 && londonM6
      ? londonM1 - londonM6
      : null;

    const html = AlertFormatter.formatMorningBriefing({
      date: dateStr,
      daklakPrice: daklak,
      dodChangePct,
      londonM1,
      spreadM1M6: spread,
      usdVndRate: latest.usd_vnd ? latest.usd_vnd.toNumber() : null,
      basisVndKg: signal?.basis ? signal.basis.toNumber() : 0,
      regime: signal?.regime || 'NORMAL',
      volatility30d: signal?.volatility_30d ? signal.volatility_30d.toNumber() : null,
    });

    return { dateStr, html };
  }

  /**
   * Handles instant Hot Anomaly Alert (|z_score| > 2.5).
   */
  private async handleAnomalyAlert(job: Job<AnomalyAlertData>): Promise<any> {
    const data = job.data;
    const dateStr = data.signalDate;

    if (this.sentAnomalies.has(dateStr)) {
      this.logger.log(`Anomaly alert for ${dateStr} already dispatched. Skipping duplicate.`);
      return { skipped: true, duplicate: true };
    }

    const messageHtml = AlertFormatter.formatAnomalyAlert(data);
    const recipients = await this.getDeduplicatedRecipients();
    const result = await this.broadcastToRecipients(recipients, messageHtml);

    if (result.success) {
      this.sentAnomalies.add(dateStr);
    }

    return result;
  }

  /**
   * Handles critical System Failure Alert (admin chat only).
   */
  private async handleSystemError(job: Job<SystemErrorData>): Promise<any> {
    const data = job.data;
    const messageHtml = AlertFormatter.formatSystemError(data);

    return this.telegramService.sendMessage(messageHtml);
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job, error: Error) {
    this.logger.error(`Alert job ${job.id} [${job.name}] failed: ${error.message}`, error.stack);
  }
}
