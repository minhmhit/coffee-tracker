import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DomesticCoffeeAdapter } from './adapters/domestic-coffee.adapter';
import { LondonRobustaAdapter } from './adapters/london-robusta.adapter';
import { ExchangeRateAdapter } from './adapters/exchange-rate.adapter';
import { BrentOilAdapter } from './adapters/brent-oil.adapter';
import { NoaaOniAdapter } from './adapters/noaa-oni.adapter';
import { OpenMeteoAdapter } from './adapters/open-meteo.adapter';
import { PriceSanityValidator } from './validators/price-sanity.validator';
import { IngestionService } from './ingestion.service';
import { IngestionProcessor } from './processors/ingestion.processor';
import { IngestionScheduler } from './schedulers/ingestion.scheduler';
import { INGESTION_QUEUE_NAME } from './ingestion.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: INGESTION_QUEUE_NAME,
    }),
  ],
  providers: [
    DomesticCoffeeAdapter,
    LondonRobustaAdapter,
    ExchangeRateAdapter,
    BrentOilAdapter,
    NoaaOniAdapter,
    OpenMeteoAdapter,
    PriceSanityValidator,
    IngestionService,
    IngestionProcessor,
    IngestionScheduler,
  ],
  exports: [
    IngestionService,
    IngestionScheduler,
    PriceSanityValidator,
    NoaaOniAdapter,
    OpenMeteoAdapter,
    BullModule,
  ],
})
export class IngestionModule {}
