import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/signals')
export class SignalsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the latest computed daily signal (basis, calendar spread, 30d vol, z-score, regime).
   */
  @Get('latest')
  async getLatestSignal() {
    const latest = await this.prisma.dailySignal.findFirst({
      orderBy: { signal_date: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException('No daily signals found in database');
    }

    return {
      date: latest.signal_date.toISOString().split('T')[0],
      basis_vnd_kg: latest.basis ? latest.basis.toNumber() : 0,
      calendar_spread: latest.spread ? latest.spread.toNumber() : null,
      volatility_30d: latest.volatility_30d ? latest.volatility_30d.toNumber() : null,
      z_score_30d: latest.z_score ? latest.z_score.toNumber() : null,
      is_anomaly: latest.is_anomaly,
      regime: latest.regime,
      notes: latest.notes,
    };
  }

  /**
   * Returns historical daily signals sorted chronologically ascending.
   * Supports ?days=30|90|180|365|all or ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: last 90 records).
   */
  @Get('history')
  async getSignalsHistory(
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const whereClause: any = {};

    if (from || to) {
      whereClause.signal_date = {};
      if (from) whereClause.signal_date.gte = new Date(from);
      if (to) whereClause.signal_date.lte = new Date(to);
    } else if (days && days.toLowerCase() !== 'all') {
      const numDays = parseInt(days, 10) || 90;
      const latest = await this.prisma.dailySignal.findFirst({
        orderBy: { signal_date: 'desc' },
      });
      if (latest) {
        const sinceDate = new Date(latest.signal_date);
        sinceDate.setDate(sinceDate.getDate() - numDays);
        whereClause.signal_date = { gte: sinceDate };
      }
    } else if (!days) {
      const latest = await this.prisma.dailySignal.findFirst({
        orderBy: { signal_date: 'desc' },
      });
      if (latest) {
        const sinceDate = new Date(latest.signal_date);
        sinceDate.setDate(sinceDate.getDate() - 90);
        whereClause.signal_date = { gte: sinceDate };
      }
    }

    const records = await this.prisma.dailySignal.findMany({
      where: whereClause,
      orderBy: { signal_date: 'asc' },
    });

    return records.map((s) => ({
      date: s.signal_date.toISOString().split('T')[0],
      basis: s.basis ? s.basis.toNumber() : 0,
      spread: s.spread ? s.spread.toNumber() : null,
      volatility_30d: s.volatility_30d ? s.volatility_30d.toNumber() : null,
      z_score: s.z_score ? s.z_score.toNumber() : null,
      is_anomaly: s.is_anomaly,
      regime: s.regime,
    }));
  }
}
