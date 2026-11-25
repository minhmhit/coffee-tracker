export interface DomesticCoffeePrices {
  daklak: number;
  lamdong: number;
  gialai: number;
  daknong: number;
  average: number;
}

export interface LondonRobustaPrices {
  m1: number;
  m3: number;
  m6: number;
}

export interface ExchangeRateData {
  usdVnd: number;
  source: string;
  publishedAt?: string;
}

export interface BrentOilData {
  price: number;
  currency: string;
  source: string;
}

export interface DailyMarketSnapshot {
  date: string; // YYYY-MM-DD
  domestic: DomesticCoffeePrices;
  london: LondonRobustaPrices;
  exchangeRate: ExchangeRateData;
  brentOil: BrentOilData;
  sourceMeta: Record<string, string>;
}

export interface AdapterResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  latencyMs: number;
}

export type ProvinceWeatherCode = 'DAKLAK' | 'LAMDONG' | 'GIALAI' | 'DAKNONG';

export interface ProvinceWeatherData {
  weatherDate: string; // YYYY-MM-DD
  provinceCode: ProvinceWeatherCode;
  provinceName: string;
  tempCurrent: number | null;
  tempMin: number;
  tempMax: number;
  precipitationMm: number;
  rainProbability: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  weatherCode: number;
  conditionVi: string;
  farmingImpactVi: string;
  rawMeta?: Record<string, any>;
}

export interface IceRobustaStockData {
  reportDate: string; // YYYY-MM-DD
  certifiedLots: number;
  certifiedTonnes: number;
  dodChangeLots?: number | null;
  sourceName: string;
  isStale: boolean;
  rawMeta?: Record<string, any>;
}
