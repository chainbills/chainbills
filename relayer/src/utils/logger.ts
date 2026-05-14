// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Logger
//
// We use pino for structured JSON logging. In development (NODE_ENV != production)
// pino-pretty is used for human-readable output. In production the raw JSON
// goes to stdout where Cloud Run / Cloud Logging picks it up.
// ──────────────────────────────────────────────────────────────────────────────

import pino from 'pino';
export const logger = pino({
  level: 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
});

/** Returns a child logger pre-tagged with the chain name for easy log filtering. */
export function chainLogger(chainName: string) {
  return logger.child({ chain: chainName });
}
