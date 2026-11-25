import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SignalsService } from '../signals.service';
import { PrismaService } from '../../prisma/prisma.service';

async function main() {
  console.log('================================================================');
  console.log('   COFFEE TRACKER — HISTORICAL DAILY SIGNALS BACKFILL (2018-2026)');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const signalsService = app.get(SignalsService);
  const prisma = app.get(PrismaService);

  const startTime = Date.now();
  console.log('Calculating Basis, Spread, 30d Volatility, Z-Score and Regimes for all historical days...');

  const result = await signalsService.backfillAllSignals();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nBackfill completed successfully in ${durationSec}s!`);
  console.log(`Total Days Processed:  ${result.processedCount}`);
  console.log(`Total Anomalies (|z|>2.5): ${result.anomalyCount}`);

  // Database verification
  const totalSignals = await prisma.dailySignal.count();
  const summary = await prisma.dailySignal.aggregate({
    _min: { signal_date: true, basis: true, volatility_30d: true, z_score: true },
    _max: { signal_date: true, basis: true, volatility_30d: true, z_score: true },
    _avg: { basis: true, volatility_30d: true, z_score: true },
  });

  const regimeBreakdown = await prisma.dailySignal.groupBy({
    by: ['regime'],
    _count: { signal_date: true },
  });

  console.log('\n--- POSTGRESQL VERIFICATION SUMMARY ---');
  console.log(`Total Records in daily_signals: ${totalSignals}`);
  console.log(`Earliest Signal Date:           ${summary._min.signal_date?.toISOString().split('T')[0]}`);
  console.log(`Latest Signal Date:             ${summary._max.signal_date?.toISOString().split('T')[0]}`);
  console.log(`Basis Min / Max (đ/kg):         ${summary._min.basis} / ${summary._max.basis} (Avg: ${summary._avg.basis?.toFixed(0)} đ)`);
  console.log(`30d Volatility Min / Max:       ${summary._min.volatility_30d} / ${summary._max.volatility_30d} (Avg: ${summary._avg.volatility_30d?.toFixed(4)})`);
  console.log(`Z-Score Min / Max:              ${summary._min.z_score} / ${summary._max.z_score}`);

  console.log('\n--- REGIME CLASSIFICATION BREAKDOWN ---');
  for (const r of regimeBreakdown) {
    console.log(`  - ${r.regime ?? 'UNKNOWN'}: ${r._count.signal_date} days`);
  }
  console.log('================================================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('Fatal Signals Backfill Error:', err);
  process.exit(1);
});
