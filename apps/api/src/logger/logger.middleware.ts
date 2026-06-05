import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { traceStorage } from './trace.context';
import { LoggerService } from './logger.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly httpLogger: ReturnType<typeof pinoHttp>;

  constructor(private readonly logger: LoggerService) {
    this.httpLogger = pinoHttp({
      logger: this.logger.child({}),
      genReqId: (req) => {
        const headers = (req as { headers?: Record<string, string | undefined> }).headers ?? {};
        return (headers['x-trace-id']) ?? randomUUID();
      },
      customProps: (req) => ({
        traceId: (req as unknown as { id: string }).id,
      }),
      serializers: {
        req: (req: unknown) => {
          const r = req as { method: string; url: string };
          return { method: r.method, url: r.url };
        },
        res: (res: unknown) => {
          const r = res as { statusCode: number };
          return { statusCode: r.statusCode };
        },
      },
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.httpLogger(req, res, () => {
      const traceId = (req as Request & { id: string }).id;
      res.setHeader('x-trace-id', traceId);
      traceStorage.run({ traceId }, next);
    });
  }
}
