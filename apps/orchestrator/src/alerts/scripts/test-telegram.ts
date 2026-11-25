import * as fs from 'fs';
import * as path from 'path';
import { TelegramService } from '../telegram.service';
import { AlertFormatter } from '../alert-formatter';

// Pure Node.js .env loader without external dependency
function loadEnv(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv(path.resolve(__dirname, '../../../../.env'));
loadEnv(path.resolve(__dirname, '../../../.env'));

async function runTelegramTest() {
  console.log('=== TELEGRAM BOT DISPATCH TEST (STEP 2.2) ===');
  console.log(`TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'CONFIGURED [HIDDEN]' : 'MISSING'}`);
  console.log(`TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID || 'MISSING'}`);

  const telegramService = new TelegramService();

  // 1. Test Morning Briefing Dispatch
  console.log('\n--- 1. Testing Morning Briefing Dispatch ---');
  const morningHtml = AlertFormatter.formatMorningBriefing({
    date: '2026-11-22',
    daklakPrice: 71800,
    dodChangePct: 0.0084, // +0.84%
    londonM1: 4565,
    spreadM1M6: 337,
    usdVndRate: 25600,
    basisVndKg: 5200,
    regime: 'BACKWARDATION_STRONG',
    volatility30d: 0.0185,
    forecastSummary: '<i>Mô hình chuẩn bị dữ liệu (Phase 3)</i>',
  });

  const result1 = await telegramService.sendMessage(morningHtml);
  console.log('Morning Briefing Result:', result1);

  // 2. Test Anomaly Alert Dispatch
  console.log('\n--- 2. Testing Hot Anomaly Alert Dispatch ---');
  const anomalyHtml = AlertFormatter.formatAnomalyAlert({
    signalDate: '2026-11-22',
    daklakPrice: 75000,
    zScore: '2.85',
    basis: '6500',
    spread: '420',
    regime: 'BACKWARDATION_EXTREME',
    notes: 'Biến động mạnh do tồn kho ICE đạt mức thấp lịch sử',
  });

  const result2 = await telegramService.sendMessage(anomalyHtml);
  console.log('Anomaly Alert Result:', result2);

  // 3. Test System Error Dispatch
  console.log('\n--- 3. Testing System Error Dispatch ---');
  const errorHtml = AlertFormatter.formatSystemError({
    queueName: 'ingestion-queue',
    jobId: 'job-test-999',
    jobName: 'daily_market_price_sync',
    attempts: 5,
    maxAttempts: 5,
    errorMessage: 'Test alert: Primary and fallback providers timed out after 5 retries',
  });

  const result3 = await telegramService.sendMessage(errorHtml);
  console.log('System Error Result:', result3);

  console.log('\n=== TELEGRAM TEST FINISHED ===');
}

runTelegramTest().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
