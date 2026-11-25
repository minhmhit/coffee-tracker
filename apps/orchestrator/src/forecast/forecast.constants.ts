export const FORECAST_QUEUE_NAME = 'forecast-queue';

export const FORECAST_JOBS = {
  GENERATE_WEEKLY_FORECAST: 'generate_weekly_forecast',
};

export const FORECAST_CRONS = {
  WEEKLY_MONDAY: '0 2 * * 1', // 02:00 AM Asia/Ho_Chi_Minh every Monday
  TIMEZONE: 'Asia/Ho_Chi_Minh',
};

export const FORECAST_WORKER_CONFIG = {
  lockDuration: 300000, // 5 minutes to prevent false stalls during ML training
  attempts: 2,
  backoff: {
    type: 'fixed',
    delay: 60000, // 1 minute
  },
  timeoutMs: 180000, // 3 minutes HTTP timeout
};
