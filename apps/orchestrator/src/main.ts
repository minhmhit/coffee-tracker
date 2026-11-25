import * as dns from 'dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { TelegramBotService } from './alerts/telegram-bot.service';
import { isWebhookTelegramMode } from './common/queue-mode';

// Prefer IPv4 DNS resolution to prevent IPv6 Happy Eyeballs stalls inside Docker
dns.setDefaultResultOrder('ipv4first');

function resolveCorsOrigins(): string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') {
    return '*';
  }
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : '*';
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const corsOrigins = resolveCorsOrigins();
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: corsOrigins !== '*',
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(
    `Orchestrator running on port ${port} (CORS: ${Array.isArray(corsOrigins) ? corsOrigins.join(', ') : corsOrigins})`,
  );

  // Start Telegram interactive command polling only inside the main HTTP server process
  // and only when not configured for cloud webhook mode.
  if (!isWebhookTelegramMode()) {
    app.get(TelegramBotService).startPolling();
  } else {
    logger.log('Telegram running in webhook mode (TELEGRAM_MODE=webhook); long-polling skipped.');
  }
}
bootstrap();
