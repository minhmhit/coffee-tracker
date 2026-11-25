import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ForecastService } from './forecast.service';

@Controller('api/admin/forecast')
export class ForecastController {
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
