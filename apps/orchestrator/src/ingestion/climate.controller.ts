import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/climate')
export class ClimateController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the most recent monthly macro climate snapshot (NOAA ONI, Đắk Lắk & Linhares rainfall anomalies).
   */
  @Get('latest')
  async getLatestClimate() {
    const latest = await this.prisma.macroClimateMonthly.findFirst({
      orderBy: { month_date: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException('No climate records found in database');
    }

    return {
      month_date: latest.month_date.toISOString().split('T')[0],
      oni: latest.oni_index ? latest.oni_index.toNumber() : null,
      rainfall_anomaly_daklak: latest.vn_rain_anomaly ? latest.vn_rain_anomaly.toNumber() : null,
      rainfall_anomaly_linhares: latest.br_rain_anomaly ? latest.br_rain_anomaly.toNumber() : null,
    };
  }

  /**
   * Returns historical monthly climate data sorted chronologically ascending.
   * Supports ?limit=36 (default: last 36 months).
   */
  @Get('history')
  async getClimateHistory(@Query('limit') limit?: string) {
    const take = parseInt(limit || '36', 10);
    const records = await this.prisma.macroClimateMonthly.findMany({
      orderBy: { month_date: 'desc' },
      take,
    });

    return records
      .reverse()
      .map((c) => ({
        month_date: c.month_date.toISOString().split('T')[0],
        oni: c.oni_index ? c.oni_index.toNumber() : null,
        rainfall_anomaly_daklak: c.vn_rain_anomaly ? c.vn_rain_anomaly.toNumber() : null,
        rainfall_anomaly_linhares: c.br_rain_anomaly ? c.br_rain_anomaly.toNumber() : null,
      }));
  }
}
