# ──────────────────────────────────────────────────────────────────────────────
# Chainbills Backend — Dockerfile
#
# Multi-stage build (SPEC.md §15):
#   build   — installs every dependency with pnpm, generates the Prisma client,
#             compiles TypeScript, then prunes dev dependencies in place.
#   runtime — copies the pruned node_modules (which still holds the generated
#             Prisma client, since @prisma/client is a production dependency),
#             dist/ and prisma/; runs as a non-root user.
#
# node_modules must come from the build stage, not a separate install stage:
# `prisma generate` writes the client into node_modules, so an image built
# from a fresh install would start without a generated client.
#
# `prisma` (the CLI) is a production dependency so `prisma migrate deploy` is
# available at container start without a second install.
# ──────────────────────────────────────────────────────────────────────────────

FROM node:24-slim AS base
# Prisma's query engine links against libssl, which node:*-slim does not ship.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# pnpm version comes from package.json#packageManager via Corepack.
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate \
  && pnpm build \
  && pnpm prune --prod --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 chainbills \
  && useradd --system --uid 1001 --gid chainbills --home /app chainbills

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./package.json

USER chainbills

# Cloud Run and docker-compose both set PORT; the app reads it via AppConfigService.
EXPOSE 8080

# DIRECT_URL falls back to DATABASE_URL here because schema.prisma reads it
# through Prisma's own env() — the app's config default (SPEC.md §5.2) does
# not reach the Prisma CLI, so an unset DIRECT_URL would fail migrations.
# `exec` replaces the shell with `node` as PID 1, so SIGTERM from `docker stop`
# reaches Nest's shutdown hooks directly instead of being swallowed by a
# wrapping shell (SPEC.md §15: "Handles SIGTERM").
CMD ["sh", "-c", "export DIRECT_URL=\"${DIRECT_URL:-$DATABASE_URL}\" && ./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
