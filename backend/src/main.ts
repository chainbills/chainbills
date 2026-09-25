// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Bootstrap
//
// Wires the process-level HTTP concerns SPEC.md §5 and phase 1 task 7 call
// for: pino logging, cookies, CORS, a 100 kB body limit, security headers,
// strict request validation, Swagger, and graceful shutdown. Business logic
// never lives here — this file only assembles Nest's HTTP adapter around
// AppModule.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

/** Every request/response body is capped at 100 kB (SPEC.md §13). */
const BODY_SIZE_LIMIT = '100kb';

/** Refresh-token cookie name from SPEC.md §9.2 — declared here for the Swagger cookie-auth scheme. */
const REFRESH_COOKIE_NAME = 'cb_refresh';

async function bootstrap(): Promise<void> {
  // bodyParser: false — we install json()/urlencoded() ourselves below with
  // an explicit size limit instead of Nest's unbounded default.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });

  app.useLogger(app.get(Logger));
  const config = app.get(AppConfigService).env;

  app.use(json({ limit: BODY_SIZE_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));
  app.use(cookieParser());
  app.use(helmet());

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  setupSwagger(app, config.publicApiUrl);

  app.enableShutdownHooks();

  await app.listen(config.port);
  logRegisteredRoutes(app);
}

/** Prints every registered HTTP route once at boot so the operator can eyeball what's actually wired. */
function logRegisteredRoutes(app: NestExpressApplication): void {
  const logger = new NestLogger('Routes');
  const httpAdapter = app.getHttpAdapter().getInstance() as { router?: { stack?: RouterLayer[] }; _router?: { stack?: RouterLayer[] } };
  const stack = httpAdapter.router?.stack ?? httpAdapter._router?.stack ?? [];
  const routes = collectRoutes(stack);
  if (routes.length === 0) {
    logger.warn('no routes registered');
    return;
  }
  for (const { method, path } of routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))) {
    logger.log(`${method.padEnd(6)} ${path}`);
  }
  logger.log(`${routes.length} route(s) registered`);
}

interface RouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: RouterLayer[] };
  regexp?: RegExp;
}

function collectRoutes(stack: RouterLayer[], prefix = ''): { method: string; path: string }[] {
  const out: { method: string; path: string }[] = [];
  for (const layer of stack) {
    if (layer.route) {
      const path = prefix + layer.route.path;
      for (const method of Object.keys(layer.route.methods)) out.push({ method: method.toUpperCase(), path });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      out.push(...collectRoutes(layer.handle.stack, prefix));
    }
  }
  return out;
}

/** Mounts OpenAPI docs at /docs (Swagger UI) and /docs-json (raw spec), per phase 1 task 7. */
function setupSwagger(app: NestExpressApplication, serverUrl: string): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Chainbills API')
      .setDescription('Cross-chain payment gateway — public read API, auth and user endpoints.')
      .setVersion('0.1.0')
      .addServer(serverUrl)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addCookieAuth(REFRESH_COOKIE_NAME, { type: 'apiKey', in: 'cookie', name: REFRESH_COOKIE_NAME }, 'refresh-token')
      .build()
  );
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}

bootstrap().catch((err: unknown) => {
  // The pino logger may not exist yet if bootstrap failed before app.useLogger()
  // ran, so this is the one place in the app allowed to fall back to stderr.
  process.stderr.write(`fatal: failed to start: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
