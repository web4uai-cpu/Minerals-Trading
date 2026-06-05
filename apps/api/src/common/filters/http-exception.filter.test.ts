import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import { LoggerService } from '../../logger/logger.service';

const mockLogger = { error: jest.fn(), log: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn(), child: jest.fn() };

function makeHost(jsonFn: jest.Mock, statusFn: jest.Mock) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: statusFn,
        json: jsonFn,
      }),
      getRequest: () => ({}),
    }),
  } as never;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    filter = new AllExceptionsFilter(mockLogger as unknown as LoggerService);
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
  });

  function run(exception: unknown) {
    filter.catch(exception, makeHost(jsonSpy, statusSpy));
    return jsonSpy.mock.calls[0]?.[0] as Record<string, unknown>;
  }

  it('returns 404 with NOT_FOUND code', () => {
    const body = run(new NotFoundException('Listing not found'));
    expect(statusSpy).toHaveBeenCalledWith(404);
    expect(body['code']).toBe('NOT_FOUND');
    expect(body['message']).toBe('Listing not found');
    expect(typeof body['traceId']).toBe('string');
  });

  it('returns 401 for UnauthorizedException', () => {
    const body = run(new UnauthorizedException());
    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(body['code']).toBe('UNAUTHORIZED');
  });

  it('returns 403 for ForbiddenException', () => {
    const body = run(new ForbiddenException());
    expect(statusSpy).toHaveBeenCalledWith(403);
    expect(body['code']).toBe('FORBIDDEN');
  });

  it('extracts VALIDATION_ERROR code and issues from BadRequestException', () => {
    const exc = new BadRequestException({
      code: 'VALIDATION_ERROR',
      issues: [{ path: 'email', message: 'Invalid email' }],
    });
    const body = run(exc);
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(body['code']).toBe('VALIDATION_ERROR');
    expect(body['message']).toBe('Validation failed');
    expect(body['issues']).toEqual([{ path: 'email', message: 'Invalid email' }]);
  });

  it('returns 500 for unexpected errors without leaking details', () => {
    const body = run(new Error('db connection string with password'));
    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(body['code']).toBe('INTERNAL_ERROR');
    expect(body['message']).toBe('An unexpected error occurred');
    expect(JSON.stringify(body)).not.toContain('db connection string');
  });

  it('returns 500 for thrown non-Error values', () => {
    const body = run('something went wrong');
    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(body['code']).toBe('INTERNAL_ERROR');
  });

  it('always includes traceId in every response', () => {
    const bodies = [
      run(new NotFoundException()),
      run(new Error('boom')),
      run(new HttpException('custom', HttpStatus.CONFLICT)),
    ];
    for (const body of bodies) {
      expect(typeof body['traceId']).toBe('string');
      expect((body['traceId'] as string).length).toBeGreaterThan(0);
    }
  });

  it('never includes stack trace in response', () => {
    const err = new Error('internal failure');
    const body = run(err);
    expect(JSON.stringify(body)).not.toContain('stack');
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('logs unexpected errors via LoggerService', () => {
    mockLogger.error.mockClear();
    run(new Error('unexpected'));
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('does not log HttpExceptions at error level', () => {
    mockLogger.error.mockClear();
    run(new NotFoundException());
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
