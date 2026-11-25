import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../../signals/signals.constants';
import { TelegramService } from '../telegram.service';
import { AlertFormatter, AnomalyAlertData, SystemErrorData } from '../alert-formatter';
import { PrismaService } from '../../prisma/prisma.service';

@Processor(ALERT_QUEUE_NAME)
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  // In-memory deduplication guards
  private readonly sentBriefings = new Set<string>();
  private readonly sentAnomalies = new Set<string>();

  constructor(
    private readonly telegramService: TelegramService,
    private readonly prisma: PrismaService,
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
   * Handles daily 08:45 Morning Market Briefing.
   */
  private async handleMorningBriefing(job: Job<any>): Promise<any> {
    // 1. Fetch 2 most recent price records to compute Day-over-Day change
    const recentPrices = await this.prisma.rawMarketPrice.findMany({
      orderBy: { price_date: 'desc' },
      take: 2,
    });

    if (recentPrices.length === 0) {
      this.logger.warn('No market price data available for morning briefing');
      return { skipped: true, reason: 'No market prices found' };
    }

    const latest = recentPrices[0];
    const prev = recentPrices.length > 1 ? recentPrices[1] : null;

    const dateStr = latest.price_date.toISOString().split('T')[0];

    // Deduplication guard
    if (this.sentBriefings.has(dateStr) && !job.data?.force) {
      this.logger.log(`Morning briefing for ${dateStr} already sent. Skipping duplicate.`);
      return { skipped: true, duplicate: true };
    }

    const daklak = latest.price_daklak.toNumber();
    const prevDaklak = prev ? prev.price_daklak.toNumber() : daklak;
    const dodChangePct = prevDaklak > 0 ? (daklak - prevDaklak) / prevDaklak : 0;

    // 2. Fetch corresponding daily signal
    const signal = await this.prisma.dailySignal.findUnique({
      where: { signal_date: latest.price_date },
    });

    const londonM1 = latest.london_m1 ? latest.london_m1.toNumber() : null;
    const londonM6 = latest.london_m6 ? latest.london_m6.toNumber() : null;
    const spread = signal?.spread ? signal.spread.toNumber() : (londonM1 && londonM6 ? londonM1 - londonM6 : null);

    // 3. Fetch latest successful forecast run if available
    let forecastSummary: string | undefined;
    try {
      const latestForecast = this.prisma.forecastRun
        ? await this.prisma.forecastRun.findFirst({
            where: { status: 'SUCCESS' },
            orderBy: { forecast_date: 'desc' },
            include: {
              predictions: {
                orderBy: { horizon_week: 'asc' },
              },
            },
          })
        : null;

      if (latestForecast && latestForecast.predictions && latestForecast.predictions.length > 0) {
        const p4 = latestForecast.predictions.find((p) => p.horizon_week === 4);
        const p12 = latestForecast.predictions.find((p) => p.horizon_week === 12);
        const p26 = latestForecast.predictions.find((p) => p.horizon_week === 26);

        const items: string[] = [];
        if (p4) {
          items.push(`\n  • 1 Tháng (T+4): <b>${Math.round(p4.pred_p50.toNumber()).toLocaleString('vi-VN')}</b> đ/kg (P10-P90: ${Math.round(p4.pred_p10.toNumber()).toLocaleString('vi-VN')} - ${Math.round(p4.pred_p90.toNumber()).toLocaleString('vi-VN')})`);
        }
        if (p12) {
          items.push(`\n  • 3 Tháng (T+12): <b>${Math.round(p12.pred_p50.toNumber()).toLocaleString('vi-VN')}</b> đ/kg (P10-P90: ${Math.round(p12.pred_p10.toNumber()).toLocaleString('vi-VN')} - ${Math.round(p12.pred_p90.toNumber()).toLocaleString('vi-VN')})`);
        }
        if (p26) {
          items.push(`\n  • 6 Tháng (T+26): <b>${Math.round(p26.pred_p50.toNumber()).toLocaleString('vi-VN')}</b> đ/kg (P10-P90: ${Math.round(p26.pred_p10.toNumber()).toLocaleString('vi-VN')} - ${Math.round(p26.pred_p90.toNumber()).toLocaleString('vi-VN')})`);
        }
        if (items.length > 0) {
          forecastSummary = items.join('');
        }
      }
    } catch (fErr: any) {
      this.logger.warn(`Could not load latest forecast for morning briefing: ${fErr.message}`);
    }

    const messageHtml = AlertFormatter.formatMorningBriefing({
      date: dateStr,
      daklakPrice: daklak,
      dodChangePct,
      londonM1,
      spreadM1M6: spread,
      usdVndRate: latest.usd_vnd ? latest.usd_vnd.toNumber() : null,
      basisVndKg: signal?.basis ? signal.basis.toNumber() : 0,
      regime: signal?.regime || 'NORMAL',
      volatility30d: signal?.volatility_30d ? signal.volatility_30d.toNumber() : null,
      forecastSummary,
    });

    const result = await this.telegramService.sendMessage(messageHtml);
    if (result.success) {
      this.sentBriefings.add(dateStr);
    }

    return result;
  }

  /**
   * Handles instant Hot Anomaly Alert (|z_score| > 2.5).
   */
  private async handleAnomalyAlert(job: Job<AnomalyAlertData>): Promise<any> {
    const data = job.data;
    const dateStr = data.signalDate;

    // Deduplication guard: prevent duplicate alerts for the same date
    if (this.sentAnomalies.has(dateStr)) {
      this.logger.log(`Anomaly alert for ${dateStr} already dispatched. Skipping duplicate.`);
      return { skipped: true, duplicate: true };
    }

    const messageHtml = AlertFormatter.formatAnomalyAlert(data);
    const result = await this.telegramService.sendMessage(messageHtml);

    if (result.success) {
      this.sentAnomalies.add(dateStr);
    }

    return result;
  }

  /**
   * Handles critical System Failure Alert.
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
