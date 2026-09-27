// LoggingInterceptor unit tests.
// Covers HTTP context logging on res.finish, error capture, ip fallback,
// and pass-through for non-HTTP contexts.

import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function makeRes() {
  const listeners: Record<string, () => void> = {};
  return {
    on: vi.fn((event: string, cb: () => void) => {
      listeners[event] = cb;
    }),
    statusCode: 200,
    _emit: (event: string) => listeners[event]?.(),
  };
}

function makeReq(overrides: { method?: string; originalUrl?: string; ip?: string; socket?: { remoteAddress?: string } } = {}) {
  return {
    method: overrides.method ?? 'GET',
    originalUrl: overrides.originalUrl ?? '/test',
    ip: overrides.ip,
    socket: overrides.socket ?? { remoteAddress: '127.0.0.1' },
  };
}

function makeHttpContext(req: object, res: object) {
  return {
    getType: () => 'http' as const,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  };
}

function makeNonHttpContext() {
  return {
    getType: () => 'ws' as const,
  };
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    // Access private logger via any cast
    logSpy = vi.spyOn((interceptor as never as { logger: { log: () => void } }).logger, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
    logSpy = vi.spyOn((interceptor as never as { logger: { log: () => void } }).logger, 'log').mockImplementation(() => {});
  });

  it('passes through non-HTTP contexts without attaching a finish listener', () => {
    const next = { handle: vi.fn().mockReturnValue(of('data')) };
    const context = makeNonHttpContext();

    interceptor.intercept(context as never, next as never);

    expect(next.handle).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs method, url, status, durationMs, and ip on res.finish', async () => {
    const res = makeRes();
    const req = makeReq({ method: 'POST', originalUrl: '/api/test', ip: '10.0.0.1' });
    const context = makeHttpContext(req, res);
    const next = { handle: vi.fn().mockReturnValue(of('ok')) };

    const obs = interceptor.intercept(context as never, next as never);
    await new Promise<void>((resolve) => obs.subscribe({ complete: resolve }));

    // Emit the finish event
    res._emit('finish');

    expect(logSpy).toHaveBeenCalledOnce();
    const logged = logSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged.method).toBe('POST');
    expect(logged.url).toBe('/api/test');
    expect(logged.status).toBe(200);
    expect(logged.ip).toBe('10.0.0.1');
    expect(typeof logged.durationMs).toBe('number');
  });

  it('falls back to socket.remoteAddress when req.ip is undefined', async () => {
    const res = makeRes();
    const req = makeReq({ ip: undefined, socket: { remoteAddress: '192.168.1.5' } });
    const context = makeHttpContext(req, res);
    const next = { handle: vi.fn().mockReturnValue(of('ok')) };

    const obs = interceptor.intercept(context as never, next as never);
    await new Promise<void>((resolve) => obs.subscribe({ complete: resolve }));
    res._emit('finish');

    const logged = logSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged.ip).toBe('192.168.1.5');
  });

  it('captures error message and includes it in the log', async () => {
    const res = makeRes();
    const req = makeReq();
    const context = makeHttpContext(req, res);
    const error = new Error('something broke');
    const next = { handle: vi.fn().mockReturnValue(throwError(() => error)) };

    const obs = interceptor.intercept(context as never, next as never);
    // Subscribe and wait for error
    await new Promise<void>((resolve) => obs.subscribe({ error: () => resolve() }));

    res._emit('finish');

    const logged = logSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged.error).toBe('something broke');
  });

  it('omits error field when stream completes without error', async () => {
    const res = makeRes();
    const req = makeReq();
    const context = makeHttpContext(req, res);
    const next = { handle: vi.fn().mockReturnValue(of('ok')) };

    const obs = interceptor.intercept(context as never, next as never);
    await new Promise<void>((resolve) => obs.subscribe({ complete: resolve }));
    res._emit('finish');

    const logged = logSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged.error).toBeUndefined();
  });

  it('falls back to hyphen when both req.ip and socket.remoteAddress are undefined', async () => {
    const res = makeRes();
    const req = makeReq({ ip: undefined, socket: { remoteAddress: undefined } });
    const context = makeHttpContext(req, res);
    const next = { handle: vi.fn().mockReturnValue(of('ok')) };

    const obs = interceptor.intercept(context as never, next as never);
    await new Promise<void>((resolve) => obs.subscribe({ complete: resolve }));
    res._emit('finish');

    const logged = logSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged.ip).toBe('-');
  });

  it('converts non-Error thrown values to string for the error field', async () => {
    const res = makeRes();
    const req = makeReq();
    const context = makeHttpContext(req, res);
    const next = { handle: vi.fn().mockReturnValue(throwError(() => 'plain string error')) };

    const obs = interceptor.intercept(context as never, next as never);
    await new Promise<void>((resolve) => obs.subscribe({ error: () => resolve() }));
    res._emit('finish');

    const logged = logSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged.error).toBe('plain string error');
  });
});
