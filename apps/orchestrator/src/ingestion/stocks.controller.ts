import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { IceRobustaStock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function serializeStockRow(s: IceRobustaStock) {
  return {
    report_date: s.report_date.toISOString().split('T')[0],
    certified_lots: s.certified_lots,
    certified_tonnes: s.certified_tonnes.toNumber(),
    dod_change_lots: s.dod_change_lots,
    source_name: s.source_name,
    is_stale: s.is_stale,
    raw_meta: s.raw_meta,
    updated_at: s.updated_at.toISOString(),
  };
}

@Controller('api/stocks')
export class StocksController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the latest ICE Futures Europe Certified Robusta Coffee Stocks record,
   * enriched with 7-day and 30-day lot deltas when history exists.
   */
  @Get('robusta/latest')
  async getLatestRobustaStocks() {
    const recent = await this.prisma.iceRobustaStock.findMany({
      orderBy: { report_date: 'desc' },
      take: 35,
    });

    if (recent.length === 0) {
      throw new NotFoundException('No ICE Certified Robusta stock records found in database');
    }

    const latest = recent[0];
    const latestTs = latest.report_date.getTime();

    const findNearDaysAgo = (days: number): IceRobustaStock | null => {
      const targetMs = latestTs - days * 24 * 60 * 60 * 1000;
      let best: IceRobustaStock | null = null;
      let bestDiff = Infinity;
      for (let i = 1; i < recent.length; i++) {
        const diff = Math.abs(recent[i].report_date.getTime() - targetMs);
        if (diff < bestDiff && recent[i].report_date.getTime() < latestTs) {
          best = recent[i];
          bestDiff = diff;
        }
      }
      return best && bestDiff <= 5 * 24 * 60 * 60 * 1000 ? best : null;
    };

    const stock7d = findNearDaysAgo(7);
    const stock30d = findNearDaysAgo(30);

    return {
      ...serializeStockRow(latest),
      change_7d_lots: stock7d ? latest.certified_lots - stock7d.certified_lots : null,
      change_30d_lots: stock30d ? latest.certified_lots - stock30d.certified_lots : null,
    };
  }

  /**
   * Returns historical ICE Certified Robusta stocks sorted chronologically ascending.
   * Supports ?days=90 (default 90) or ?days=all.
   */
  @Get('robusta/history')
  async getRobustaStocksHistory(@Query('days') days?: string) {
    const whereClause: any = {};

    if (!days || days.toLowerCase() !== 'all') {
      const numDays = Math.min(Math.max(parseInt(days || '90', 10) || 90, 1), 3650);
      const latest = await this.prisma.iceRobustaStock.findFirst({
        orderBy: { report_date: 'desc' },
        select: { report_date: true },
      });
      if (!latest) {
        return [];
      }
      const sinceDate = new Date(latest.report_date);
      sinceDate.setDate(sinceDate.getDate() - numDays);
      whereClause.report_date = { gte: sinceDate };
    }

    const rows = await this.prisma.iceRobustaStock.findMany({
      where: whereClause,
      orderBy: { report_date: 'asc' },
    });

    return rows.map(serializeStockRow);
  }
}
