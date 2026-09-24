// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Vitest e2e test config
//
// Runs test/**/*.e2e-spec.ts against a real Postgres (`docker compose up -d
// postgres`). Kept separate from vitest.config.ts so unit runs stay
// dependency-free. Files run sequentially because they share one database.
// ──────────────────────────────────────────────────────────────────────────────

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    passWithNoTests: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
