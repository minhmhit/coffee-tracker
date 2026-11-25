import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestionService } from '../ingestion.service';

async function run() {
  console.log('================================================================');
  console.log('   COFFEE TRACKER — LIVE MARKET DATA INGESTION DRY-RUN (CLI)   ');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ingestionService = app.get(IngestionService);
  const result = await ingestionService.fetchDailySnapshot();

  console.log('\n----------------------------------------------------------------');
  console.log('   PARSED DAILY MARKET SNAPSHOT');
  console.log('----------------------------------------------------------------');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n----------------------------------------------------------------');
  console.log(`   VALIDATION STATUS: ${result.sanityResult.valid ? 'PASSED (VALID)' : 'FAILED (CORRUPT)'}`);
  if (result.errors.length > 0) {
    console.log(`   FETCH ERRORS: ${result.errors.join(' | ')}`);
  }

  if (result.sanityResult.valid && result.snapshot) {
    console.log('\n----------------------------------------------------------------');
    console.log('   APPLYING IDEMPOTENT UPSERT TO POSTGRESQL...');
    console.log('----------------------------------------------------------------');
    const record = await ingestionService.upsertDailySnapshot(result.snapshot);
    console.log(`   Record persisted! ID: ${record.id}, Date: ${record.price_date.toISOString().split('T')[0]}, Đắk Lắk: ${record.price_daklak} VND/kg`);
  }

  console.log('================================================================\n');

  await app.close();
}

run().catch((err) => {
  console.error('Fatal Dry-Run Error:', err);
  process.exit(1);
});
