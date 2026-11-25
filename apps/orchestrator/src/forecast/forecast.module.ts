import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FORECAST_QUEUE_NAME, FORECAST_WORKER_CONFIG } from './forecast.constants';
import { ForecastService } from './forecast.service';
import { ForecastProcessor } from './processors/forecast.processor';
import { ForecastScheduler } from './schedulers/forecast.scheduler';
import { ForecastController, AdminForecastController } from './forecast.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    PrismaModule,
    AlertsModule,
    BullModule.registerQueue({
      name: FORECAST_QUEUE_NAME,
      defaultJobOptions: {
        attempts: FORECAST_WORKER_CONFIG.attempts,
        backoff: FORECAST_WORKER_CONFIG.backoff,
      },
    }),
  ],
  controllers: [ForecastController, AdminForecastController],
  providers: [ForecastService, ForecastProcessor, ForecastScheduler],
  exports: [ForecastService, ForecastScheduler, BullModule],
})
export class ForecastModule {}
