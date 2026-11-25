export const INGESTION_QUEUE_NAME = 'ingestion-queue';

export const INGESTION_JOBS = {
  DAILY_MARKET_DATA: 'INGEST_DAILY_MARKET_DATA',
  MONTHLY_CLIMATE: 'INGEST_MONTHLY_CLIMATE',
  DAILY_WEATHER: 'INGEST_DAILY_WEATHER',
  DAILY_ICE_STOCKS: 'INGEST_DAILY_ICE_STOCKS',
} as const;

export const INGESTION_CRONS = {
  EARLY_WEATHER: '45 5 * * *', // 05:45 Asia/Ho_Chi_Minh (before 06:00 Telegram briefing)
  MORNING_DOMESTIC: '30 8 * * *', // 08:30 Asia/Ho_Chi_Minh
  NIGHT_LONDON_CLOSE: '0 1 * * *', // 01:00 Asia/Ho_Chi_Minh
  MONTHLY_CLIMATE: '0 3 5 * *', // 03:00 Asia/Ho_Chi_Minh on the 5th of every month
  TIMEZONE: 'Asia/Ho_Chi_Minh',
} as const;

export const INGESTION_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 10000, // 10s initial delay
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};
