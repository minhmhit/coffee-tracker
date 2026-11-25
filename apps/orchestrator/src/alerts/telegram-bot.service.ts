import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { MorningBriefingService } from './morning-briefing.service';
import { AlertFormatter } from './alert-formatter';

@Injectable()
export class TelegramBotService implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private pollingAbortController: AbortController | null = null;
  private isPolling = false;
  private lastUpdateId = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly briefingService: MorningBriefingService,
  ) {}

  onModuleDestroy() {
    this.stopPolling();
  }

  /**
   * Starts safe Telegram long-polling loop (invoked by Nest HTTP server bootstrap).
   */
  startPolling(): void {
    if (this.isPolling) return;
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.TELEGRAM_POLLING_ENABLED === 'false' ||
      !this.telegramService.isConfigured()
    ) {
      this.logger.log('Telegram long-polling skipped (disabled or unconfigured).');
      return;
    }

    this.isPolling = true;
    this.pollingAbortController = new AbortController();
    this.logger.log('Starting Telegram Bot long-polling listener (/start, /today, /stop)...');

    void this.pollLoop(this.pollingAbortController.signal);
  }

  stopPolling(): void {
    if (!this.isPolling) return;
    this.isPolling = false;
    this.pollingAbortController?.abort();
    this.pollingAbortController = null;
    this.logger.log('Stopped Telegram Bot long-polling cleanly.');
  }

  private async pollLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted && this.isPolling) {
      try {
        const offset = this.lastUpdateId > 0 ? this.lastUpdateId + 1 : undefined;
        const updates = await this.telegramService.getUpdates(offset, 20, signal);

        for (const update of updates) {
          if (typeof update.update_id === 'number' && update.update_id > this.lastUpdateId) {
            this.lastUpdateId = update.update_id;
          }
          await this.handleUpdate(update);
        }
      } catch (err: any) {
        if (signal.aborted || err.name === 'AbortError') {
          break;
        }
        this.logger.warn(`Telegram polling cycle error: ${err.message}. Retrying in 5s...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Processes a single Telegram Update object (/start, /stop, /today commands).
   */
  async handleUpdate(update: any): Promise<{ handled: boolean; command?: string }> {
    const message = update?.message;
    const text = typeof message?.text === 'string' ? message.text.trim() : '';
    const rawChatId = message?.chat?.id;

    if (!rawChatId || !text) {
      return { handled: false };
    }

    const chatId = String(rawChatId);
    const commandToken = text.split(/\s+/)[0].toLowerCase().split('@')[0];

    if (commandToken === '/start') {
      const username: string | null =
        message.from?.username || message.chat?.username || null;
      const firstName: string | null =
        message.from?.first_name || message.chat?.first_name || null;

      await this.prisma.telegramSubscriber.upsert({
        where: { chat_id: chatId },
        update: {
          username,
          first_name: firstName,
          is_active: true,
        },
        create: {
          chat_id: chatId,
          username,
          first_name: firstName,
          is_active: true,
        },
      });

      const greetingName = firstName ? ` ${AlertFormatter.escapeHtml(firstName)}` : '';
      const welcomeHtml = [
        `☕ <b>Chào mừng${greetingName} đến với Coffee Tracker!</b>`,
        ``,
        `✅ Bạn đã đăng ký thành công nhận <b>Điểm tin Thị trường Cà phê sáng lúc 06:00 hàng ngày</b> (giờ Việt Nam) cùng cảnh báo biến động bất thường.`,
        ``,
        `📌 <b>Các lệnh hỗ trợ:</b>`,
        `• /today — Xem ngay bản tin giá, thời tiết &amp; dự báo hôm nay`,
        `• /stop — Tạm dừng nhận điểm tin tự động`,
        `• /start — Kích hoạt lại đăng ký`,
      ].join('\n');

      await this.telegramService.sendMessageToChat(chatId, welcomeHtml);

      // Send immediate sample briefing upon onboarding
      const briefing = await this.briefingService.buildEnrichedBriefing();
      if (briefing) {
        await this.telegramService.sendMessageToChat(chatId, briefing.html);
      }

      this.logger.log(`Subscriber onboarded via /start: chatId=${chatId}, username=${username || 'N/A'}`);
      return { handled: true, command: '/start' };
    }

    if (commandToken === '/stop') {
      await this.prisma.telegramSubscriber.updateMany({
        where: { chat_id: chatId },
        data: { is_active: false },
      });

      const byeHtml =
        '🔕 <b>Đã tạm dừng gửi điểm tin hàng ngày.</b>\nGửi lại lệnh /start bất cứ lúc nào nếu bạn muốn tiếp tục nhận bản tin cà phê lúc 06:00 sáng.';
      await this.telegramService.sendMessageToChat(chatId, byeHtml);

      this.logger.log(`Subscriber unsubscribed via /stop: chatId=${chatId}`);
      return { handled: true, command: '/stop' };
    }

    if (commandToken === '/today') {
      const briefing = await this.briefingService.buildEnrichedBriefing();
      if (briefing) {
        await this.telegramService.sendMessageToChat(chatId, briefing.html);
      } else {
        await this.telegramService.sendMessageToChat(
          chatId,
          '⚠️ Hiện chưa có dữ liệu thị trường mới nhất trong hệ thống. Vui lòng thử lại sau.',
        );
      }
      return { handled: true, command: '/today' };
    }

    await this.telegramService.sendMessageToChat(
      chatId,
      'ℹ️ Gửi /today để xem bản tin hôm nay, /start để đăng ký nhận tin lúc 06:00 sáng, hoặc /stop để tạm dừng.',
    );
    return { handled: true, command: 'help' };
  }
}
