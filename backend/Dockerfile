# ──────────────────────────────────────────────────────────────────────────────
# Chainbills Backend — Dockerfile
#
# Multi-stage build (SPEC.md §15): `deps` installs every dependency once,
# `build` compiles TypeScript and generates the Prisma client, `runtime` is
# the small final image — prod node_modules + dist/ + prisma/ only, running
# as a non-root user. `prisma` (the CLI) stays a regular dependency (see
# package.json) specifically so `prisma migrate deploy` is available at
# container start without a second install step.
# ──────────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
# Prisma's query-engine binary links against libssl; node:22-slim does not
# ship it, and `prisma generate` below cannot pick the right engine target
# without it.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Same libssl requirement as the build stage, needed here for the query
# engine at request time and for `prisma migrate deploy` in CMD below.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 chainbills \
  && useradd --system --uid 1001 --gid chainbills --home /app chainbills

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./package.json

USER chainbills

# Cloud Run and docker-compose both set PORT; the app reads it via AppConfigService.
EXPOSE 8080

# `exec` replaces the shell with `node` as PID 1, so SIGTERM from `docker stop`
# reaches Nest's shutdown hooks directly instead of being swallowed by a
# wrapping shell (SPEC.md §15: "Handles SIGTERM").
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
