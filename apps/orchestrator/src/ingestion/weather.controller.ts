import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { DailyWeather } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PROVINCE_ORDER: Record<string, number> = {
  DAKLAK: 1,
  LAMDONG: 2,
  GIALAI: 3,
  DAKNONG: 4,
};

function serializeWeatherRow(w: DailyWeather) {
  return {
    weather_date: w.weather_date.toISOString().split('T')[0],
    province_code: w.province_code,
    province_name: w.province_name,
    temp_current: w.temp_current ? w.temp_current.toNumber() : null,
    temp_min: w.temp_min.toNumber(),
    temp_max: w.temp_max.toNumber(),
    precipitation_mm: w.precipitation_mm.toNumber(),
    rain_probability: w.rain_probability,
    humidity_pct: w.humidity_pct,
    wind_speed_kmh: w.wind_speed_kmh ? w.wind_speed_kmh.toNumber() : null,
    weather_code: w.weather_code,
    condition_vi: w.condition_vi,
    farming_impact_vi: w.farming_impact_vi,
    updated_at: w.updated_at.toISOString(),
  };
}

@Controller('api/weather')
export class WeatherController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the latest day's weather across all 4 Central Highlands provinces,
   * highlighting Đắk Lắk as benchmark.
   */
  @Get('today')
  async getTodayWeather() {
    const latestRow = await this.prisma.dailyWeather.findFirst({
      orderBy: { weather_date: 'desc' },
      select: { weather_date: true },
    });

    if (!latestRow) {
      throw new NotFoundException('No daily weather records found in database');
    }

    const rows = await this.prisma.dailyWeather.findMany({
      where: { weather_date: latestRow.weather_date },
    });

    const provinces = rows
      .sort(
        (a, b) =>
          (PROVINCE_ORDER[a.province_code] ?? 99) - (PROVINCE_ORDER[b.province_code] ?? 99),
      )
      .map(serializeWeatherRow);

    const benchmark =
      provinces.find((p) => p.province_code === 'DAKLAK') || provinces[0] || null;

    return {
      date: latestRow.weather_date.toISOString().split('T')[0],
      benchmark,
      provinces,
    };
  }

  /**
   * Returns historical daily weather sorted chronologically ascending.
   * Supports ?days=7 (default 7) and ?province=DAKLAK|LAMDONG|GIALAI|DAKNONG|ALL.
   */
  @Get('history')
  async getWeatherHistory(
    @Query('days') days?: string,
    @Query('province') province?: string,
  ) {
    const numDays = Math.min(Math.max(parseInt(days || '7', 10) || 7, 1), 365);

    const latestRow = await this.prisma.dailyWeather.findFirst({
      orderBy: { weather_date: 'desc' },
      select: { weather_date: true },
    });

    if (!latestRow) {
      return [];
    }

    const sinceDate = new Date(latestRow.weather_date);
    sinceDate.setDate(sinceDate.getDate() - (numDays - 1));

    const whereClause: any = {
      weather_date: { gte: sinceDate },
    };

    const provUpper = province?.trim().toUpperCase();
    if (provUpper && provUpper !== 'ALL') {
      whereClause.province_code = provUpper;
    }

    const rows = await this.prisma.dailyWeather.findMany({
      where: whereClause,
      orderBy: [{ weather_date: 'asc' }, { province_code: 'asc' }],
    });

    return rows.map(serializeWeatherRow);
  }
}
