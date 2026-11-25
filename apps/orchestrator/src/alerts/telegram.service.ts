import { Injectable, Logger } from '@nestjs/common';

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
  errorCode?: number;
}

export interface TelegramBotProfile {
  id?: number;
  username: string;
  firstName?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private lastSendTime = 0;
  private readonly MIN_INTERVAL_MS = 50; // Rate limit guard: max 20 requests/sec
  private cachedBotProfile: TelegramBotProfile | null = null;

  getBotToken(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  getDefaultChatId(): string | undefined {
    return process.env.TELEGRAM_CHAT_ID;
  }

  isConfigured(): boolean {
    const token = this.getBotToken();
    return Boolean(token && !token.includes('your_telegram_bot_token'));
  }

  /**
   * Sends an HTML formatted message to the default .env TELEGRAM_CHAT_ID.
   */
  async sendMessage(htmlText: string): Promise<TelegramSendResult> {
    const chatId = this.getDefaultChatId();
    if (!chatId || chatId.includes('your_telegram_chat_id')) {
      this.logger.warn(
        'Telegram credentials not properly configured in .env. Message logged to console instead:',
      );
      this.logger.log(
        `\n--- TELEGRAM SIMULATED MESSAGE ---\n${htmlText}\n----------------------------------`,
      );
      return {
        success: false,
        error: 'Telegram credentials missing or placeholder in .env',
      };
    }

    return this.sendMessageToChat(chatId, htmlText);
  }

  /**
   * Sends an HTML formatted message to any specific chat_id with rate-limiting
   * and Telegram error_code inspection (e.g., 403 when user blocked bot).
   */
  async sendMessageToChat(
    chatId: string,
    htmlText: string,
  ): Promise<TelegramSendResult> {
    const token = this.getBotToken();

    if (!token || token.includes('your_telegram_bot_token') || !chatId) {
      this.logger.warn(
        'Telegram credentials not properly configured in .env. Message logged to console instead:',
      );
      this.logger.log(
        `\n--- TELEGRAM SIMULATED MESSAGE ---\n${htmlText}\n----------------------------------`,
      );
      return {
        success: false,
        error: 'Telegram credentials missing or placeholder in .env',
      };
    }

    // Rate limiting: ensure min interval between consecutive dispatches (<= 20 msg/s)
    const now = Date.now();
    const timeSinceLast = now - this.lastSendTime;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.MIN_INTERVAL_MS - timeSinceLast),
      );
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
        const errorCode = json.error_code ?? response.status;
        this.logger.error(`Telegram API error (${errorCode}): ${errorDesc}`);
        return {
          success: false,
          error: errorDesc,
          errorCode,
        };
      }

      this.logger.log(
        `Telegram message sent successfully! Message ID: ${json.result?.message_id}`,
      );
      return {
        success: true,
        messageId: json.result?.message_id,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errMsg =
        err.name === 'AbortError' ? 'Connection timeout (10s)' : err.message;
      this.logger.error(`Failed to send Telegram message: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Auto-discovers bot username via Telegram `getMe` API, cached in memory,
   * falling back cleanly to TELEGRAM_BOT_USERNAME env var.
   */
  async getBotProfile(): Promise<TelegramBotProfile> {
    if (this.cachedBotProfile) {
      return this.cachedBotProfile;
    }

    const envUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '');
    const token = this.getBotToken();

    if (!token || token.includes('your_telegram_bot_token')) {
      return { username: envUsername || 'minhmh_coffee_tracker_bot' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (json.ok && json.result?.username) {
          this.cachedBotProfile = {
            id: json.result.id,
            username: json.result.username,
            firstName: json.result.first_name,
          };
          return this.cachedBotProfile;
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.logger.debug(`getMe lookup failed cleanly: ${err.message}`);
    }

    return { username: envUsername || 'minhmh_coffee_tracker_bot' };
  }

  /**
   * Calls Telegram `getUpdates` API for safe long-polling inside NestJS.
   */
  async getUpdates(
    offset?: number,
    timeoutSec = 20,
    signal?: AbortSignal,
  ): Promise<any[]> {
    const token = this.getBotToken();
    if (!token || token.includes('your_telegram_bot_token')) {
      return [];
    }

    const params = new URLSearchParams({
      timeout: String(timeoutSec),
      allowed_updates: JSON.stringify(['message']),
    });
    if (offset !== undefined) {
      params.set('offset', String(offset));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      (timeoutSec + 8) * 1000,
    );

    const onParentAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        return [];
      }
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Telegram getUpdates HTTP ${response.status}`);
      }

      const json = await response.json();
      if (!json.ok || !Array.isArray(json.result)) {
        return [];
      }
      return json.result;
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onParentAbort);
      }
    }
  }
}
