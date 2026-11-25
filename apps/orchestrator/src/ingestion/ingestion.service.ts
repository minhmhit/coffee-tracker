import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RawMarketPrice, DailyWeather, IceRobustaStock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomesticCoffeeAdapter } from './adapters/domestic-coffee.adapter';
import { LondonRobustaAdapter } from './adapters/london-robusta.adapter';
import { ExchangeRateAdapter } from './adapters/exchange-rate.adapter';
import { BrentOilAdapter } from './adapters/brent-oil.adapter';
import { NoaaOniAdapter } from './adapters/noaa-oni.adapter';
import { OpenMeteoAdapter, CLIMATE_LOCATIONS } from './adapters/open-meteo.adapter';
import { WeatherAdapter } from './adapters/weather.adapter';
import { IceStocksAdapter } from './adapters/ice-stocks.adapter';
import { PriceSanityValidator, SanityCheckOptions, SanityCheckResult } from './validators/price-sanity.validator';
import { IceStocksSanityValidator } from './validators/ice-stocks-sanity.validator';
import { DailyMarketSnapshot, ProvinceWeatherData } from './types/market-data.types';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly domesticAdapter: DomesticCoffeeAdapter,
    private readonly londonAdapter: LondonRobustaAdapter,
    private readonly fxAdapter: ExchangeRateAdapter,
    private readonly oilAdapter: BrentOilAdapter,
    private readonly noaaAdapter: NoaaOniAdapter,
    private readonly openMeteoAdapter: OpenMeteoAdapter,
    private readonly weatherAdapter: WeatherAdapter,
    private readonly iceStocksAdapter: IceStocksAdapter,
    private readonly validator: PriceSanityValidator,
    private readonly iceStocksValidator: IceStocksSanityValidator,
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

  /**
   * Synchronizes monthly macro & climate indicators (NOAA ONI + Open-Meteo Rainfall Anomalies)
   * into the macro_climate_monthly table.
   * Conforms strictly to Single Writer Principle, Idempotency, and Zero Float Principle.
   */
  async syncMacroClimateMonthly(startYear = 2018): Promise<{
    syncedCount: number;
    earliestDate?: string;
    latestDate?: string;
    latestOni?: number;
  }> {
    this.logger.log(`Starting macro climate monthly synchronization from year ${startYear}...`);

    // 1. Fetch NOAA ONI and Open-Meteo rainfall anomalies in parallel
    const [noaaRes, vnAnomalies, brAnomalies] = await Promise.all([
      this.noaaAdapter.fetch(),
      this.openMeteoAdapter.getHistoricalAnomalies(CLIMATE_LOCATIONS.DAKLAK),
      this.openMeteoAdapter.getHistoricalAnomalies(CLIMATE_LOCATIONS.BRAZIL),
    ]);

    const onis = noaaRes.data;

    // 2. Build complete list of monthly keys (YYYY-MM-01) from startYear to current month
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1; // 1-12

    const monthKeys: string[] = [];
    for (let y = startYear; y <= currentYear; y++) {
      const maxM = y === currentYear ? currentMonth : 12;
      for (let m = 1; m <= maxM; m++) {
        const mStr = m < 10 ? `0${m}` : `${m}`;
        monthKeys.push(`${y}-${mStr}-01`);
      }
    }

    this.logger.log(`Upserting ${monthKeys.length} monthly climate records into PostgreSQL...`);

    let syncedCount = 0;
    let latestOni: number | undefined;

    for (const monthStr of monthKeys) {
      const dateObj = new Date(`${monthStr}T00:00:00.000Z`);

      const oniVal = onis.get(monthStr);
      const vnVal = vnAnomalies.get(monthStr);
      const brVal = brAnomalies.get(monthStr);

      if (oniVal !== undefined) {
        latestOni = oniVal;
      }

      await this.prisma.macroClimateMonthly.upsert({
        where: { month_date: dateObj },
        update: {
          oni_index: oniVal !== undefined ? new Prisma.Decimal(oniVal) : undefined,
          vn_rain_anomaly: vnVal !== undefined ? new Prisma.Decimal(vnVal) : undefined,
          br_rain_anomaly: brVal !== undefined ? new Prisma.Decimal(brVal) : undefined,
        },
        create: {
          month_date: dateObj,
          oni_index: oniVal !== undefined ? new Prisma.Decimal(oniVal) : null,
          vn_rain_anomaly: vnVal !== undefined ? new Prisma.Decimal(vnVal) : null,
          br_rain_anomaly: brVal !== undefined ? new Prisma.Decimal(brVal) : null,
        },
      });

      syncedCount++;
    }

    this.logger.log(
      `Macro climate sync completed! Synced ${syncedCount} months (${monthKeys[0]} to ${monthKeys[monthKeys.length - 1]})`,
    );

    return {
      syncedCount,
      earliestDate: monthKeys[0],
      latestDate: monthKeys[monthKeys.length - 1],
      latestOni,
    };
  }

  /**
   * Synchronizes daily Central Highlands weather (4 provinces) from Open-Meteo Forecast API
   * into `daily_weather`. Isolated from market price errors.
   */
  async syncDailyWeather(targetDate?: string): Promise<{
    success: boolean;
    syncedCount: number;
    date?: string;
    error?: string;
  }> {
    const res = await this.weatherAdapter.fetch();
    if (!res.success || !res.data || res.data.length === 0) {
      this.logger.warn(`Weather sync skipped/failed cleanly: ${res.error || 'empty data'}`);
      return {
        success: false,
        syncedCount: 0,
        error: res.error || 'Empty weather response',
      };
    }

    let syncedCount = 0;
    let savedDate = '';

    for (const w of res.data) {
      const dateStr = targetDate || w.weatherDate;
      savedDate = dateStr;
      const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

      await this.prisma.dailyWeather.upsert({
        where: {
          weather_date_province_code: {
            weather_date: dateObj,
            province_code: w.provinceCode,
          },
        },
        update: {
          province_name: w.provinceName,
          temp_current: w.tempCurrent !== null ? new Prisma.Decimal(w.tempCurrent) : null,
          temp_min: new Prisma.Decimal(w.tempMin),
          temp_max: new Prisma.Decimal(w.tempMax),
          precipitation_mm: new Prisma.Decimal(w.precipitationMm),
          rain_probability: w.rainProbability,
          humidity_pct: w.humidityPct,
          wind_speed_kmh: w.windSpeedKmh !== null ? new Prisma.Decimal(w.windSpeedKmh) : null,
          weather_code: w.weatherCode,
          condition_vi: w.conditionVi,
          farming_impact_vi: w.farmingImpactVi,
          raw_meta: w.rawMeta as any,
        },
        create: {
          weather_date: dateObj,
          province_code: w.provinceCode,
          province_name: w.provinceName,
          temp_current: w.tempCurrent !== null ? new Prisma.Decimal(w.tempCurrent) : null,
          temp_min: new Prisma.Decimal(w.tempMin),
          temp_max: new Prisma.Decimal(w.tempMax),
          precipitation_mm: new Prisma.Decimal(w.precipitationMm),
          rain_probability: w.rainProbability,
          humidity_pct: w.humidityPct,
          wind_speed_kmh: w.windSpeedKmh !== null ? new Prisma.Decimal(w.windSpeedKmh) : null,
          weather_code: w.weatherCode,
          condition_vi: w.conditionVi,
          farming_impact_vi: w.farmingImpactVi,
          raw_meta: w.rawMeta as any,
        },
      });
      syncedCount++;
    }

    this.logger.log(`Weather sync completed: upserted ${syncedCount} provinces for ${savedDate}`);
    return {
      success: true,
      syncedCount,
      date: savedDate,
    };
  }

  /**
   * Synchronizes ICE Futures Europe Certified Robusta Coffee Stocks into `ice_robusta_stocks`.
   * Enforces sanity validation (500..50000 lots, ±25% DoD delta) and gracefully retains
   * the latest known value with `is_stale = true` if upstream feeds fail.
   */
  async syncIceRobustaStocks(targetDate?: string): Promise<{
    success: boolean;
    reportDate?: string;
    certifiedLots?: number;
    certifiedTonnes?: number;
    isStale: boolean;
    error?: string;
  }> {
    const todayStr =
      targetDate ||
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

    const res = await this.iceStocksAdapter.fetch();
    let failureReason = res.error || '';

    if (res.success && res.data) {
      const stock = res.data;
      const reportDateStr = targetDate || stock.reportDate;
      const dateObj = new Date(`${reportDateStr}T00:00:00.000Z`);

      const priorRecord = await this.prisma.iceRobustaStock.findFirst({
        where: { report_date: { lt: dateObj } },
        orderBy: { report_date: 'desc' },
      });

      const sanity = this.iceStocksValidator.validate(stock, {
        previousLots: priorRecord?.certified_lots ?? null,
      });

      if (sanity.valid) {
        const dodChangeLots = priorRecord ? stock.certifiedLots - priorRecord.certified_lots : null;
        const saved = await this.prisma.iceRobustaStock.upsert({
          where: { report_date: dateObj },
          update: {
            certified_lots: stock.certifiedLots,
            certified_tonnes: new Prisma.Decimal(stock.certifiedTonnes),
            dod_change_lots: dodChangeLots,
            source_name: stock.sourceName,
            is_stale: false,
            raw_meta: {
              ...(stock.rawMeta || {}),
              is_stale: false,
            } as any,
          },
          create: {
            report_date: dateObj,
            certified_lots: stock.certifiedLots,
            certified_tonnes: new Prisma.Decimal(stock.certifiedTonnes),
            dod_change_lots: dodChangeLots,
            source_name: stock.sourceName,
            is_stale: false,
            raw_meta: {
              ...(stock.rawMeta || {}),
              is_stale: false,
            } as any,
          },
        });

        this.logger.log(
          `ICE Robusta stocks synced: ${saved.certified_lots} lots (${saved.certified_tonnes} tonnes) for ${reportDateStr} from ${stock.sourceName}`,
        );
        return {
          success: true,
          reportDate: reportDateStr,
          certifiedLots: saved.certified_lots,
          certifiedTonnes: saved.certified_tonnes.toNumber(),
          isStale: false,
        };
      }

      failureReason = `Sanity validation failed: ${sanity.reasons.join('; ')}`;
      this.logger.warn(`ICE Robusta stocks rejected by sanity validator: ${failureReason}`);
    }

    // Stale carry-forward fallback when upstream scrape failed or failed sanity
    const latestValid = await this.prisma.iceRobustaStock.findFirst({
      orderBy: { report_date: 'desc' },
    });

    if (!latestValid) {
      this.logger.warn(`ICE Robusta stocks unavailable and no prior DB value exists: ${failureReason}`);
      return {
        success: false,
        isStale: true,
        error: failureReason || 'No ICE stock data available',
      };
    }

    const todayObj = new Date(`${todayStr}T00:00:00.000Z`);
    const existingToday = await this.prisma.iceRobustaStock.findUnique({
      where: { report_date: todayObj },
    });

    if (existingToday && !existingToday.is_stale) {
      return {
        success: true,
        reportDate: todayStr,
        certifiedLots: existingToday.certified_lots,
        certifiedTonnes: existingToday.certified_tonnes.toNumber(),
        isStale: false,
      };
    }

    const carriedFromDate = latestValid.report_date.toISOString().split('T')[0];
    const staleSaved = await this.prisma.iceRobustaStock.upsert({
      where: { report_date: todayObj },
      update: {
        certified_lots: latestValid.certified_lots,
        certified_tonnes: latestValid.certified_tonnes,
        dod_change_lots: 0,
        source_name: 'stale_carry_forward',
        is_stale: true,
        raw_meta: {
          is_stale: true,
          carried_from_date: carriedFromDate,
          original_source: latestValid.source_name,
          reason: failureReason,
        } as any,
      },
      create: {
        report_date: todayObj,
        certified_lots: latestValid.certified_lots,
        certified_tonnes: latestValid.certified_tonnes,
        dod_change_lots: 0,
        source_name: 'stale_carry_forward',
        is_stale: true,
        raw_meta: {
          is_stale: true,
          carried_from_date: carriedFromDate,
          original_source: latestValid.source_name,
          reason: failureReason,
        } as any,
      },
    });

    this.logger.warn(
      `Retained stale ICE Robusta stocks (${staleSaved.certified_lots} lots from ${carriedFromDate}) for ${todayStr}`,
    );

    return {
      success: true,
      reportDate: todayStr,
      certifiedLots: staleSaved.certified_lots,
      certifiedTonnes: staleSaved.certified_tonnes.toNumber(),
      isStale: true,
      error: failureReason,
    };
  }
}
