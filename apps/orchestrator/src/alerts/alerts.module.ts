import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ALERT_QUEUE_NAME } from '../signals/signals.constants';
import { TelegramService } from './telegram.service';
import { AlertProcessor } from './processors/alert.processor';
import { AlertScheduler } from './schedulers/alert.scheduler';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: ALERT_QUEUE_NAME,
    }),
  ],
  controllers: [AlertsController],
  providers: [TelegramService, AlertProcessor, AlertScheduler],
  exports: [TelegramService, AlertScheduler, BullModule],
})
export class AlertsModule {}
