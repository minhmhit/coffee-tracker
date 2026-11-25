import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { AlertProcessor } from '../processors/alert.processor';
import { ALERT_JOBS } from '../../signals/signals.constants';

async function main() {
  console.log('================================================================');
  console.log('   COFFEE TRACKER — TELEGRAM 06:00 AM BRIEFING DISPATCH TEST    ');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const processor = app.get(AlertProcessor);

  console.log('Dispatching 06:00 AM Morning Market Briefing to Telegram channel/bot...');
  const result = await processor.process({
    name: ALERT_JOBS.MORNING_BRIEFING,
    data: { force: true, slot: '0600', trigger: 'cli_manual_dispatch' },
  } as any);

  console.log('\n--- DISPATCH RESULT ---');
  console.log(JSON.stringify(result, null, 2));

  if (result?.success) {
    console.log(`\n✅ Thành công! Điểm tin 6h sáng đã được gửi tới Telegram Bot (Message ID: ${result.messageId}).`);
  } else {
    console.log(`\n❌ Thất bại: ${result?.error || JSON.stringify(result)}`);
  }

  await app.close();
}

main();
