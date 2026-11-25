import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FORECAST_JOBS, FORECAST_QUEUE_NAME, FORECAST_WORKER_CONFIG } from '../forecast.constants';
import { ForecastService } from '../forecast.service';
import { getBullWorkerOptions, isDirectQueueMode } from '../../common/queue-mode';

@Processor(
  FORECAST_QUEUE_NAME,
  getBullWorkerOptions({ lockDuration: FORECAST_WORKER_CONFIG.lockDuration }),
)
export class ForecastProcessor extends WorkerHost {
  private readonly logger = new Logger(ForecastProcessor.name);

  constructor(private readonly forecastService: ForecastService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(
      `Processing forecast job ${job.id} [${job.name}], trigger: ${job.data?.trigger || 'manual'}, attempt: ${job.attemptsMade + 1}`,
    );

    let forecastDate = new Date();

    try {
      if (isDirectQueueMode() || process.env.ML_WAKE_BEFORE_FORECAST === 'true') {
        await this.forecastService.wakeMlService();
      }

      // 1. Build payload from PostgreSQL
      const payload = await this.forecastService.buildForecastPayload();
      forecastDate = new Date(payload.run_date);

      // 2. Call stateless Python ML service
      const mlResponse = await this.forecastService.callMlService(payload);

      // 3. Atomically persist forecast_runs + 26 forecast_predictions
      const runRecord = await this.forecastService.persistSuccessfulForecast(
        forecastDate,
        mlResponse,
      );

      return {
        success: true,
        runId: runRecord.run_id,
        forecastDate: payload.run_date,
        predictionsCount: mlResponse.predictions.length,
        metrics: mlResponse.metrics,
      };
    } catch (err: any) {
      this.logger.error(`Forecast job failed on attempt ${job.attemptsMade + 1}: ${err.message}`);

      // If all attempts exhausted, persist failed run record and alert
      if (job.attemptsMade + 1 >= (job.opts?.attempts || 2)) {
        await this.forecastService.persistFailedForecast(forecastDate, err.message);
      }

      throw err; // Trigger BullMQ retry
    }
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job, result: any) {
    this.logger.log(`Forecast job ${job.id} completed successfully! Run ID: ${result?.runId}`);
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job, error: Error) {
    this.logger.warn(`Forecast job ${job.id} failed: ${error.message}`);
  }
}
