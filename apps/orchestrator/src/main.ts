import * as dns from 'dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { TelegramBotService } from './alerts/telegram-bot.service';

// Prefer IPv4 DNS resolution to prevent IPv6 Happy Eyeballs stalls inside Docker
dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Enable CORS for frontend applications (Next.js dashboard on port 3000)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Orchestrator running on port ${port} with CORS enabled`);

  // Start Telegram interactive command polling only inside the main HTTP server process
  app.get(TelegramBotService).startPolling();
}
bootstrap();
