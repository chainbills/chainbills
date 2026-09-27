// Suppress NestJS Logger output during unit tests. The [Nest] ERROR/WARN lines
// that appear when tests exercise error paths are expected noise, not real
// failures — they make it hard to read which assertions actually failed.
//
// Set TEST_LOG=1 in your shell before running tests to restore full logging:
//   TEST_LOG=1 pnpm test
import { Logger } from '@nestjs/common';

if (!process.env.TEST_LOG) {
  Logger.overrideLogger(false);
}
