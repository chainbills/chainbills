// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — HTTP logging interceptor
//
// One log line per request: method, url, status, duration_ms, ip, and the
// error message on failures. Registered as a global APP_INTERCEPTOR in
// app.module.ts so every controller is covered without per-route wiring.
//
// The log is emitted on the response's 'finish' event, not from tap({next})/
// tap({error}), so the status reflects what the client actually received —
// GlobalExceptionFilter has already rewritten res.statusCode by then (a
// controller throwing ForbiddenException on a route decorated @HttpCode(204)
// would otherwise log 204 instead of the real 403).
// ──────────────────────────────────────────────────────────────────────────────

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<ExpressRequest>();
    const res = http.getResponse<ExpressResponse>();
    const startedAt = process.hrtime.bigint();
    let errorMessage: string | undefined;

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.log({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ip: req.ip ?? req.socket.remoteAddress ?? '-',
        ...(errorMessage ? { error: errorMessage } : {}),
      });
    });

    return next.handle().pipe(
      tap({
        error: (err: unknown) => {
          errorMessage = err instanceof Error ? err.message : String(err);
        },
      })
    );
  }
}
