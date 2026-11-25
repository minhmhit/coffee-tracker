import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { AlertFormatter } from '../alert-formatter';
import { TelegramService } from '../telegram.service';
import { AlertProcessor } from '../processors/alert.processor';
import { AlertScheduler, ALERT_CRONS } from '../schedulers/alert.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../../signals/signals.constants';

describe('Alerts Module Suite (Step 2.2)', () => {
  describe('1. AlertFormatter (HTML Templates)', () => {
    it('should format morning briefing with correct HTML tags, positive DoD change, and icons', () => {
      const html = AlertFormatter.formatMorningBriefing({
        date: '2026-11-22',
        daklakPrice: 71800,
        dodChangePct: 0.0084, // +0.84%
        londonM1: 4565,
        spreadM1M6: 337,
        usdVndRate: 25600,
        basisVndKg: 5200,
        regime: 'BACKWARDATION_STRONG',
        volatility30d: 0.0185,
        forecastSummary: '<i>Xu hướng ổn định tăng nhẹ</i>',
      });

      expect(html).toContain('<b>BẢN TIN THỊ TRƯỜNG CÀ PHÊ SÁNG — 2026-11-22</b>');
      expect(html).toContain('<code>71.800 đ/kg</code>');
      expect(html).toContain('🟢 +0.84%');
      expect(html).toContain('$4,565');
      expect(html).toContain('+337 USD/tấn');
      expect(html).toContain('25.600 đ');
      expect(html).toContain('+5.200 đ/kg');
      expect(html).toContain('<b>BACKWARDATION_STRONG</b>');
      expect(html).toContain('1.85%/ngày');
      expect(html).toContain('Xu hướng ổn định tăng nhẹ');
    });

    it('should format morning briefing with negative DoD change and fallback values when spread/london null', () => {
      const html = AlertFormatter.formatMorningBriefing({
        date: '2026-11-21',
        daklakPrice: 71000,
        dodChangePct: -0.0125, // -1.25%
        londonM1: null,
        spreadM1M6: null,
        usdVndRate: null,
        basisVndKg: -1500,
        regime: 'NORMAL',
        volatility30d: null,
      });

      expect(html).toContain('🔴 -1.25%');
      expect(html).toContain('M1: <code>N/A</code>');
      expect(html).toContain('Spread (M1-M6): <code>N/A</code>');
      expect(html).toContain('Tỷ giá Vietcombank:</b> <code>N/A</code>');
      expect(html).toContain('-1.500 đ/kg');
      expect(html).toContain('Biến động 30N: <code>N/A</code>');
    });

    it('should format hot anomaly alert with direction and Z-Score details', () => {
      const htmlPositive = AlertFormatter.formatAnomalyAlert({
        signalDate: '2026-11-22',
        daklakPrice: 75000,
        zScore: '2.85',
        basis: '6500',
        spread: '420',
        regime: 'BACKWARDATION_EXTREME',
        notes: 'Giá London tăng sốc do tồn kho cạn kiệt',
      });

      expect(htmlPositive).toContain('<b>CẢNH BÁO BIẾN ĐỘNG BẤT THƯỜNG — TĂNG ĐỘT BIẾN</b>');
      expect(htmlPositive).toContain('2.85');
      expect(htmlPositive).toContain('75.000 đ/kg');
      expect(htmlPositive).toContain('6500 đ/kg');
      expect(htmlPositive).toContain('420 USD/t');
      expect(htmlPositive).toContain('Giá London tăng sốc do tồn kho cạn kiệt');

      const htmlNegative = AlertFormatter.formatAnomalyAlert({
        signalDate: '2026-11-20',
        zScore: -2.92,
        basis: -3200,
        spread: null,
        regime: 'CONTANGO_STRONG',
      });

      expect(htmlNegative).toContain('<b>CẢNH BÁO BIẾN ĐỘNG BẤT THƯỜNG — GIẢM ĐỘT BIẾN</b>');
      expect(htmlNegative).toContain('-2.92');
      expect(htmlNegative).toContain('Spread:</b> <code>N/A</code>');
    });

    it('should format system failure alert with error excerpt and retry count', () => {
      const html = AlertFormatter.formatSystemError({
        queueName: 'ingestion-queue',
        jobId: 'job-market-101',
        jobName: 'daily_market_price_sync',
        attempts: 5,
        maxAttempts: 5,
        errorMessage: 'Connection refused at giacaphe.com after 5 attempts',
      });

      expect(html).toContain('<b>CẢNH BÁO SỰ CỐ HỆ THỐNG (SYSTEM FAILURE)</b>');
      expect(html).toContain('<code>ingestion-queue</code>');
      expect(html).toContain('<code>daily_market_price_sync</code> (ID: job-market-101)');
      expect(html).toContain('<code>5/5</code>');
      expect(html).toContain('<pre>Connection refused at giacaphe.com after 5 attempts</pre>');
    });
  });

  describe('2. TelegramService', () => {
    let service: TelegramService;
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      service = new TelegramService();
    });

    afterEach(() => {
      process.env = originalEnv;
      jest.restoreAllMocks();
    });

    it('should return simulated failure if TELEGRAM_BOT_TOKEN is missing or placeholder', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      const result = await service.sendMessage('<b>Test message</b>');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Telegram credentials missing');
    });

    it('should successfully post message via fetch when configured', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.TELEGRAM_CHAT_ID = '987654321';

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 8899,
            date: 1700000000,
            chat: { id: 987654321 },
            text: 'Hello Telegram',
          },
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse as any);

      const result = await service.sendMessage('<b>Hello Telegram</b>');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(8899);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            chat_id: '987654321',
            text: '<b>Hello Telegram</b>',
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        }),
      );
    });

    it('should handle Telegram API error responses gracefully', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:ABC';
      process.env.TELEGRAM_CHAT_ID = '987654321';

      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error_code: 400,
          description: 'Bad Request: can\'t parse entities: Unsupported start tag',
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse as any);

      const result = await service.sendMessage('<invalid>test</invalid>');

      expect(result.success).toBe(false);
      expect(result.error).toContain("Bad Request: can't parse entities");
    });
  });

  describe('3. AlertProcessor & Deduplication', () => {
    let processor: AlertProcessor;
    let telegramService: jest.Mocked<Partial<TelegramService>>;
    let prismaService: jest.Mocked<any>;

    beforeEach(async () => {
      telegramService = {
        sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 101 }),
      };

      prismaService = {
        rawMarketPrice: {
          findMany: jest.fn(),
        },
        dailySignal: {
          findUnique: jest.fn(),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AlertProcessor,
          {
            provide: TelegramService,
            useValue: telegramService,
          },
          {
            provide: PrismaService,
            useValue: prismaService,
          },
        ],
      }).compile();

      processor = module.get<AlertProcessor>(AlertProcessor);
    });

    it('should process Morning Briefing, query Prisma for 2 latest prices, and deduplicate repeat calls', async () => {
      const mockPrices = [
        {
          price_date: new Date('2026-11-22T00:00:00.000Z'),
          price_daklak: new Prisma.Decimal(71800),
          london_m1: new Prisma.Decimal(4565),
          london_m6: new Prisma.Decimal(4228),
          usd_vnd: new Prisma.Decimal(25600),
        },
        {
          price_date: new Date('2026-11-21T00:00:00.000Z'),
          price_daklak: new Prisma.Decimal(71200),
          london_m1: new Prisma.Decimal(4520),
          london_m6: new Prisma.Decimal(4200),
          usd_vnd: new Prisma.Decimal(25580),
        },
      ];

      const mockSignal = {
        signal_date: new Date('2026-11-22T00:00:00.000Z'),
        basis: new Prisma.Decimal(5200),
        spread: new Prisma.Decimal(337),
        regime: 'BACKWARDATION_STRONG',
        volatility_30d: new Prisma.Decimal(0.0185),
      };

      prismaService.rawMarketPrice.findMany.mockResolvedValue(mockPrices);
      prismaService.dailySignal.findUnique.mockResolvedValue(mockSignal);

      const job = {
        id: 'job-brief-1',
        name: ALERT_JOBS.MORNING_BRIEFING,
        data: {},
      } as unknown as Job;

      // 1st call -> Should send
      const result1 = await processor.process(job as any);
      expect(result1.success).toBe(true);
      expect(telegramService.sendMessage).toHaveBeenCalledTimes(1);

      // 2nd call for the same date -> Should skip duplicate
      const result2 = await processor.process(job as any);
      expect(result2.skipped).toBe(true);
      expect(result2.duplicate).toBe(true);
      expect(telegramService.sendMessage).toHaveBeenCalledTimes(1); // not called again
    });

    it('should process Hot Anomaly Alert and deduplicate repeat calls for same date', async () => {
      const job = {
        id: 'job-anomaly-1',
        name: ALERT_JOBS.ANOMALY_ALERT,
        data: {
          signalDate: '2026-11-22',
          daklakPrice: 75000,
          zScore: '2.85',
          basis: '6500',
          spread: '420',
          regime: 'BACKWARDATION_EXTREME',
        },
      } as unknown as Job;

      // 1st call -> Should send
      const result1 = await processor.process(job as any);
      expect(result1.success).toBe(true);
      expect(telegramService.sendMessage).toHaveBeenCalledTimes(1);

      // 2nd call -> Duplicate guard
      const result2 = await processor.process(job as any);
      expect(result2.skipped).toBe(true);
      expect(telegramService.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should process System Error alert without deduplication', async () => {
      const job = {
        id: 'job-err-1',
        name: ALERT_JOBS.SYSTEM_ERROR,
        data: {
          queueName: 'ingestion-queue',
          jobId: '101',
          jobName: 'daily_sync',
          attempts: 5,
          maxAttempts: 5,
          errorMessage: 'Fatal network timeout',
        },
      } as unknown as Job;

      const result = await processor.process(job as any);
      expect(result.success).toBe(true);
      expect(telegramService.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. AlertScheduler', () => {
    let scheduler: AlertScheduler;
    let queueMock: jest.Mocked<Partial<Queue>>;

    beforeEach(async () => {
      queueMock = {
        upsertJobScheduler: jest.fn().mockResolvedValue({} as any),
        add: jest.fn().mockResolvedValue({ id: 'manual-alert-1' } as any),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AlertScheduler,
          {
            provide: getQueueToken(ALERT_QUEUE_NAME),
            useValue: queueMock,
          },
        ],
      }).compile();

      scheduler = module.get<AlertScheduler>(AlertScheduler);
    });

    it('should register morning briefing 08:45 AM repeatable job on module init', async () => {
      await scheduler.onModuleInit();

      expect(queueMock.upsertJobScheduler).toHaveBeenCalledWith(
        'morning_briefing_0845',
        {
          pattern: ALERT_CRONS.MORNING_BRIEFING,
          tz: ALERT_CRONS.TIMEZONE,
        },
        expect.objectContaining({
          name: ALERT_JOBS.MORNING_BRIEFING,
          data: { trigger: 'cron_morning_briefing_0845' },
        }),
      );
    });

    it('should allow immediate manual briefing trigger', async () => {
      await scheduler.triggerImmediateBriefing(true);

      expect(queueMock.add).toHaveBeenCalledWith(
        ALERT_JOBS.MORNING_BRIEFING,
        {
          trigger: 'manual_dispatch',
          force: true,
        },
        expect.any(Object),
      );
    });
  });
});
