import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { SignalsModule } from './signals/signals.module';
import { AlertsModule } from './alerts/alerts.module';
import { ForecastModule } from './forecast/forecast.module';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    HealthModule,
    PrismaModule,
    IngestionModule,
    SignalsModule,
    AlertsModule,
    ForecastModule,
    InsightsModule,
  ],
})
export class AppModule {}
