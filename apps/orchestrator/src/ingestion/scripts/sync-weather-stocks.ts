import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from '../ingestion.service';

async function main() {
  console.log('================================================================');
  console.log('   COFFEE TRACKER — LIVE WEATHER & ICE ROBUSTA STOCKS SYNC      ');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ingestionService = app.get(IngestionService);

  console.log('\n[1/2] Syncing Central Highlands Live Daily Weather (4 provinces)...');
  const weatherRes = await ingestionService.syncDailyWeather();
  console.log('Weather Result:', JSON.stringify(weatherRes, null, 2));

  console.log('\n[2/2] Syncing ICE Futures Europe Certified Robusta Coffee Stocks...');
  const stockRes = await ingestionService.syncIceRobustaStocks();
  console.log('ICE Stocks Result:', JSON.stringify(stockRes, null, 2));

  await app.close();
}

main();
