import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggerService } from './logger/logger.service';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Railway / Vercel use reverse proxies
  app.set('trust proxy', 1);

  app.use(helmet());

  // CORS: allow Vercel frontend + mobile + localhost dev
  const allowedOrigins = (process.env['CORS_ORIGINS'] ?? process.env['APP_BASE_URL'] ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Railway injects PORT; fallback to API_PORT or 4000
  const port = process.env['PORT'] ?? process.env['API_PORT'] ?? 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Khanij Nexus API running on port ${port}`, 'Bootstrap');
  logger.log(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`, 'Bootstrap');
}

bootstrap();
