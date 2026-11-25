import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { TelegramService } from '../telegram.service';
import { MorningBriefingService } from '../morning-briefing.service';
import { TelegramBotService } from '../telegram-bot.service';
import { AlertProcessor } from '../processors/alert.processor';
import { AlertScheduler } from '../schedulers/alert.scheduler';
import { AlertsController } from '../alerts.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { InsightsService } from '../../insights/insights.service';
import { ALERT_JOBS, ALERT_QUEUE_NAME } from '../../signals/signals.constants';

describe('Telegram Onboarding & Enriched Morning Briefing (Step 5.3)', () => {
  let telegramService: any;
  let briefingService: MorningBriefingService;
  let botService: TelegramBotService;
  let processor: AlertProcessor;
  let controller: AlertsController;
  let prisma: any;
  let insightsService: any;
  let alertQueueMock: any;

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: '123456:TEST_TOKEN',
      TELEGRAM_CHAT_ID: '7583239264',
      TELEGRAM_BOT_USERNAME: 'minhmh_coffee_tracker_bot',
    };

    prisma = {
      rawMarketPrice: {
        findMany: jest.fn().mockResolvedValue([
          {
            price_date: new Date('2026-11-22T00:00:00.000Z'),
            price_daklak: new Prisma.Decimal(71800),
            price_lamdong: new Prisma.Decimal(71200),
            price_gialai: new Prisma.Decimal(71800),
            price_daknong: new Prisma.Decimal(72000),
            london_m1: new Prisma.Decimal(4565),
            london_m6: new Prisma.Decimal(4228),
            usd_vnd: new Prisma.Decimal(25600),
          },
          {
            price_date: new Date('2026-11-21T00:00:00.000Z'),
            price_daklak: new Prisma.Decimal(72100),
            london_m1: new Prisma.Decimal(4526),
            london_m6: new Prisma.Decimal(4209),
            usd_vnd: new Prisma.Decimal(25584),
          },
        ]),
      },
      dailySignal: {
        findUnique: jest.fn().mockResolvedValue({
          signal_date: new Date('2026-11-22T00:00:00.000Z'),
          basis: new Prisma.Decimal(-45064),
          spread: new Prisma.Decimal(337),
          volatility_30d: new Prisma.Decimal(0.0044),
          regime: 'BACKWARDATION_STRONG',
        }),
      },
      dailyWeather: {
        findFirst: jest.fn().mockResolvedValue({
          weather_date: new Date('2026-11-25T00:00:00.000Z'),
          province_code: 'DAKLAK',
          province_name: 'Đắk Lắk',
          temp_current: new Prisma.Decimal(28.4),
          temp_min: new Prisma.Decimal(22.3),
          temp_max: new Prisma.Decimal(30.1),
          precipitation_mm: new Prisma.Decimal(0),
          condition_vi: 'Trời quang, nắng ráo',
          farming_impact_vi: 'Thời tiết nắng ráo, thuận lợi thu hái và phơi sấy.',
        }),
      },
      forecastRun: {
        findFirst: jest.fn().mockResolvedValue({
          run_id: 'run-1',
          forecast_date: new Date('2026-11-22T00:00:00.000Z'),
          status: 'SUCCESS',
          predictions: [4, 12, 26].map((w) => ({
            horizon_week: w,
            pred_p10: new Prisma.Decimal(70500 + w * 100),
            pred_p50: new Prisma.Decimal(71900 + w * 130),
            pred_p90: new Prisma.Decimal(75400 + w * 800),
          })),
        }),
      },
      telegramSubscriber: {
        upsert: jest.fn().mockResolvedValue({ id: 1, chat_id: '999001', is_active: true }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(2),
      },
    };

    insightsService = {
      getLatestInsights: jest.fn().mockResolvedValue({
        overall_stance: 'TÍCH CỰC',
        factors: [
          {
            key: 'oil',
            metric_value: '$89.95/thùng',
            badge_label: 'ĐI NGANG (+0.72% / 7N)',
          },
          {
            key: 'inventory_supply',
            metric_value: '5.791 lô (57.910 tấn)',
            badge_label: 'CUNG THẮT CHẶT (BACKWARDATION)',
          },
          {
            key: 'fx',
            metric_value: '25.600 đ',
            badge_label: 'ỔN ĐỊNH (+0.05% / 7N)',
          },
        ],
        forecast_transparency: {
          available: true,
          confidence_note: 'MAPE 4 tuần: 1.36%, 26 tuần: 5.68%.',
        },
      }),
    };

    telegramService = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 101 }),
      sendMessageToChat: jest.fn().mockResolvedValue({ success: true, messageId: 202 }),
      getBotProfile: jest.fn().mockResolvedValue({ username: 'minhmh_coffee_tracker_bot' }),
      getUpdates: jest.fn().mockResolvedValue([]),
      setMyCommands: jest.fn().mockResolvedValue({ success: true }),
    };

    alertQueueMock = {
      upsertJobScheduler: jest.fn().mockResolvedValue({}),
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        MorningBriefingService,
        TelegramBotService,
        AlertProcessor,
        AlertScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: InsightsService, useValue: insightsService },
        { provide: TelegramService, useValue: telegramService },
        { provide: getQueueToken(ALERT_QUEUE_NAME), useValue: alertQueueMock },
      ],
    }).compile();

    briefingService = module.get<MorningBriefingService>(MorningBriefingService);
    botService = module.get<TelegramBotService>(TelegramBotService);
    processor = module.get<AlertProcessor>(AlertProcessor);
    controller = module.get<AlertsController>(AlertsController);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('1. Enriched MorningBriefingService Formatting', () => {
    it('should build clean HTML (< 4096 chars) containing prices, weather, oil/supply insights, and forecast range', async () => {
      const built = await briefingService.buildEnrichedBriefing();
      expect(built).not.toBeNull();
      expect(built!.html.length).toBeLessThan(4096);

      // 1. Price section
      expect(built!.html).toContain('1. GIÁ CÀ PHÊ HÔM NAY');
      expect(built!.html).toContain('71.800 đ/kg');
      expect(built!.html).toContain('Lâm Đồng: 71.200');

      // 2. Weather section
      expect(built!.html).toContain('2. THỜI TIẾT TÂY NGUYÊN HÔM NAY (Đắk Lắk)');
      expect(built!.html).toContain('28.4°C');
      expect(built!.html).toContain('Trời quang, nắng ráo');

      // 3. Insights section
      expect(built!.html).toContain('3. NHẬN ĐỊNH NHANH THỊ TRƯỜNG (TÍCH CỰC)');
      expect(built!.html).toContain('5.791 lô (57.910 tấn)');
      expect(built!.html).toContain('$89.95/thùng');

      // 4. Transparent forecast section
      expect(built!.html).toContain('4. DỰ BÁO GIÁ MINH BẠCH (6 THÁNG)');
      expect(built!.html).toContain('1 Tháng (T+4)');
      expect(built!.html).toContain('MAPE 4 tuần: 1.36%');
    });
  });

  describe('2. TelegramBotService (/start, /stop, /today)', () => {
    it('should register subscriber idempotently on /start subscribe and send welcome + sample briefing', async () => {
      const res = await botService.handleUpdate({
        update_id: 1,
        message: {
          chat: { id: 999001, username: 'nongdan_daklak', first_name: 'Minh' },
          from: { username: 'nongdan_daklak', first_name: 'Minh' },
          text: '/start subscribe',
        },
      });

      expect(res).toEqual({ handled: true, command: '/start' });
      expect(prisma.telegramSubscriber.upsert).toHaveBeenCalledWith({
        where: { chat_id: '999001' },
        update: expect.objectContaining({ is_active: true, username: 'nongdan_daklak' }),
        create: expect.objectContaining({ chat_id: '999001', is_active: true }),
      });

      // Sends 2 messages: welcome + immediate enriched sample briefing
      expect(telegramService.sendMessageToChat).toHaveBeenCalledTimes(2);
      expect(telegramService.sendMessageToChat.mock.calls[0][1]).toContain('Chào mừng Minh');
      expect(telegramService.sendMessageToChat.mock.calls[1][1]).toContain('BẢN TIN THỊ TRƯỜNG CÀ PHÊ SÁNG');
    });

    it('should mark subscriber inactive cleanly on /stop', async () => {
      const res = await botService.handleUpdate({
        update_id: 2,
        message: {
          chat: { id: 999001 },
          text: '/stop',
        },
      });

      expect(res).toEqual({ handled: true, command: '/stop' });
      expect(prisma.telegramSubscriber.updateMany).toHaveBeenCalledWith({
        where: { chat_id: '999001' },
        data: { is_active: false },
      });
      expect(telegramService.sendMessageToChat).toHaveBeenCalledWith(
        '999001',
        expect.stringContaining('tạm dừng gửi điểm tin'),
      );
    });

    it('should dispatch instant snapshot on /today command', async () => {
      const res = await botService.handleUpdate({
        update_id: 3,
        message: {
          chat: { id: 888777 },
          text: '/today@minhmh_coffee_tracker_bot',
        },
      });

      expect(res).toEqual({ handled: true, command: '/today' });
      expect(telegramService.sendMessageToChat).toHaveBeenCalledWith(
        '888777',
        expect.stringContaining('5.791 lô'),
      );
    });
  });

  describe('3. Broadcast Deduplication & 403 Forbidden Handling', () => {
    it('should deduplicate recipients and mark 403-blocked subscriber inactive without crashing', async () => {
      prisma.telegramSubscriber.findMany.mockResolvedValue([
        { chat_id: '7583239264' }, // duplicates .env TELEGRAM_CHAT_ID
        { chat_id: 'blocked_user_403' },
        { chat_id: 'active_user_2' },
      ]);

      telegramService.sendMessageToChat.mockImplementation(async (chatId: string) => {
        if (chatId === 'blocked_user_403') {
          return {
            success: false,
            errorCode: 403,
            error: 'Forbidden: bot was blocked by the user',
          };
        }
        return { success: true, messageId: 300 };
      });

      const job = {
        id: 'broadcast-1',
        name: ALERT_JOBS.MORNING_BRIEFING,
        data: { slot: '0600' },
      } as unknown as Job;

      const result = await processor.process(job);

      // Should call exactly 3 unique chat IDs (7583239264 deduplicated)
      expect(telegramService.sendMessageToChat).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.deliveredCount).toBe(2);
      expect(result.deactivatedCount).toBe(1);

      expect(prisma.telegramSubscriber.updateMany).toHaveBeenCalledWith({
        where: { chat_id: 'blocked_user_403' },
        data: { is_active: false },
      });
    });
  });

  describe('4. AlertsController - GET /api/alerts/telegram-info', () => {
    it('should return botUsername, deep link, subscriber count, and plain sample preview', async () => {
      const info = await controller.getTelegramOnboardingInfo();

      expect(info.botUsername).toBe('minhmh_coffee_tracker_bot');
      expect(info.deepLink).toBe('https://t.me/minhmh_coffee_tracker_bot?start=subscribe');
      expect(info.cronExpression).toBe('0 6 * * *');
      expect(info.activeSubscribersCount).toBe(2);
      expect(info.commands).toHaveLength(3);
      expect(info.sampleMessagePreview).toContain('1. GIÁ CÀ PHÊ HÔM NAY');
      expect(info.sampleMessagePreview).not.toContain('<b>');
    });
  });

  describe('5. Step 6.5 - Telegram setMyCommands Sync', () => {
    it('should sync /start, /today, /stop Vietnamese commands cleanly via TelegramService.setMyCommands', async () => {
      const result = await botService.syncBotCommands();
      expect(result).toEqual({ success: true });
      expect(telegramService.setMyCommands).toHaveBeenCalledWith([
        expect.objectContaining({ command: 'start' }),
        expect.objectContaining({ command: 'today' }),
        expect.objectContaining({ command: 'stop' }),
      ]);
    });

    it('should handle Telegram setMyCommands network errors non-blockingly without throwing', async () => {
      telegramService.setMyCommands.mockRejectedValueOnce(new Error('Network timeout'));
      const result = await botService.syncBotCommands();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });
});
