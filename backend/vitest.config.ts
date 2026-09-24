// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Vitest unit test config
//
// Runs *.spec.ts files colocated with source under src/. e2e tests live under
// test/ with their own config (vitest.e2e.config.ts) so `pnpm test` never
// needs a live Postgres.
//
// SWC (via unplugin-swc) replaces Vitest's default esbuild transform because
// esbuild does not emit decorator metadata, which Nest's dependency injection
// relies on (`emitDecoratorMetadata` in tsconfig.json).
//
// Coverage thresholds are enforced: `pnpm test:cov` fails when any metric
// drops below them. Exclusions are limited to files with no testable logic:
// the process entry point, pure module wiring, generated/copied chain
// artefacts, and type-only files.
// ──────────────────────────────────────────────────────────────────────────────

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
        'src/chains/abis.ts',
        'src/chains/idl/**',
        'src/chains/types.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
