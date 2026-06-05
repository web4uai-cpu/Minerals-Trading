import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';
import { traceStorage } from './trace.context';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly pino: Logger;

  constructor() {
    this.pino = pino({
      level: process.env['LOG_LEVEL'] ?? 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  private ctx(context?: string): Record<string, unknown> {
    const store = traceStorage.getStore();
    return {
      ...(store ? { traceId: store.traceId } : {}),
      ...(context ? { context } : {}),
    };
  }

  log(message: unknown, context?: string): void {
    this.pino.info(this.ctx(context), String(message));
  }

  error(message: unknown, trace?: unknown, context?: string): void {
    this.pino.error(
      { ...this.ctx(context), ...(trace ? { trace } : {}) },
      String(message),
    );
  }

  warn(message: unknown, context?: string): void {
    this.pino.warn(this.ctx(context), String(message));
  }

  debug(message: unknown, context?: string): void {
    this.pino.debug(this.ctx(context), String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.pino.trace(this.ctx(context), String(message));
  }

  /** Expose the raw pino child-logger for pino-http integration. */
  child(bindings: Record<string, unknown>): Logger {
    return this.pino.child(bindings);
  }
}
