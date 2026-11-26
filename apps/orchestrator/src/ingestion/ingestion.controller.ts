import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { isDirectQueueMode } from '../common/queue-mode';
import { IngestionProcessor } from './processors/ingestion.processor';
import { IngestionScheduler } from './schedulers/ingestion.scheduler';

const ALLOWED_SYNC_JOBS = new Set([
  'weather',
  'early_weather',
  'daily_weather',
  'morning_domestic',
  'night_london',
  'monthly_climate',
  'daily_ice_stocks',
  'ice_stocks',
  'daily',
]);

@Controller('api/ingestion')
export class IngestionController {
  constructor(
    private readonly ingestionProcessor: IngestionProcessor,
    private readonly ingestionScheduler: IngestionScheduler,
  ) {}

  /**
   * Unified admin-guarded ingestion sync endpoint for GitHub Actions cron triggers
   * or manual cloud recovery without keeping 24/7 Redis BullMQ workers running.
   * Example: POST /api/ingestion/sync?job=weather
   */
  @Post('sync')
  @UseGuards(AdminApiKeyGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async syncIngestion(
    @Query('job') jobQuery?: string,
    @Query('targetDate') targetDateQuery?: string,
    @Body() body?: { job?: string; targetDate?: string },
  ) {
    const rawJob = (jobQuery || body?.job || 'morning_domestic').trim().toLowerCase();
    if (!ALLOWED_SYNC_JOBS.has(rawJob)) {
      throw new BadRequestException(
        `Unsupported ingestion job '${rawJob}'. Allowed: ${Array.from(ALLOWED_SYNC_JOBS).join(', ')}`,
      );
    }

    const resolvedTargetDate = targetDateQuery || body?.targetDate;

    if (isDirectQueueMode()) {
      const result = await this.ingestionProcessor.executeSync(
        rawJob,
        `http_sync_${rawJob}`,
        resolvedTargetDate,
      );
      return {
        success: true,
        mode: 'direct',
        job: rawJob,
        result,
      };
    }

    const queuedJob = await this.ingestionScheduler.enqueueJobByType(
      rawJob,
      resolvedTargetDate,
    );
    return {
      success: true,
      mode: 'bullmq',
      job: rawJob,
      jobId: queuedJob.id,
    };
  }
}
