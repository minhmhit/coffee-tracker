import {
  MarketLatestSnapshot,
  MarketHistoryPoint,
  SignalLatest,
  SignalHistoryPoint,
  ForecastLatest,
  ForecastRunsResponse,
  ClimateLatest,
  WeatherTodayResponse,
  RobustaStockLatest,
  MarketInsightsResponse,
  TelegramOnboardingInfo,
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function safeFetch<T>(endpoint: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`API fetch error [${endpoint}]: HTTP ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    console.error(`API network error [${endpoint}]: ${err.message}`);
    return fallback;
  }
}

export async function fetchMarketLatest(): Promise<MarketLatestSnapshot | null> {
  return safeFetch<MarketLatestSnapshot | null>('/api/market/latest', null);
}

export async function fetchMarketHistory(days: string = '90'): Promise<MarketHistoryPoint[]> {
  return safeFetch<MarketHistoryPoint[]>(`/api/market/history?days=${days}`, []);
}

export async function fetchSignalsLatest(): Promise<SignalLatest | null> {
  return safeFetch<SignalLatest | null>('/api/signals/latest', null);
}

export async function fetchSignalsHistory(days: string = '90'): Promise<SignalHistoryPoint[]> {
  return safeFetch<SignalHistoryPoint[]>(`/api/signals/history?days=${days}`, []);
}

export async function fetchForecastLatest(): Promise<ForecastLatest | null> {
  return safeFetch<ForecastLatest | null>('/api/forecast/latest', null);
}

export async function fetchForecastRuns(limit = 20, offset = 0): Promise<ForecastRunsResponse> {
  return safeFetch<ForecastRunsResponse>(`/api/forecast/runs?limit=${limit}&offset=${offset}`, {
    runs: [],
    total: 0,
    limit,
    offset,
  });
}

export async function fetchClimateLatest(): Promise<ClimateLatest | null> {
  return safeFetch<ClimateLatest | null>('/api/climate/latest', null);
}

export async function fetchWeatherToday(): Promise<WeatherTodayResponse | null> {
  return safeFetch<WeatherTodayResponse | null>('/api/weather/today', null);
}

export async function fetchRobustaStockLatest(): Promise<RobustaStockLatest | null> {
  return safeFetch<RobustaStockLatest | null>('/api/stocks/robusta/latest', null);
}

export async function fetchInsightsLatest(): Promise<MarketInsightsResponse | null> {
  return safeFetch<MarketInsightsResponse | null>('/api/insights/latest', null);
}

export async function fetchTelegramInfo(): Promise<TelegramOnboardingInfo | null> {
  return safeFetch<TelegramOnboardingInfo | null>('/api/alerts/telegram-info', null);
}

export async function triggerForecastJob(): Promise<{ success: boolean; message: string; jobId?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/forecast/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
