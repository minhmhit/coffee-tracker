import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  ALERT_JOBS,
  ALERT_QUEUE_NAME,
  SIGNALS_JOBS,
  SIGNALS_QUEUE_NAME,
} from '../signals.constants';
import { SignalsService } from '../signals.service';
import { getBullWorkerOptions } from '../../common/queue-mode';

export interface ComputeSignalsJobPayload {
  targetDate: string; // YYYY-MM-DD
  trigger?: string;
}

@Processor(SIGNALS_QUEUE_NAME, getBullWorkerOptions())
export class SignalsProcessor extends WorkerHost {
  private readonly logger = new Logger(SignalsProcessor.name);

  constructor(
    private readonly signalsService: SignalsService,
    @InjectQueue(ALERT_QUEUE_NAME)
    private readonly alertQueue: Queue,
  ) {
    super();
  }

  /**
   * Worker handler triggered when a daily market price ingestion finishes,
   * or manually invoked.
   */
  async process(job: Job<ComputeSignalsJobPayload, any, string>): Promise<any> {
    const targetDate = job.data?.targetDate || new Date().toISOString().split('T')[0];
    this.logger.log(
      `Processing signals computation for date: ${targetDate} (job: ${job.id}, trigger: ${job.data?.trigger || 'auto'})`,
    );

    const signalRecord = await this.signalsService.computeSignalsForDate(targetDate);

    // If an abnormal shock day is detected (|z| > 2.5), trigger instant Anomaly Alert
    if (signalRecord.is_anomaly) {
      this.logger.warn(
        `[ANOMALY DETECTED] Date: ${targetDate}, Z-Score: ${signalRecord.z_score}. Enqueueing high-priority ANOMALY_ALERT to alert-queue...`,
      );

      await this.alertQueue.add(
        ALERT_JOBS.ANOMALY_ALERT,
        {
          signalDate: targetDate,
          zScore: signalRecord.z_score ? signalRecord.z_score.toString() : '0',
          basis: signalRecord.basis.toString(),
          spread: signalRecord.spread ? signalRecord.spread.toString() : null,
          regime: signalRecord.regime,
          notes: signalRecord.notes,
        },
        {
          priority: 1, // High priority
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    return {
      success: true,
      signalDate: targetDate,
      isAnomaly: signalRecord.is_anomaly,
      regime: signalRecord.regime,
      basis: signalRecord.basis.toString(),
      spread: signalRecord.spread ? signalRecord.spread.toString() : null,
    };
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job<ComputeSignalsJobPayload>, error: Error) {
    this.logger.error(
      `Signals job ${job.id} failed attempt ${job.attemptsMade}/${job.opts.attempts || 3}: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job<ComputeSignalsJobPayload>, result: any) {
    this.logger.log(
      `Signals job ${job.id} completed successfully for date: ${result?.signalDate} (Anomaly: ${result?.isAnomaly}, Regime: ${result?.regime})`,
    );
  }
}
