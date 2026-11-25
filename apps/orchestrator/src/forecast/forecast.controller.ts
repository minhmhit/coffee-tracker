import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ForecastService } from './forecast.service';

@Controller('api/forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  /**
   * Returns the newest successful 26-week forecast with all horizon predictions and metrics.
   */
  @Get('latest')
  async getLatestForecast() {
    const latest = await this.forecastService.getLatestForecast();
    if (!latest) {
      throw new NotFoundException('No successful forecast runs found in database yet');
    }
    return latest;
  }

  /**
   * Returns paginated list of historical forecast runs for the audit trail.
   */
  @Get('runs')
  async getForecastRuns(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = parseInt(limit || '20', 10);
    const skip = parseInt(offset || '0', 10);
    return this.forecastService.getForecastRuns(take, skip);
  }

  /**
   * Returns details and predictions for a specific forecast run by UUID.
   */
  @Get('runs/:runId')
  async getForecastRunById(@Param('runId') runId: string) {
    const run = await this.forecastService.getForecastRunById(runId);
    if (!run) {
      throw new NotFoundException(`Forecast run with ID ${runId} not found`);
    }
    return run;
  }

  /**
   * Endpoint to trigger immediate weekly forecast computation.
   */
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerForecast() {
    const job = await this.forecastService.triggerForecast('api_trigger');
    return {
      success: true,
      message: 'Weekly forecast job successfully enqueued to forecast-queue',
      jobId: job.id,
    };
  }
}

@Controller('api/admin/forecast')
export class AdminForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  /**
   * Manual admin endpoint to trigger immediate weekly forecast computation.
   */
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerForecast() {
    const job = await this.forecastService.triggerForecast('admin_api_trigger');
    return {
      success: true,
      message: 'Weekly forecast job successfully enqueued to forecast-queue',
      jobId: job.id,
    };
  }

  /**
   * Returns the newest successful 26-week forecast with all horizon predictions.
   */
  @Get('latest')
  async getLatestForecast() {
    const latest = await this.forecastService.getLatestForecast();
    if (!latest) {
      return {
        found: false,
        message: 'No successful forecast runs found in database yet',
      };
    }
    return {
      found: true,
      data: latest,
    };
  }
}
