// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — GlobalExceptionFilter tests
//
// Covers every branch of catch()/toErrorBody(): HttpException with a string
// response, HttpException with an object response (both string and
// non-string `message`, both custom and default `error`), a non-HttpException
// (mapped to a bare 500), and the >=500 logging branch.
// ──────────────────────────────────────────────────────────────────────────────

import { ArgumentsHost, BadRequestException, ForbiddenException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function makeHost(): { host: ArgumentsHost; res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json };
  const req = { method: 'GET', url: '/health' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('GlobalExceptionFilter', () => {
  it('passes through a string-response HttpException as-is', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    filter.catch(new HttpException('nope', HttpStatus.NOT_FOUND), host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 404, error: 'Not Found', message: 'nope' });
  });

  it('uses the object response body for a class-validator BadRequestException (array message)', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    filter.catch(new BadRequestException(['field must not be empty']), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: ['field must not be empty'],
    });
  });

  it('falls back to the exception message when the response object has no string/string[] message', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    class WeirdException extends HttpException {
      constructor() {
        super({ error: 'Weird', message: { nested: true } }, HttpStatus.BAD_REQUEST);
      }
    }
    const exception = new WeirdException();
    filter.catch(exception, host);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 400, error: 'Weird', message: exception.message });
  });

  it('derives the error name from the status code when the response object omits it', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    class NoErrorField extends HttpException {
      constructor() {
        super({ message: 'forbidden' }, HttpStatus.FORBIDDEN);
      }
    }
    filter.catch(new NoErrorField(), host);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 403, error: 'Forbidden', message: 'forbidden' });
  });

  it('falls back to "Error" for a status code with no HttpStatus name', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    filter.catch(new HttpException('weird status', 599), host);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 599, error: 'Error', message: 'weird status' });
  });

  it('maps a non-HttpException to a bare 500 without leaking its message', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('secret internals'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  it('logs a 5xx HttpException but not a 4xx one', () => {
    const filter = new GlobalExceptionFilter();
    const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { host: host4xx } = makeHost();
    filter.catch(new ForbiddenException(), host4xx);
    expect(logSpy).not.toHaveBeenCalled();

    const { host: host5xx } = makeHost();
    filter.catch(new HttpException('server broke', HttpStatus.BAD_GATEWAY), host5xx);
    expect(logSpy).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });
});
