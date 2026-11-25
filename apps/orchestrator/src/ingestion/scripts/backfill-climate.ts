import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from '../ingestion.service';
import { PrismaService } from '../../prisma/prisma.service';

async function main() {
  console.log('================================================================');
  console.log('   COFFEE TRACKER — MACRO & CLIMATE MONTHLY BACKFILL (2018-2026)');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ingestionService = app.get(IngestionService);
  const prisma = app.get(PrismaService);

  const startTime = Date.now();
  console.log('Synchronizing NOAA ONI and Open-Meteo Rainfall Anomalies (2018–present)...');

  const syncResult = await ingestionService.syncMacroClimateMonthly(2018);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nSynchronization completed in ${durationSec}s!`);
  console.log(`Total Months Processed: ${syncResult.syncedCount}`);
  console.log(`Date Range:            ${syncResult.earliestDate} to ${syncResult.latestDate}`);
  console.log(`Latest ONI Index:       ${syncResult.latestOni ?? 'N/A'}`);

  // Database verification aggregate
  const count = await prisma.macroClimateMonthly.count();
  const summary = await prisma.macroClimateMonthly.aggregate({
    _min: { month_date: true, oni_index: true, vn_rain_anomaly: true, br_rain_anomaly: true },
    _max: { month_date: true, oni_index: true, vn_rain_anomaly: true, br_rain_anomaly: true },
    _avg: { oni_index: true, vn_rain_anomaly: true, br_rain_anomaly: true },
  });

  console.log('\n--- POSTGRESQL VERIFICATION SUMMARY ---');
  console.log(`Total DB Records:       ${count}`);
  console.log(`Earliest Month Date:    ${summary._min.month_date?.toISOString().split('T')[0]}`);
  console.log(`Latest Month Date:      ${summary._max.month_date?.toISOString().split('T')[0]}`);
  console.log(`ONI Index (Min / Max):  ${summary._min.oni_index} / ${summary._max.oni_index} (Avg: ${summary._avg.oni_index?.toFixed(2)})`);
  console.log(`VN Rain Anomaly (mm):   ${summary._min.vn_rain_anomaly} / ${summary._max.vn_rain_anomaly} (Avg: ${summary._avg.vn_rain_anomaly?.toFixed(2)})`);
  console.log(`BR Rain Anomaly (mm):   ${summary._min.br_rain_anomaly} / ${summary._max.br_rain_anomaly} (Avg: ${summary._avg.br_rain_anomaly?.toFixed(2)})`);
  console.log('================================================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('Fatal Climate Backfill Error:', err);
  process.exit(1);
});
