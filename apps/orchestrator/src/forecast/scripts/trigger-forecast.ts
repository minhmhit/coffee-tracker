import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ForecastService } from '../forecast.service';
import { PrismaService } from '../../prisma/prisma.service';

async function main() {
  console.log('================================================================');
  console.log('   COFFEE TRACKER — WEEKLY 6-MONTH PROBABILISTIC FORECASTER     ');
  console.log('   Orchestrator Control Plane -> Python ML Service (FastAPI)    ');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const forecastService = app.get(ForecastService);
  const prisma = app.get(PrismaService);

  const startTime = Date.now();

  try {
    console.log('\n[1/3] Extracting historical market prices and monthly macro climate...');
    const payload = await forecastService.buildForecastPayload();
    console.log(`  -> Origin Date (t0):        ${payload.run_date}`);
    console.log(`  -> Market Price Observations: ${payload.market_prices.length} days`);
    console.log(`  -> Climate Observations:      ${payload.macro_climate.length} months`);

    console.log('\n[2/3] Calling Stateless Python ML Service (Two-Legged Walk-Forward Model)...');
    const mlResponse = await forecastService.callMlService(payload);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  -> ML Service Compute Time:   ${durationSec}s`);
    console.log(`  -> Generated Run ID:          ${mlResponse.run_id}`);
    console.log(`  -> Origin Price (Đắk Lắk):    ${mlResponse.origin_price_daklak.toLocaleString('vi-VN')} đ/kg`);

    if (mlResponse.metrics) {
      console.log('\n--- MODEL WALK-FORWARD VALIDATION METRICS ---');
      console.log(`  -> Out-of-Sample WF MAPE 4W:   ${mlResponse.metrics.wf_mape_4w ? (mlResponse.metrics.wf_mape_4w * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`  -> Out-of-Sample WF MAPE 12W:  ${mlResponse.metrics.wf_mape_12w ? (mlResponse.metrics.wf_mape_12w * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`  -> Out-of-Sample WF MAPE 26W:  ${mlResponse.metrics.wf_mape_26w ? (mlResponse.metrics.wf_mape_26w * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`  -> Multi-Quantile Pinball Loss:${mlResponse.metrics.pinball_loss ? mlResponse.metrics.pinball_loss.toFixed(4) : 'N/A'}`);
      console.log(`  -> Beats Naive Random Walk:    ${mlResponse.metrics.beats_naive_baseline ? 'YES (TRUE)' : 'NO'}`);
    }

    console.log('\n[3/3] Atomically persisting to PostgreSQL (forecast_runs + 26 forecast_predictions)...');
    const forecastDate = new Date(payload.run_date);
    const runRecord = await forecastService.persistSuccessfulForecast(forecastDate, mlResponse);
    console.log(`  -> Successfully saved run ${runRecord.run_id} into forecast_runs!`);

    // Verify database records
    const totalRuns = await prisma.forecastRun.count();
    const totalPredictions = await prisma.forecastPrediction.count();
    const savedRun = await prisma.forecastRun.findUnique({
      where: { run_id: runRecord.run_id },
      include: { predictions: { orderBy: { horizon_week: 'asc' } } },
    });

    console.log('\n================================================================');
    console.log('   POSTGRESQL AUDIT VERIFICATION                                ');
    console.log('================================================================');
    console.log(`Total Forecast Runs in DB:        ${totalRuns}`);
    console.log(`Total Forecast Predictions in DB: ${totalPredictions}`);
    console.log(`Saved Run ID:                     ${savedRun?.run_id}`);
    console.log(`Status:                           ${savedRun?.status}`);
    console.log(`Predictions Stored for this Run:  ${savedRun?.predictions.length} / 26 weeks`);

    console.log('\n--- KEY HORIZONS PREVIEW ---');
    const keyWeeks = [1, 2, 4, 8, 12, 16, 20, 26];
    console.log('Week | Target Date | Pred P10    | Pred P50 (Med) | Pred P90    | Baseline RW | Baseline Futures');
    console.log('-----+-------------+-------------+----------------+-------------+-------------+-----------------');
    for (const p of savedRun?.predictions || []) {
      if (keyWeeks.includes(p.horizon_week)) {
        const wStr = String(p.horizon_week).padStart(4, ' ');
        const tDate = p.target_date.toISOString().split('T')[0];
        const p10 = Math.round(p.pred_p10.toNumber()).toLocaleString('vi-VN').padStart(11, ' ');
        const p50 = Math.round(p.pred_p50.toNumber()).toLocaleString('vi-VN').padStart(14, ' ');
        const p90 = Math.round(p.pred_p90.toNumber()).toLocaleString('vi-VN').padStart(11, ' ');
        const rw = p.baseline_rw ? Math.round(p.baseline_rw.toNumber()).toLocaleString('vi-VN').padStart(11, ' ') : '        N/A';
        const fut = p.baseline_futures ? Math.round(p.baseline_futures.toNumber()).toLocaleString('vi-VN').padStart(15, ' ') : '            N/A';
        console.log(`${wStr} | ${tDate}  | ${p10} | ${p50} | ${p90} | ${rw} | ${fut}`);
      }
    }
    console.log('================================================================\n');

  } catch (error: any) {
    console.error('Forecast execution failed:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
