export interface MarketLatestSnapshot {
  date: string;
  prices: {
    daklak: number;
    lamdong: number;
    gialai: number;
    daknong: number;
    average: number;
  };
  futures: {
    london_m1: number | null;
    london_m3: number | null;
    london_m6: number | null;
  };
  macro: {
    usd_vnd: number | null;
    brent_oil: number | null;
  };
  changes: {
    dod_pct: number;
    dod_vnd: number;
    wow_pct: number;
    wow_vnd: number;
  };
}

export interface MarketHistoryPoint {
  date: string;
  price_daklak: number;
  price_lamdong: number;
  price_gialai: number;
  price_daknong: number;
  price_avg: number;
  london_m1: number | null;
  london_m3: number | null;
  london_m6: number | null;
  usd_vnd: number | null;
  brent_oil: number | null;
}

export interface SignalLatest {
  date: string;
  basis_vnd_kg: number;
  calendar_spread: number | null;
  volatility_30d: number | null;
  z_score_30d: number | null;
  is_anomaly: boolean;
  regime: string;
  notes?: string | null;
}

export interface SignalHistoryPoint {
  date: string;
  basis: number;
  spread: number | null;
  volatility_30d: number | null;
  z_score: number | null;
  is_anomaly: boolean;
  regime: string;
}

export interface HorizonPrediction {
  horizon_week: number;
  target_date: string;
  pred_p10: number;
  pred_p50: number;
  pred_p90: number;
  baseline_rw: number | null;
  baseline_futures: number | null;
}

export interface ForecastMetrics {
  wf_mape_4w?: number | null;
  wf_mape_12w?: number | null;
  wf_mape_26w?: number | null;
  pinball_loss?: number | null;
  beats_naive_baseline?: boolean;
}

export interface ForecastLatest {
  run_id: string;
  forecast_date: string;
  origin_price_daklak: number | null;
  status: string;
  model_version: string;
  created_at: string;
  metrics?: ForecastMetrics | null;
  blend_weights?: {
    short?: number;
    mid?: number;
    long?: number;
  } | null;
  predictions: HorizonPrediction[];
}

export interface ForecastRunSummary {
  run_id: string;
  forecast_date: string;
  status: string;
  model_version: string;
  error_message?: string | null;
  metrics?: ForecastMetrics | null;
  predictions_count: number;
  created_at: string;
}

export interface ForecastRunsResponse {
  runs: ForecastRunSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClimateLatest {
  month_date: string;
  oni: number | null;
  rainfall_anomaly_daklak: number | null;
  rainfall_anomaly_linhares: number | null;
}

export interface DailyWeatherItem {
  weather_date: string;
  province_code: string;
  province_name: string;
  temp_current: number | null;
  temp_min: number | null;
  temp_max: number | null;
  precipitation_mm: number | null;
  rain_probability: number | null;
  humidity_pct: number | null;
  wind_speed_kmh: number | null;
  weather_code: number;
  condition_vi: string;
  farming_impact_vi: string;
  updated_at?: string;
}

export interface WeatherTodayResponse {
  date: string | null;
  benchmark: DailyWeatherItem | null;
  provinces: DailyWeatherItem[];
}

export interface RobustaStockLatest {
  report_date: string;
  certified_lots: number;
  certified_tonnes: number;
  dod_change_lots: number | null;
  source_name: string;
  is_stale?: boolean;
  raw_meta?: Record<string, any> | null;
  updated_at?: string;
  change_7d_lots: number | null;
  change_30d_lots: number | null;
}

export type InsightTrend = 'UP' | 'DOWN' | 'NEUTRAL';
export type OverallStance = 'TÍCH CỰC' | 'TRUNG LẬP' | 'THẬN TRỌNG';

export interface InsightFactorCard {
  key: 'oil' | 'inventory_supply' | 'fx' | 'weather_climate' | string;
  title: string;
  trend: InsightTrend;
  badge_label: string;
  metric_value: string;
  metric_source: string;
  explanation: string;
  impact_on_coffee: string;
  details?: Record<string, any> | null;
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
  delta_vs_today_pct: number | null;
  band_width_pct: number | null;
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
  metrics: ForecastMetrics | null;
}

export interface MarketInsightsResponse {
  generated_at: string;
  as_of_date: string | null;
  overall_stance: OverallStance;
  executive_summary: string;
  factors: InsightFactorCard[];
  forecast_transparency: ForecastTransparencySummary;
}

export interface TelegramCommandInfo {
  command: string;
  description: string;
}

export interface TelegramOnboardingInfo {
  botUsername: string;
  deepLink: string;
  briefingSchedule: string;
  cronExpression: string;
  activeSubscribersCount: number;
  telegramConfigured: boolean;
  commands: TelegramCommandInfo[];
  sampleMessagePreview: string;
  sampleMessageHtml?: string;
}
