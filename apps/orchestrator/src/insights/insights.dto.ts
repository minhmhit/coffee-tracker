export type InsightTrend = 'UP' | 'DOWN' | 'NEUTRAL';

export type InsightFactorKey =
  | 'oil'
  | 'inventory_supply'
  | 'fx'
  | 'weather_climate';

export type MarketStance = 'TÍCH CỰC' | 'TRUNG LẬP' | 'THẬN TRỌNG';

export interface InsightFactorCard {
  key: InsightFactorKey;
  title: string;
  trend: InsightTrend;
  badge_label: string;
  metric_value: string;
  metric_source: string;
  explanation: string;
  impact_on_coffee: string;
  details: Record<string, any>;
}

export interface ForecastMilestoneSummary {
  horizon_label: string;
  horizon_week: number;
  target_date: string;
  pred_p10: number;
  pred_p50: number;
  pred_p90: number;
  baseline_rw: number | null;
  baseline_futures: number | null;
  delta_vs_today_pct: number;
  band_width_pct: number;
}

export interface ForecastTransparencySummary {
  available: boolean;
  run_id: string | null;
  forecast_date: string | null;
  origin_price_daklak: number | null;
  model_version: string | null;
  direction_label: string;
  summary: string;
  confidence_note: string;
  key_drivers: string[];
  milestones: ForecastMilestoneSummary[];
  metrics: {
    wf_mape_4w: number | null;
    wf_mape_12w: number | null;
    wf_mape_26w: number | null;
    pinball_loss: number | null;
    beats_naive_baseline: boolean | null;
  } | null;
}

export interface MarketInsightsResponse {
  generated_at: string;
  as_of_date: string;
  overall_stance: MarketStance;
  executive_summary: string;
  factors: InsightFactorCard[];
  forecast_transparency: ForecastTransparencySummary;
}
