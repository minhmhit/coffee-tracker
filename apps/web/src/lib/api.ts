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

const isServer = typeof window === 'undefined';

const API_BASE = isServer
  ? process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function safeFetch<T>(endpoint: string, fallback: T): Promise<T> {
  try {
    const fetchOptions: RequestInit & { next?: { revalidate?: number } } = isServer
      ? {
          next: { revalidate: 300 },
          signal: AbortSignal.timeout(3500),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      : {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        };

    const res = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
    if (!res.ok) {
      console.warn(`API fetch error [${endpoint}]: HTTP ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    console.warn(`API network error [${endpoint}]: ${err.message}`);
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

export async function triggerForecastJob(
  adminKey?: string,
): Promise<{ success: boolean; status?: number; message: string; jobId?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminKey?.trim()) {
      headers['X-Admin-Key'] = adminKey.trim();
    }

    const res = await fetch(`${API_BASE}/api/forecast/trigger`, {
      method: 'POST',
      headers,
    });

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        status: res.status,
        message: 'Cần nhập mã X-Admin-Key hợp lệ để kích hoạt dự báo.',
      };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data?.message || `HTTP ${res.status}`,
      };
    }
    return data;
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
