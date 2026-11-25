import { Injectable, Logger } from '@nestjs/common';
import { Prisma, DailySignal, RawMarketPrice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ANOMALY_THRESHOLDS, REGIME_LABELS } from './signals.constants';

export interface SignalComputationResult {
  signalDate: Date;
  basis: number;
  spread: number | null;
  volatility30d: number | null;
  zScore: number | null;
  isAnomaly: boolean;
  regime: string;
  notes: string;
}

@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes risk metrics and trading signals for a single market price record,
   * given a history of preceding records for the rolling window.
   */
  computeSignals(
    current: RawMarketPrice,
    preceding30Days: RawMarketPrice[],
  ): SignalComputationResult {
    const daklak = current.price_daklak.toNumber();
    const londonM1 = current.london_m1 ? current.london_m1.toNumber() : null;
    const londonM6 = current.london_m6 ? current.london_m6.toNumber() : null;
    const usdVnd = current.usd_vnd ? current.usd_vnd.toNumber() : null;

    // 1. Basis (VND/kg): Dak Lak - (LondonM1 / 1000 * USD_VND)
    let basis = 0;
    if (londonM1 !== null && usdVnd !== null) {
      const londonVndKg = (londonM1 / 1000) * usdVnd;
      basis = Math.round((daklak - londonVndKg) * 100) / 100;
    }

    // 2. Calendar Spread (USD/ton): LondonM1 - LondonM6
    let spread: number | null = null;
    if (londonM1 !== null && londonM6 !== null) {
      spread = Math.round((londonM1 - londonM6) * 100) / 100;
    }

    // 3. Regime Label based on Calendar Spread
    let regime: string = REGIME_LABELS.INSUFFICIENT_DATA;
    if (spread !== null) {
      if (spread > 200) {
        regime = REGIME_LABELS.BACKWARDATION_STRONG;
      } else if (spread > 0) {
        regime = REGIME_LABELS.BACKWARDATION_MILD;
      } else if (spread >= -150) {
        regime = REGIME_LABELS.CONTANGO_MILD;
      } else {
        regime = REGIME_LABELS.CONTANGO_STRONG;
      }
    }

    // 4. Daily Return of current day compared to previous day
    const prevDay = preceding30Days.length > 0 ? preceding30Days[preceding30Days.length - 1] : null;
    const prevDaklak = prevDay ? prevDay.price_daklak.toNumber() : null;
    const currentReturn = prevDaklak && prevDaklak > 0 ? (daklak - prevDaklak) / prevDaklak : 0;

    // 5. Rolling Returns over up to 30 trading days
    const allPrices = [...preceding30Days, current].map((p) => p.price_daklak.toNumber());
    const returns: number[] = [];

    for (let i = 1; i < allPrices.length; i++) {
      const pPrev = allPrices[i - 1];
      const pCur = allPrices[i];
      if (pPrev > 0) {
        returns.push((pCur - pPrev) / pPrev);
      }
    }

    // 6. 30-Day Rolling Volatility (Sample Standard Deviation) and Z-Score
    let volatility30d: number | null = null;
    let zScore: number | null = null;
    let isAnomaly = false;

    if (returns.length >= 2) {
      const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
      const variance =
        returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1);
      const std = Math.sqrt(variance);

      volatility30d = Math.round(std * 10000) / 10000;

      // Division-by-zero protection
      if (std > 0.00001) {
        zScore = Math.round(((currentReturn - mean) / std) * 10000) / 10000;
        isAnomaly = Math.abs(zScore) > ANOMALY_THRESHOLDS.Z_SCORE_LIMIT;
      } else {
        zScore = 0;
        isAnomaly = false;
      }
    } else {
      volatility30d = 0;
      zScore = 0;
      isAnomaly = false;
    }

    const returnPctStr = (currentReturn * 100).toFixed(2);
    const zScoreStr = zScore !== null ? zScore.toFixed(2) : '0.00';
    const notes = `DakLak: ${daklak.toLocaleString()} đ, DoD: ${returnPctStr}%, Z: ${zScoreStr}, Basis: ${basis.toLocaleString()} đ, Spread: ${spread ?? 'N/A'}`;

    return {
      signalDate: current.price_date,
      basis,
      spread,
      volatility30d,
      zScore,
      isAnomaly,
      regime,
      notes,
    };
  }

  /**
   * Computes and upserts signals for a given target date.
   * Conforms strictly to Single Writer Principle, Idempotency, and Zero Float Principle.
   */
  async computeSignalsForDate(targetDate: Date | string): Promise<DailySignal> {
    const dateObj = typeof targetDate === 'string' ? new Date(`${targetDate}T00:00:00.000Z`) : targetDate;
    const dateStr = dateObj.toISOString().split('T')[0];

    const current = await this.prisma.rawMarketPrice.findUnique({
      where: { price_date: dateObj },
    });

    if (!current) {
      throw new Error(`Cannot compute signals: No raw market price found for date ${dateStr}`);
    }

    // Retrieve preceding 30 trading days for the rolling window
    const preceding30Days = await this.prisma.rawMarketPrice.findMany({
      where: {
        price_date: {
          lt: dateObj,
        },
      },
      orderBy: {
        price_date: 'desc',
      },
      take: ANOMALY_THRESHOLDS.ROLLING_WINDOW_DAYS,
    });

    // Reverse to chronological order (oldest to newest preceding date)
    preceding30Days.reverse();

    const computed = this.computeSignals(current, preceding30Days);

    const record = await this.prisma.dailySignal.upsert({
      where: { signal_date: dateObj },
      update: {
        basis: new Prisma.Decimal(computed.basis),
        spread: computed.spread !== null ? new Prisma.Decimal(computed.spread) : undefined,
        volatility_30d:
          computed.volatility30d !== null ? new Prisma.Decimal(computed.volatility30d) : undefined,
        z_score: computed.zScore !== null ? new Prisma.Decimal(computed.zScore) : undefined,
        is_anomaly: computed.isAnomaly,
        regime: computed.regime,
        notes: computed.notes,
      },
      create: {
        signal_date: dateObj,
        basis: new Prisma.Decimal(computed.basis),
        spread: computed.spread !== null ? new Prisma.Decimal(computed.spread) : null,
        volatility_30d:
          computed.volatility30d !== null ? new Prisma.Decimal(computed.volatility30d) : null,
        z_score: computed.zScore !== null ? new Prisma.Decimal(computed.zScore) : null,
        is_anomaly: computed.isAnomaly,
        regime: computed.regime,
        notes: computed.notes,
      },
    });

    this.logger.log(
      `Daily signals computed for ${dateStr} (Basis: ${record.basis} đ, Spread: ${record.spread ?? 'N/A'}, Regime: ${record.regime}, Anomaly: ${record.is_anomaly})`,
    );

    return record;
  }

  /**
   * Backfills daily signals for all historical records in raw_market_prices.
   */
  async backfillAllSignals(): Promise<{ processedCount: number; anomalyCount: number }> {
    this.logger.log('Starting full historical signals backfill...');

    // Fetch all raw market price records ordered chronologically
    const allRecords = await this.prisma.rawMarketPrice.findMany({
      orderBy: { price_date: 'asc' },
    });

    this.logger.log(`Processing ${allRecords.length} historical market price days...`);

    let anomalyCount = 0;
    const chunkSize = 200;
    const computedSignals: SignalComputationResult[] = [];

    // Rolling window calculation
    for (let i = 0; i < allRecords.length; i++) {
      const current = allRecords[i];
      const windowStart = Math.max(0, i - ANOMALY_THRESHOLDS.ROLLING_WINDOW_DAYS);
      const preceding = allRecords.slice(windowStart, i);

      const signal = this.computeSignals(current, preceding);
      if (signal.isAnomaly) {
        anomalyCount++;
      }
      computedSignals.push(signal);
    }

    // Batch upsert into database using transactions
    for (let i = 0; i < computedSignals.length; i += chunkSize) {
      const chunk = computedSignals.slice(i, i + chunkSize);

      await this.prisma.$transaction(
        chunk.map((item) =>
          this.prisma.dailySignal.upsert({
            where: { signal_date: item.signalDate },
            update: {
              basis: new Prisma.Decimal(item.basis),
              spread: item.spread !== null ? new Prisma.Decimal(item.spread) : undefined,
              volatility_30d:
                item.volatility30d !== null ? new Prisma.Decimal(item.volatility30d) : undefined,
              z_score: item.zScore !== null ? new Prisma.Decimal(item.zScore) : undefined,
              is_anomaly: item.isAnomaly,
              regime: item.regime,
              notes: item.notes,
            },
            create: {
              signal_date: item.signalDate,
              basis: new Prisma.Decimal(item.basis),
              spread: item.spread !== null ? new Prisma.Decimal(item.spread) : null,
              volatility_30d:
                item.volatility30d !== null ? new Prisma.Decimal(item.volatility30d) : null,
              z_score: item.zScore !== null ? new Prisma.Decimal(item.zScore) : null,
              is_anomaly: item.isAnomaly,
              regime: item.regime,
              notes: item.notes,
            },
          }),
        ),
      );
    }

    this.logger.log(
      `Historical signals backfill complete: ${computedSignals.length} records processed, ${anomalyCount} anomaly events flagged.`,
    );

    return {
      processedCount: computedSignals.length,
      anomalyCount,
    };
  }
}
