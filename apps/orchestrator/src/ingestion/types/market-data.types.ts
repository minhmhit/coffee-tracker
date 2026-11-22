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
