import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import {
  buildBullConnectionConfig,
  getBullWorkerOptions,
  isDirectQueueMode,
  isWebhookTelegramMode,
} from '../queue-mode';

function createMockExecutionContext(headers: Record<string, any> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('Phase 7 Security Hardening: AdminApiKeyGuard & Queue Mode Helpers', () => {
  let guard: AdminApiKeyGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    guard = new AdminApiKeyGuard();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('AdminApiKeyGuard', () => {
    it('should reject requests when ADMIN_API_KEY is not configured in env', () => {
      delete process.env.ADMIN_API_KEY;
      const ctx = createMockExecutionContext({ 'x-admin-key': 'anything' });

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should reject requests missing X-Admin-Key header', () => {
      process.env.ADMIN_API_KEY = 'super-secret-admin-key';
      const ctx = createMockExecutionContext({});

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should reject requests with wrong X-Admin-Key header (different or same byte length)', () => {
      process.env.ADMIN_API_KEY = 'super-secret-admin-key';

      expect(() =>
        guard.canActivate(createMockExecutionContext({ 'x-admin-key': 'short' })),
      ).toThrow(UnauthorizedException);

      expect(() =>
        guard.canActivate(
          createMockExecutionContext({ 'x-admin-key': 'super-secret-admin-xxx' }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('should allow requests with exact matching X-Admin-Key header', () => {
      process.env.ADMIN_API_KEY = 'super-secret-admin-key';
      const ctx = createMockExecutionContext({ 'x-admin-key': 'super-secret-admin-key' });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should handle array header values safely', () => {
      process.env.ADMIN_API_KEY = 'my-key-123';
      const ctx = createMockExecutionContext({ 'x-admin-key': ['  my-key-123  '] });

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('Cloud Queue & Telegram Mode Helpers', () => {
    it('should default to bullmq polling mode when QUEUE_MODE and TELEGRAM_MODE are unset', () => {
      delete process.env.QUEUE_MODE;
      delete process.env.TELEGRAM_MODE;

      expect(isDirectQueueMode()).toBe(false);
      expect(isWebhookTelegramMode()).toBe(false);
      expect(getBullWorkerOptions()).toEqual({ autorun: true });
    });

    it('should disable BullMQ worker autorun and enable lazy non-polling Redis in QUEUE_MODE=direct', () => {
      process.env.QUEUE_MODE = 'direct';
      process.env.TELEGRAM_MODE = 'webhook';

      expect(isDirectQueueMode()).toBe(true);
      expect(isWebhookTelegramMode()).toBe(true);
      expect(getBullWorkerOptions({ lockDuration: 120000 })).toEqual({
        autorun: false,
        lockDuration: 120000,
      });

      const conn = buildBullConnectionConfig();
      expect(conn.lazyConnect).toBe(true);
      expect(conn.enableOfflineQueue).toBe(false);
      expect(typeof conn.retryStrategy).toBe('function');
      expect(conn.retryStrategy()).toBeNull();
    });

    it('should parse Upstash TLS rediss:// REDIS_URL with Upstash command-saving worker options', () => {
      process.env.QUEUE_MODE = 'bullmq';
      process.env.REDIS_URL = 'rediss://default:upstashpass@neat-frog-12345.upstash.io:6379';

      const conn = buildBullConnectionConfig();
      expect(conn.host).toBe('neat-frog-12345.upstash.io');
      expect(conn.port).toBe(6379);
      expect(conn.username).toBe('default');
      expect(conn.password).toBe('upstashpass');
      expect(conn.tls).toEqual({});

      expect(getBullWorkerOptions()).toEqual({
        autorun: true,
        stalledInterval: 300000,
        drainDelay: 30,
      });
    });
  });
});
