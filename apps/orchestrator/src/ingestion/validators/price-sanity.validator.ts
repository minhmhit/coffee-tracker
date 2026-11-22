import { Injectable, Logger } from '@nestjs/common';
import { DailyMarketSnapshot } from '../types/market-data.types';

export interface SanityCheckResult {
  valid: boolean;
  reasons: string[];
}

export interface SanityCheckOptions {
  maxDayOverDayChangePct?: number; // default: 15%
  previousSnapshot?: Partial<DailyMarketSnapshot>;
}

@Injectable()
export class PriceSanityValidator {
  private readonly logger = new Logger(PriceSanityValidator.name);
  private readonly DEFAULT_MAX_JUMP_PCT = 15;

  validate(
    snapshot: DailyMarketSnapshot,
    options?: SanityCheckOptions,
  ): SanityCheckResult {
    const reasons: string[] = [];
    const maxJump = options?.maxDayOverDayChangePct ?? this.DEFAULT_MAX_JUMP_PCT;
    const prev = options?.previousSnapshot;

    // 1. Domestic Prices Bounds & Null Checks
    if (!snapshot.domestic) {
      reasons.push('Domestic prices object is completely missing');
    } else {
      const { daklak, lamdong, gialai, daknong, average } = snapshot.domestic;

      if (!daklak || isNaN(daklak) || daklak <= 0) {
        reasons.push(`Benchmark province Đắk Lắk price is invalid or <= 0: ${daklak}`);
      } else if (daklak < 20000 || daklak > 300000) {
        reasons.push(`Đắk Lắk price is outside plausible bounds (20k - 300k): ${daklak}`);
      }

      if (!lamdong || isNaN(lamdong) || lamdong <= 0) {
        reasons.push(`Lâm Đồng price is invalid or <= 0: ${lamdong}`);
      }
      if (!gialai || isNaN(gialai) || gialai <= 0) {
        reasons.push(`Gia Lai price is invalid or <= 0: ${gialai}`);
      }
      if (!daknong || isNaN(daknong) || daknong <= 0) {
        reasons.push(`Đắk Nông price is invalid or <= 0: ${daknong}`);
      }
      if (!average || isNaN(average) || average <= 0) {
        reasons.push(`Average domestic price is invalid or <= 0: ${average}`);
      }
    }

    // 2. London Robusta Futures Bounds
    if (!snapshot.london) {
      reasons.push('London futures object is missing');
    } else {
      const { m1, m3, m6 } = snapshot.london;
      if (!m1 || isNaN(m1) || m1 <= 0 || m1 < 500 || m1 > 15000) {
        reasons.push(`London M1 future price is outside plausible bounds (500 - 15000 USD): ${m1}`);
      }
      if (!m3 || isNaN(m3) || m3 <= 0 || m3 < 500 || m3 > 15000) {
        reasons.push(`London M3 future price is outside plausible bounds: ${m3}`);
      }
      if (!m6 || isNaN(m6) || m6 <= 0 || m6 < 500 || m6 > 15000) {
        reasons.push(`London M6 future price is outside plausible bounds: ${m6}`);
      }
    }

    // 3. USD/VND Exchange Rate Bounds
    if (!snapshot.exchangeRate) {
      reasons.push('Exchange rate object is missing');
    } else {
      const { usdVnd } = snapshot.exchangeRate;
      if (!usdVnd || isNaN(usdVnd) || usdVnd < 15000 || usdVnd > 40000) {
        reasons.push(`USD/VND rate is outside plausible commercial bounds (15k - 40k): ${usdVnd}`);
      }
    }

    // 4. Brent Oil Price Bounds
    if (!snapshot.brentOil) {
      reasons.push('Brent oil object is missing');
    } else {
      const { price } = snapshot.brentOil;
      if (!price || isNaN(price) || price < 20 || price > 300) {
        reasons.push(`Brent oil price is outside plausible bounds (20 - 300 USD): ${price}`);
      }
    }

    // 5. Day-Over-Day Jump Detection against Previous Snapshot
    if (prev) {
      if (prev.domestic?.daklak && snapshot.domestic?.daklak) {
        const jump = this.calculateJumpPct(
          snapshot.domestic.daklak,
          prev.domestic.daklak,
        );
        if (Math.abs(jump) > maxJump) {
          reasons.push(
            `Đắk Lắk day-over-day price jump (${jump.toFixed(2)}%) exceeds ±${maxJump}% threshold (Previous: ${prev.domestic.daklak}, Current: ${snapshot.domestic.daklak})`,
          );
        }
      }

      if (prev.london?.m1 && snapshot.london?.m1) {
        const jump = this.calculateJumpPct(
          snapshot.london.m1,
          prev.london.m1,
        );
        if (Math.abs(jump) > maxJump) {
          reasons.push(
            `London M1 day-over-day price jump (${jump.toFixed(2)}%) exceeds ±${maxJump}% threshold (Previous: ${prev.london.m1}, Current: ${snapshot.london.m1})`,
          );
        }
      }

      if (prev.exchangeRate?.usdVnd && snapshot.exchangeRate?.usdVnd) {
        // Exchange rate jump threshold is even tighter, e.g., max 5% normally, but flag on maxJump
        const jump = this.calculateJumpPct(
          snapshot.exchangeRate.usdVnd,
          prev.exchangeRate.usdVnd,
        );
        if (Math.abs(jump) > maxJump) {
          reasons.push(
            `USD/VND day-over-day jump (${jump.toFixed(2)}%) exceeds ±${maxJump}% threshold`,
          );
        }
      }
    }

    const valid = reasons.length === 0;
    if (!valid) {
      this.logger.warn(`Price sanity check FAILED with ${reasons.length} reasons: ${reasons.join('; ')}`);
    }

    return { valid, reasons };
  }

  private calculateJumpPct(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }
}
