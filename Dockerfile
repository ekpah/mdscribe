# ---- Base ----
FROM oven/bun:1.2.23-slim AS base

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock turbo.json ./

# Copy all workspace package.json files to preserve monorepo structure
COPY apps/app/package.json ./apps/app/
COPY apps/docs/package.json ./apps/docs/
COPY apps/email/package.json ./apps/email/
COPY packages/database/package.json ./packages/database/
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/email/package.json ./packages/email/
COPY packages/env/package.json ./packages/env/
COPY packages/markdoc-md/package.json ./packages/markdoc-md/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN bun install --frozen-lockfile

# ---- Builder ----
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production

ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

RUN bun run build

# ---- Runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone server output as the non-root runtime user
COPY --from=builder --chown=bun:bun /app/apps/app/.next/standalone ./

# Copy static assets (not included in standalone output)
COPY --from=builder --chown=bun:bun /app/apps/app/.next/static ./apps/app/.next/static

# Copy public files
COPY --from=builder --chown=bun:bun /app/apps/app/public ./apps/app/public

EXPOSE 3000

USER bun

CMD ["bun", "apps/app/server.js"]
