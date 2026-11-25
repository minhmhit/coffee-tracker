import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/market')
export class MarketController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the most recent market price snapshot across all 4 Central Highlands provinces,
   * international benchmarks (London M1/M3/M6, USD/VND, Brent Oil), and Day-over-Day / Week-over-Week changes.
   */
  @Get('latest')
  async getLatestSnapshot() {
    const prices = await this.prisma.rawMarketPrice.findMany({
      orderBy: { price_date: 'desc' },
      take: 8, // Latest + 1 day prior (DoD) + 7 days prior (WoW)
    });

    if (prices.length === 0) {
      throw new NotFoundException('No market price records found in database');
    }

    const latest = prices[0];
    const prevDay = prices.length > 1 ? prices[1] : null;
    const prevWeek = prices.length >= 8 ? prices[7] : (prices.length > 1 ? prices[prices.length - 1] : null);

    const daklakLatest = latest.price_daklak.toNumber();
    const daklakPrevDay = prevDay ? prevDay.price_daklak.toNumber() : daklakLatest;
    const daklakPrevWeek = prevWeek ? prevWeek.price_daklak.toNumber() : daklakLatest;

    const dodVnd = daklakLatest - daklakPrevDay;
    const dodPct = daklakPrevDay > 0 ? dodVnd / daklakPrevDay : 0;

    const wowVnd = daklakLatest - daklakPrevWeek;
    const wowPct = daklakPrevWeek > 0 ? wowVnd / daklakPrevWeek : 0;

    return {
      date: latest.price_date.toISOString().split('T')[0],
      prices: {
        daklak: daklakLatest,
        lamdong: latest.price_lamdong.toNumber(),
        gialai: latest.price_gialai.toNumber(),
        daknong: latest.price_daknong.toNumber(),
        average: latest.price_avg.toNumber(),
      },
      futures: {
        london_m1: latest.london_m1 ? latest.london_m1.toNumber() : null,
        london_m3: latest.london_m3 ? latest.london_m3.toNumber() : null,
        london_m6: latest.london_m6 ? latest.london_m6.toNumber() : null,
      },
      macro: {
        usd_vnd: latest.usd_vnd ? latest.usd_vnd.toNumber() : null,
        brent_oil: latest.brent_oil ? latest.brent_oil.toNumber() : null,
      },
      changes: {
        dod_pct: Number(dodPct.toFixed(4)),
        dod_vnd: dodVnd,
        wow_pct: Number(wowPct.toFixed(4)),
        wow_vnd: wowVnd,
      },
    };
  }

  /**
   * Returns historical daily market prices sorted chronologically ascending.
   * Supports ?days=30|90|180|365|all or ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: last 90 records).
   */
  @Get('history')
  async getMarketHistory(
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const whereClause: any = {};

    if (from || to) {
      whereClause.price_date = {};
      if (from) whereClause.price_date.gte = new Date(from);
      if (to) whereClause.price_date.lte = new Date(to);
    } else if (days && days.toLowerCase() !== 'all') {
      const numDays = parseInt(days, 10) || 90;
      const latest = await this.prisma.rawMarketPrice.findFirst({
        orderBy: { price_date: 'desc' },
      });
      if (latest) {
        const sinceDate = new Date(latest.price_date);
        sinceDate.setDate(sinceDate.getDate() - numDays);
        whereClause.price_date = { gte: sinceDate };
      }
    } else if (!days) {
      const latest = await this.prisma.rawMarketPrice.findFirst({
        orderBy: { price_date: 'desc' },
      });
      if (latest) {
        const sinceDate = new Date(latest.price_date);
        sinceDate.setDate(sinceDate.getDate() - 90);
        whereClause.price_date = { gte: sinceDate };
      }
    }

    const records = await this.prisma.rawMarketPrice.findMany({
      where: whereClause,
      orderBy: { price_date: 'asc' },
    });

    return records.map((p) => ({
      date: p.price_date.toISOString().split('T')[0],
      price_daklak: p.price_daklak.toNumber(),
      price_lamdong: p.price_lamdong.toNumber(),
      price_gialai: p.price_gialai.toNumber(),
      price_daknong: p.price_daknong.toNumber(),
      price_avg: p.price_avg.toNumber(),
      london_m1: p.london_m1 ? p.london_m1.toNumber() : null,
      london_m3: p.london_m3 ? p.london_m3.toNumber() : null,
      london_m6: p.london_m6 ? p.london_m6.toNumber() : null,
      usd_vnd: p.usd_vnd ? p.usd_vnd.toNumber() : null,
      brent_oil: p.brent_oil ? p.brent_oil.toNumber() : null,
    }));
  }
}
