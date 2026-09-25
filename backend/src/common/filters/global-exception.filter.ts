// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Global exception filter
//
// Every error response has the same shape: { statusCode, error, message }
// (SPEC.md §12.1). Anything that is not a Nest HttpException is logged with
// full detail server-side and reported to the client as a bare 500 — never
// leaking a stack trace, a secret or an internal message (WORKER_RULES.md §3).
// ──────────────────────────────────────────────────────────────────────────────

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
// Aliased: Node 18+ defines global `Request`/`Response` (the fetch API),
// which would otherwise collide with express's same-named types here.
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

/** The one error body shape every endpoint returns. */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

/** Catches every exception, logs unhandled errors server-side, and returns a uniform error body to the client. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * Normalises any thrown value into {@link ErrorResponseBody}. `HttpException`s
   * (including class-validator's `BadRequestException` from the global
   * `ValidationPipe`) pass their status and message through; anything else is
   * an unexpected server error, logged in full here and reduced to a generic
   * 500 for the client so internals never leak over the wire.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ExpressResponse>();
    const request = ctx.getRequest<ExpressRequest>();

    const body = this.toErrorBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error({ err: exception, method: request.method, path: request.url }, 'unhandled exception');
    }
    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { statusCode, error: httpStatusName(statusCode), message: payload };
      }
      const payloadRecord = payload as Record<string, unknown>;
      const error = typeof payloadRecord.error === 'string' ? payloadRecord.error : httpStatusName(statusCode);
      const message = isStringOrStringArray(payloadRecord.message) ? payloadRecord.message : exception.message;
      return { statusCode, error, message };
    }
    return { statusCode: 500, error: 'Internal Server Error', message: 'Internal server error' };
  }
}

function httpStatusName(statusCode: number): string {
  return STATUS_CODES[statusCode] ?? 'Error';
}

function isStringOrStringArray(value: unknown): value is string | string[] {
  return typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string'));
}
