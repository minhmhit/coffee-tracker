import { WorkerOptions } from 'bullmq';

/**
 * Returns true when running without 24/7 Redis worker polling (Cloud Free-Tier mode).
 */
export function isDirectQueueMode(): boolean {
  return process.env.QUEUE_MODE?.trim().toLowerCase() === 'direct';
}

/**
 * Returns true when Telegram updates should arrive via HTTP webhook rather than getUpdates polling.
 */
export function isWebhookTelegramMode(): boolean {
  return process.env.TELEGRAM_MODE?.trim().toLowerCase() === 'webhook';
}

/**
 * Configures BullMQ worker options to conserve Upstash Redis commands and disable
 * polling cleanly in direct execution mode.
 */
export function getBullWorkerOptions(
  extra: Partial<WorkerOptions> = {},
): Partial<WorkerOptions> {
  const direct = isDirectQueueMode();
  const hasCloudRedis = Boolean(process.env.REDIS_URL);

  return {
    autorun: !direct,
    ...(hasCloudRedis ? { stalledInterval: 300000, drainDelay: 30 } : {}),
    ...extra,
  };
}

/**
 * Builds ioredis/BullMQ connection options supporting TLS `rediss://` URLs (Upstash)
 * as well as zero-polling lazy connections when QUEUE_MODE=direct.
 */
export function buildBullConnectionConfig(): Record<string, any> {
  const direct = isDirectQueueMode();
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
      ...(direct
        ? { lazyConnect: true, enableOfflineQueue: false, retryStrategy: () => null }
        : {}),
    };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...(direct
      ? { lazyConnect: true, enableOfflineQueue: false, retryStrategy: () => null }
      : {}),
  };
}
