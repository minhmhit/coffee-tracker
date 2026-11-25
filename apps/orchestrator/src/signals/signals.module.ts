import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SignalsService } from './signals.service';
import { SignalsProcessor } from './processors/signals.processor';
import { SignalsController } from './signals.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ALERT_QUEUE_NAME, SIGNALS_QUEUE_NAME } from './signals.constants';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      {
        name: SIGNALS_QUEUE_NAME,
      },
      {
        name: ALERT_QUEUE_NAME,
      },
    ),
  ],
  controllers: [SignalsController],
  providers: [SignalsService, SignalsProcessor],
  exports: [SignalsService, BullModule],
})
export class SignalsModule {}
