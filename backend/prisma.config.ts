// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Prisma CLI config
//
// Prisma 7 dropped the `url`/`directUrl` fields from `datasource db {}` in
// schema.prisma. The runtime client picks up its connection through the pg
// driver adapter in PrismaService, but the CLI (`prisma migrate`, `generate`,
// `deploy`) still needs to know where the database is — that lookup now lives
// here. DIRECT_URL is preferred for migrations (bypasses pgbouncer / poolers);
// DATABASE_URL is the fallback for local dev where both point at the same
// server.
// ──────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
