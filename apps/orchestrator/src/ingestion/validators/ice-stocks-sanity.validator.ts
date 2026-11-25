import { Injectable, Logger } from '@nestjs/common';
import { IceRobustaStockData } from '../types/market-data.types';
import { SanityCheckResult } from './price-sanity.validator';

export interface IceStockSanityOptions {
  previousLots?: number | null;
  maxDeltaPct?: number; // default: 25%
}

export const ICE_STOCK_BOUNDS = {
  MIN_LOTS: 500,
  MAX_LOTS: 50000,
  TONNES_PER_LOT: 10,
  DEFAULT_MAX_DOD_PCT: 25,
} as const;

@Injectable()
export class IceStocksSanityValidator {
  private readonly logger = new Logger(IceStocksSanityValidator.name);

  /**
   * Validates ICE Certified Robusta Stock records against plausible exchange bounds
   * and day-over-day delta limits, preventing accidental Arabica bag counts (~250k+ bags).
   */
  validate(
    stock: IceRobustaStockData,
    options?: IceStockSanityOptions,
  ): SanityCheckResult {
    const reasons: string[] = [];
    const maxDelta = options?.maxDeltaPct ?? ICE_STOCK_BOUNDS.DEFAULT_MAX_DOD_PCT;

    if (!stock) {
      return { valid: false, reasons: ['ICE stock payload is null or undefined'] };
    }

    const { certifiedLots, certifiedTonnes } = stock;

    if (
      certifiedLots === null ||
      certifiedLots === undefined ||
      !Number.isFinite(certifiedLots) ||
      !Number.isInteger(certifiedLots) ||
      certifiedLots <= 0
    ) {
      reasons.push(`Certified Robusta lots must be a positive integer: ${certifiedLots}`);
    } else if (
      certifiedLots < ICE_STOCK_BOUNDS.MIN_LOTS ||
      certifiedLots > ICE_STOCK_BOUNDS.MAX_LOTS
    ) {
      reasons.push(
        `Certified Robusta lots (${certifiedLots}) is outside plausible bounds [${ICE_STOCK_BOUNDS.MIN_LOTS}, ${ICE_STOCK_BOUNDS.MAX_LOTS}] — possible Arabica bag count or parse error`,
      );
    }

    if (
      certifiedTonnes === null ||
      certifiedTonnes === undefined ||
      !Number.isFinite(certifiedTonnes) ||
      certifiedTonnes <= 0
    ) {
      reasons.push(`Certified tonnes invalid or <= 0: ${certifiedTonnes}`);
    } else if (
      Number.isInteger(certifiedLots) &&
      Math.abs(certifiedTonnes - certifiedLots * ICE_STOCK_BOUNDS.TONNES_PER_LOT) > 0.01
    ) {
      reasons.push(
        `Certified tonnes (${certifiedTonnes}) does not match certifiedLots * 10 (${certifiedLots * ICE_STOCK_BOUNDS.TONNES_PER_LOT})`,
      );
    }

    if (
      options?.previousLots &&
      options.previousLots > 0 &&
      Number.isFinite(certifiedLots) &&
      certifiedLots > 0
    ) {
      const deltaPct = ((certifiedLots - options.previousLots) / options.previousLots) * 100;
      if (Math.abs(deltaPct) > maxDelta) {
        reasons.push(
          `ICE Robusta lots day-over-day change (${deltaPct.toFixed(2)}%) exceeds ±${maxDelta}% threshold (Previous: ${options.previousLots}, Current: ${certifiedLots})`,
        );
      }
    }

    const valid = reasons.length === 0;
    if (!valid) {
      this.logger.warn(
        `ICE Robusta stock sanity check FAILED (${reasons.length}): ${reasons.join('; ')}`,
      );
    }

    return { valid, reasons };
  }
}
