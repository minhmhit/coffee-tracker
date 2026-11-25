import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ALERT_QUEUE_NAME } from '../signals/signals.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { InsightsModule } from '../insights/insights.module';
import { TelegramService } from './telegram.service';
import { MorningBriefingService } from './morning-briefing.service';
import { TelegramBotService } from './telegram-bot.service';
import { AlertProcessor } from './processors/alert.processor';
import { AlertScheduler } from './schedulers/alert.scheduler';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [
    PrismaModule,
    InsightsModule,
    BullModule.registerQueue({
      name: ALERT_QUEUE_NAME,
    }),
  ],
  controllers: [AlertsController],
  providers: [
    TelegramService,
    MorningBriefingService,
    TelegramBotService,
    AlertProcessor,
    AlertScheduler,
  ],
  exports: [
    TelegramService,
    MorningBriefingService,
    TelegramBotService,
    AlertScheduler,
    BullModule,
  ],
})
export class AlertsModule {}
