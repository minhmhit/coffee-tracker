import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { SignalsModule } from './signals/signals.module';
import { AlertsModule } from './alerts/alerts.module';
import { ForecastModule } from './forecast/forecast.module';
import { InsightsModule } from './insights/insights.module';
import { buildBullConnectionConfig } from './common/queue-mode';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    BullModule.forRoot({
      connection: buildBullConnectionConfig(),
    }),
    HealthModule,
    PrismaModule,
    IngestionModule,
    SignalsModule,
    AlertsModule,
    ForecastModule,
    InsightsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
