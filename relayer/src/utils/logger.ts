// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Logger
//
// pino-based structured logging with two destinations:
//   1. stdout — always (JSON in prod, pino-pretty in dev)
//   2. GCP Cloud Logging API — when GOOGLE_APPLICATION_CREDENTIALS is set (any environment)

// ──────────────────────────────────────────────────────────────────────────────

import { Logging } from '@google-cloud/logging';
import pino, { type StreamEntry } from 'pino';
import { Writable } from 'stream';

const isProduction = process.env.NODE_ENV === 'production';

function pinoLevelToGcpSeverity(level: number): string {
  if (level >= 60) return 'CRITICAL';
  if (level >= 50) return 'ERROR';
  if (level >= 40) return 'WARNING';
  if (level >= 30) return 'INFO';
  return 'DEBUG';
}

function buildGcpStream(): Writable | null {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
  const logging = new Logging();
  const gcpLog = logging.log('chainbills-relayer');
  return new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      try {
        const entry = JSON.parse(chunk.toString().trim());
        const severity = pinoLevelToGcpSeverity(entry.level);
        gcpLog.write(gcpLog.entry({ severity, resource: { type: 'global' } }, entry)).catch(() => {});
      } catch {}
      cb();
    },
  });
}

const gcpStream = buildGcpStream();

function buildLogger(): pino.Logger {
  if (!isProduction) {
    // Dev only, no GCP: pretty-print to stdout.
    return pino({
      level: 'info',
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
    });
  }

  // Production or GCP-enabled: JSON to stdout + optional GCP stream.
  const streams: StreamEntry[] = [{ stream: process.stdout, level: 'info' as const }];
  if (gcpStream) streams.push({ stream: gcpStream, level: 'info' as const });
  return pino({ level: 'info' }, pino.multistream(streams));
}

export const logger = buildLogger();

/** Returns a child logger pre-tagged with the chain name for easy log filtering. */
export function chainLogger(chainName: string) {
  return logger.child({ chain: chainName });
}
