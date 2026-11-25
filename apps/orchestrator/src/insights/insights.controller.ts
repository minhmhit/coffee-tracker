import { Controller, Get } from '@nestjs/common';
import { InsightsService } from './insights.service';

@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  /**
   * Returns explainable Vietnamese market insights across Oil, ICE Robusta Stocks/Supply,
   * FX, Weather/Climate, and transparent 6-month forecast diagnostics.
   */
  @Get('latest')
  async getLatestInsights() {
    return this.insightsService.getLatestInsights();
  }
}
