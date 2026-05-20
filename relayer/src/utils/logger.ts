import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

function buildLogger(): pino.Logger {
  if (!isProduction) {
    return pino({
      level: 'info',
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
    });
  }
  // Production: GCP-formatted JSON to stdout.
  // Cloud Run captures stdout → Cloud Logging parses severity, message, and timestamp.
  // Context fields (chain, paymentId, txHash, etc.) appear as jsonPayload labels.
  return pino({ level: 'info', ...createGcpLoggingPinoConfig() } as pino.LoggerOptions) as pino.Logger;
}

export const logger = buildLogger();

/** Returns a child logger pre-tagged with the chain name for easy log filtering. */
export function chainLogger(chainName: string) {
  return logger.child({ chain: chainName });
}
