import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RawMarketPrice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomesticCoffeeAdapter } from './adapters/domestic-coffee.adapter';
import { LondonRobustaAdapter } from './adapters/london-robusta.adapter';
import { ExchangeRateAdapter } from './adapters/exchange-rate.adapter';
import { BrentOilAdapter } from './adapters/brent-oil.adapter';
import { PriceSanityValidator, SanityCheckOptions, SanityCheckResult } from './validators/price-sanity.validator';
import { DailyMarketSnapshot } from './types/market-data.types';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly domesticAdapter: DomesticCoffeeAdapter,
    private readonly londonAdapter: LondonRobustaAdapter,
    private readonly fxAdapter: ExchangeRateAdapter,
    private readonly oilAdapter: BrentOilAdapter,
    private readonly validator: PriceSanityValidator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Fetches the latest live market data from all 4 adapters and runs sanity validation.
   */
  async fetchDailySnapshot(targetDate?: string, options?: SanityCheckOptions): Promise<{
    snapshot?: DailyMarketSnapshot;
    sanityResult: SanityCheckResult;
    errors: string[];
  }> {
    const dateStr = targetDate || new Date().toISOString().split('T')[0];
    this.logger.log(`Starting coordinated market data fetch for date: ${dateStr}`);

    // If options don't specify previous snapshot, look up latest record from DB
    const effectiveOptions: SanityCheckOptions = { ...options };
    if (!effectiveOptions.previousSnapshot) {
      const prevPrice = await this.getLatestDaklakPrice();
      if (prevPrice !== null) {
        effectiveOptions.previousSnapshot = {
          domestic: {
            daklak: prevPrice,
          } as any,
        };
      }
    }

    // Parallel fetch across all 4 independent adapters
    const [domesticRes, londonRes, fxRes, oilRes] = await Promise.all([
      this.domesticAdapter.fetch(),
      this.londonAdapter.fetch(),
      this.fxAdapter.fetch(),
      this.oilAdapter.fetch(),
    ]);

    const errors: string[] = [];
    if (!domesticRes.success || !domesticRes.data) errors.push(`Domestic coffee fetch failed: ${domesticRes.error}`);
    if (!londonRes.success || !londonRes.data) errors.push(`London futures fetch failed: ${londonRes.error}`);
    if (!fxRes.success || !fxRes.data) errors.push(`Exchange rate fetch failed: ${fxRes.error}`);
    if (!oilRes.success || !oilRes.data) errors.push(`Brent oil fetch failed: ${oilRes.error}`);

    if (errors.length > 0) {
      this.logger.error(`Snapshot incomplete with ${errors.length} fetch errors: ${errors.join('; ')}`);
    }

    const snapshot: DailyMarketSnapshot = {
      date: dateStr,
      domestic: domesticRes.data!,
      london: londonRes.data!,
      exchangeRate: fxRes.data!,
      brentOil: oilRes.data!,
      sourceMeta: {
        domestic_source: domesticRes.source,
        domestic_latency_ms: String(domesticRes.latencyMs),
        london_source: londonRes.source,
        london_latency_ms: String(londonRes.latencyMs),
        fx_source: fxRes.source,
        fx_latency_ms: String(fxRes.latencyMs),
        oil_source: oilRes.source,
        oil_latency_ms: String(oilRes.latencyMs),
      },
    };

    const sanityResult = this.validator.validate(snapshot, effectiveOptions);

    return {
      snapshot: sanityResult.valid ? snapshot : undefined,
      sanityResult,
      errors,
    };
  }

  /**
   * Idempotent UPSERT of a DailyMarketSnapshot into PostgreSQL raw_market_prices table.
   * Conforms strictly to the Single Writer Principle and Zero Float Principle.
   */
  async upsertDailySnapshot(snapshot: DailyMarketSnapshot): Promise<RawMarketPrice> {
    const dateObj = new Date(`${snapshot.date}T00:00:00.000Z`);

    const record = await this.prisma.rawMarketPrice.upsert({
      where: { price_date: dateObj },
      update: {
        price_daklak: new Prisma.Decimal(snapshot.domestic.daklak),
        price_lamdong: new Prisma.Decimal(snapshot.domestic.lamdong),
        price_gialai: new Prisma.Decimal(snapshot.domestic.gialai),
        price_daknong: new Prisma.Decimal(snapshot.domestic.daknong),
        price_avg: new Prisma.Decimal(snapshot.domestic.average),
        london_m1: snapshot.london?.m1 != null ? new Prisma.Decimal(snapshot.london.m1) : undefined,
        london_m3: snapshot.london?.m3 != null ? new Prisma.Decimal(snapshot.london.m3) : undefined,
        london_m6: snapshot.london?.m6 != null ? new Prisma.Decimal(snapshot.london.m6) : undefined,
        usd_vnd: snapshot.exchangeRate?.usdVnd != null ? new Prisma.Decimal(snapshot.exchangeRate.usdVnd) : undefined,
        brent_oil: snapshot.brentOil?.price != null ? new Prisma.Decimal(snapshot.brentOil.price) : undefined,
        source_meta: snapshot.sourceMeta as any,
      },
      create: {
        price_date: dateObj,
        price_daklak: new Prisma.Decimal(snapshot.domestic.daklak),
        price_lamdong: new Prisma.Decimal(snapshot.domestic.lamdong),
        price_gialai: new Prisma.Decimal(snapshot.domestic.gialai),
        price_daknong: new Prisma.Decimal(snapshot.domestic.daknong),
        price_avg: new Prisma.Decimal(snapshot.domestic.average),
        london_m1: snapshot.london?.m1 != null ? new Prisma.Decimal(snapshot.london.m1) : null,
        london_m3: snapshot.london?.m3 != null ? new Prisma.Decimal(snapshot.london.m3) : null,
        london_m6: snapshot.london?.m6 != null ? new Prisma.Decimal(snapshot.london.m6) : null,
        usd_vnd: snapshot.exchangeRate?.usdVnd != null ? new Prisma.Decimal(snapshot.exchangeRate.usdVnd) : null,
        brent_oil: snapshot.brentOil?.price != null ? new Prisma.Decimal(snapshot.brentOil.price) : null,
        source_meta: snapshot.sourceMeta as any,
      },
    });

    this.logger.log(
      `Successfully upserted market price record for date ${snapshot.date} (ID: ${record.id}, Dak Lak: ${record.price_daklak} VND/kg)`,
    );

    return record;
  }

  /**
   * Helper to retrieve the most recent Dak Lak price from the database for Day-over-Day validation.
   */
  async getLatestDaklakPrice(): Promise<number | null> {
    const latest = await this.prisma.rawMarketPrice.findFirst({
      orderBy: { price_date: 'desc' },
      select: { price_daklak: true },
    });

    if (!latest) return null;
    return latest.price_daklak.toNumber();
  }
}
