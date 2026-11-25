import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertFormatter, MarketBriefingData } from './alert-formatter';
import { InsightsService } from '../insights/insights.service';

@Injectable()
export class MorningBriefingService {
  private readonly logger = new Logger(MorningBriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly insightsService?: InsightsService,
  ) {}

  /**
   * Aggregates live Market Prices, Signals, Central Highlands Weather, Explainable Insights,
   * and 6-month Probabilistic Forecast into a single clean Telegram HTML briefing.
   */
  async buildEnrichedBriefing(): Promise<{
    dateStr: string;
    html: string;
    plainPreview: string;
  } | null> {
    const recentPrices = await this.prisma.rawMarketPrice.findMany({
      orderBy: { price_date: 'desc' },
      take: 2,
    });

    if (recentPrices.length === 0) {
      return null;
    }

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

    // Fetch latest benchmark weather (Đắk Lắk) if available
    let weatherSection: MarketBriefingData['weather'] = null;
    try {
      if (this.prisma.dailyWeather) {
        const latestWeather = await this.prisma.dailyWeather.findFirst({
          where: { province_code: 'DAKLAK' },
          orderBy: { weather_date: 'desc' },
        });
        if (latestWeather) {
          weatherSection = {
            date: latestWeather.weather_date.toISOString().split('T')[0],
            provinceName: latestWeather.province_name,
            tempCurrent: latestWeather.temp_current
              ? latestWeather.temp_current.toNumber()
              : null,
            tempMin: latestWeather.temp_min.toNumber(),
            tempMax: latestWeather.temp_max.toNumber(),
            precipitationMm: latestWeather.precipitation_mm.toNumber(),
            conditionVi: latestWeather.condition_vi,
            farmingImpactVi: latestWeather.farming_impact_vi,
          };
        }
      }
    } catch (wErr: any) {
      this.logger.warn(`Could not load daily weather for briefing: ${wErr.message}`);
    }

    // Fetch Explainable Insights (Oil, ICE Stocks/Supply, FX, Forecast Transparency)
    let insightsSection: MarketBriefingData['insights'] = null;
    let forecastConfidenceNote: string | undefined;

    if (this.insightsService) {
      try {
        const insights = await this.insightsService.getLatestInsights();
        const oilCard = insights.factors.find((f) => f.key === 'oil');
        const supplyCard = insights.factors.find((f) => f.key === 'inventory_supply');
        const fxCard = insights.factors.find((f) => f.key === 'fx');

        insightsSection = {
          stance: insights.overall_stance,
          supplyLine: supplyCard
            ? `${supplyCard.metric_value} (${supplyCard.badge_label})`
            : undefined,
          oilLine: oilCard
            ? `${oilCard.metric_value} (${oilCard.badge_label})`
            : undefined,
          fxLine: fxCard ? `${fxCard.metric_value} (${fxCard.badge_label})` : undefined,
        };

        if (insights.forecast_transparency.available) {
          forecastConfidenceNote = insights.forecast_transparency.confidence_note;
        }
      } catch (iErr: any) {
        this.logger.warn(`Could not load insights for briefing: ${iErr.message}`);
      }
    }

    // Fetch latest successful forecast run for 1M / 3M / 6M milestones
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

      if (latestForecast && latestForecast.predictions?.length > 0) {
        const p4 = latestForecast.predictions.find((p) => p.horizon_week === 4);
        const p12 = latestForecast.predictions.find((p) => p.horizon_week === 12);
        const p26 = latestForecast.predictions.find((p) => p.horizon_week === 26);

        const items: string[] = [];
        if (p4) {
          items.push(
            `\n• <b>1 Tháng (T+4):</b> <code>${Math.round(p4.pred_p50.toNumber()).toLocaleString(
              'vi-VN',
            )} đ/kg</code> (P10–P90: ${Math.round(p4.pred_p10.toNumber()).toLocaleString(
              'vi-VN',
            )} – ${Math.round(p4.pred_p90.toNumber()).toLocaleString('vi-VN')})`,
          );
        }
        if (p12) {
          items.push(
            `\n• <b>3 Tháng (T+12):</b> <code>${Math.round(p12.pred_p50.toNumber()).toLocaleString(
              'vi-VN',
            )} đ/kg</code> (P10–P90: ${Math.round(p12.pred_p10.toNumber()).toLocaleString(
              'vi-VN',
            )} – ${Math.round(p12.pred_p90.toNumber()).toLocaleString('vi-VN')})`,
          );
        }
        if (p26) {
          items.push(
            `\n• <b>6 Tháng (T+26):</b> <code>${Math.round(p26.pred_p50.toNumber()).toLocaleString(
              'vi-VN',
            )} đ/kg</code> (P10–P90: ${Math.round(p26.pred_p10.toNumber()).toLocaleString(
              'vi-VN',
            )} – ${Math.round(p26.pred_p90.toNumber()).toLocaleString('vi-VN')})`,
          );
        }
        if (items.length > 0) {
          forecastSummary = items.join('');
        }
      }
    } catch (fErr: any) {
      this.logger.warn(`Could not load latest forecast for morning briefing: ${fErr.message}`);
    }

    const html = AlertFormatter.formatMorningBriefing({
      date: dateStr,
      daklakPrice: daklak,
      dodChangePct,
      provinces: {
        lamdong: latest.price_lamdong?.toNumber(),
        gialai: latest.price_gialai?.toNumber(),
        daknong: latest.price_daknong?.toNumber(),
      },
      londonM1,
      spreadM1M6: spread,
      usdVndRate: latest.usd_vnd ? latest.usd_vnd.toNumber() : null,
      basisVndKg: signal?.basis ? signal.basis.toNumber() : 0,
      regime: signal?.regime || 'NORMAL',
      volatility30d: signal?.volatility_30d ? signal.volatility_30d.toNumber() : null,
      weather: weatherSection,
      insights: insightsSection,
      forecastSummary,
      forecastConfidenceNote,
    });

    return {
      dateStr,
      html,
      plainPreview: AlertFormatter.htmlToPlainPreview(html),
    };
  }
}
