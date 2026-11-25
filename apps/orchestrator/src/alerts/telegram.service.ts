import { Injectable, Logger } from '@nestjs/common';

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private lastSendTime = 0;
  private readonly MIN_INTERVAL_MS = 50; // Rate limit guard: max 20 requests/sec

  private getBotToken(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  private getChatId(): string | undefined {
    return process.env.TELEGRAM_CHAT_ID;
  }

  /**
   * Sends an HTML formatted message to the configured Telegram chat.
   */
  async sendMessage(htmlText: string): Promise<TelegramSendResult> {
    const token = this.getBotToken();
    const chatId = this.getChatId();

    if (!token || token.includes('your_telegram_bot_token') || !chatId || chatId.includes('your_telegram_chat_id')) {
      this.logger.warn('Telegram credentials not properly configured in .env. Message logged to console instead:');
      this.logger.log(`\n--- TELEGRAM SIMULATED MESSAGE ---\n${htmlText}\n----------------------------------`);
      return {
        success: false,
        error: 'Telegram credentials missing or placeholder in .env',
      };
    }

    // Rate limiting: ensure min interval between consecutive dispatches
    const now = Date.now();
    const timeSinceLast = now - this.lastSendTime;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, this.MIN_INTERVAL_MS - timeSinceLast));
    }
    this.lastSendTime = Date.now();

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      this.logger.log(`Dispatching Telegram notification to chat ID ${chatId}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CoffeeTracker-TelegramService/1.0',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok || !json.ok) {
        const errorDesc = json.description || `HTTP ${response.status}`;
        this.logger.error(`Telegram API error: ${errorDesc}`);
        return {
          success: false,
          error: errorDesc,
        };
      }

      this.logger.log(`Telegram message sent successfully! Message ID: ${json.result?.message_id}`);
      return {
        success: true,
        messageId: json.result?.message_id,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errMsg = err.name === 'AbortError' ? 'Connection timeout (10s)' : err.message;
      this.logger.error(`Failed to send Telegram message: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}
