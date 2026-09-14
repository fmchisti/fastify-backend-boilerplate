# syntax=docker/dockerfile:1
# Production image. Build: docker build -t api .
# @setup-if orm!=none
# Migrate:  docker run --rm --env-file .env api pnpm db:migrate:deploy
# @setup-endif
# Run:      docker run --env-file .env -p 3000:3000 api

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_HOME=/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH=$PNPM_HOME:$PATH
# @setup-if orm=prisma
# Prisma's schema engine (migrate deploy) needs OpenSSL
RUN apk add --no-cache openssl
# @setup-endif
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install
# Download packages using only the lockfile, so this layer is cached until dependencies change
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline
RUN pnpm build
# Drop dev dependencies (keeps generated clients and engines already installed)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store CI=true pnpm prune --prod --ignore-scripts

# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build /app/package.json ./package.json
RUN corepack install && chmod -R a+rX "$COREPACK_HOME"

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# @setup-if orm=drizzle
COPY --from=build /app/drizzle ./drizzle
# @setup-endif
# @setup-if orm=prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
# @setup-endif
# @setup-if storage=local
# Local uploads need a writable directory; mount a volume here in production
RUN mkdir -p /app/uploads && chown node:node /app/uploads
# @setup-endif

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

# Run node directly (not via pnpm) so SIGTERM reaches the app for graceful shutdown
CMD ["node", "dist/index.js"]
