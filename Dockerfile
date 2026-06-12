# ── Stage 1: install dependencies ───────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ── Stage 2: build ───────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy values so `next build` can evaluate code paths; real secrets are
# injected at runtime via ECS task definition secrets.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV REDIS_URL="redis://localhost:6379"
ENV AUTH_SECRET="build-time-placeholder"
RUN npx prisma generate && npm run build

# ── Stage 3: production runtime ──────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app

# Custom server (Next handler + Socket.io) runs via tsx, so we ship
# node_modules (incl. the generated Prisma client from the build stage)
# rather than only the standalone bundle.
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/.next ./.next
COPY --from=builder --chown=app:app /app/public ./public
COPY --chown=app:app package.json next.config.ts tsconfig.json ./
COPY --chown=app:app server ./server
COPY --chown=app:app lib ./lib
COPY --chown=app:app prisma ./prisma

USER app
EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npx", "tsx", "server/index.ts"]
