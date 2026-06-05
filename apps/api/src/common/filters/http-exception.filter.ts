import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { traceStorage } from '../../logger/trace.context';
import { LoggerService } from '../../logger/logger.service';

interface ErrorBody {
  code: string;
  message: string;
  traceId: string;
  issues?: { path: string; message: string }[];
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const traceId = traceStorage.getStore()?.traceId ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let issues: ErrorBody['issues'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODES[status] ?? 'HTTP_ERROR';
      message = exception.message;

      const exRes = exception.getResponse();
      if (typeof exRes === 'object' && exRes !== null) {
        const r = exRes as Record<string, unknown>;
        if (typeof r['code'] === 'string') code = r['code'];
        if (typeof r['message'] === 'string') message = r['message'];
        if (Array.isArray(r['issues'])) {
          issues = r['issues'] as ErrorBody['issues'];
          message = 'Validation failed';
        }
      }
    } else {
      // Unexpected error — log with full detail, never expose to client
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unknown error',
        exception instanceof Error ? exception.stack : undefined,
        'AllExceptionsFilter',
      );
    }

    const body: ErrorBody = { code, message, traceId, ...(issues ? { issues } : {}) };
    response.status(status).json(body);
  }
}
