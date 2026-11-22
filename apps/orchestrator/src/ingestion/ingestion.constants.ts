export const INGESTION_QUEUE_NAME = 'ingestion-queue';

export const INGESTION_JOBS = {
  DAILY_MARKET_DATA: 'INGEST_DAILY_MARKET_DATA',
} as const;

export const INGESTION_CRONS = {
  MORNING_DOMESTIC: '30 8 * * *', // 08:30 Asia/Ho_Chi_Minh
  NIGHT_LONDON_CLOSE: '0 1 * * *', // 01:00 Asia/Ho_Chi_Minh
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
