# ---- Base ----
FROM oven/bun:1.3.14-slim AS base

# ---- Pruner ----
FROM base AS pruner
WORKDIR /app

COPY . .

# Generate a pruned monorepo containing only app + its transitive workspace deps.
RUN bunx --bun turbo@2.7.1 prune app --docker --out-dir=out

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app

# Install dependencies from the pruned workspace manifests only.
COPY --from=pruner /app/out/json/ ./
RUN bun install --frozen-lockfile

# ---- Builder ----
# Use Node for Next.js build compatibility (Next 16 build workers rely on
# worker_threads options that Bun doesn't fully implement yet).
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ ./

ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=3072"

ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

# Build only the app (docs is deployed separately).
# Run Next directly under Node to avoid Bun worker_threads build issues.
RUN cd apps/app && node ../../node_modules/next/dist/bin/next build --webpack

# ---- Runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Docker auto-sets HOSTNAME to the container ID; Next.js standalone binds to
# `process.env.HOSTNAME || '0.0.0.0'`, so without this the server only listens
# on the container's eth0 IP and the loopback healthcheck fails.
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Copy standalone server output as the non-root runtime user
COPY --from=builder --chown=bun:bun /app/apps/app/.next/standalone ./

# Copy static assets (not included in standalone output)
COPY --from=builder --chown=bun:bun /app/apps/app/.next/static ./apps/app/.next/static

# Copy public files
COPY --from=builder --chown=bun:bun /app/apps/app/public ./apps/app/public

# Include project and third-party licensing materials in every runtime image.
COPY --from=pruner --chown=bun:bun /app/LICENSE ./LICENSE
COPY --from=pruner --chown=bun:bun /app/NOTICE ./NOTICE
COPY --from=pruner --chown=bun:bun /app/THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md

# Keep the database package plus installed dependencies in the runtime image so
# Coolify can run the post-deploy Drizzle migration hook.
COPY --from=builder --chown=bun:bun /app/packages/database ./packages/database
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
EXPOSE 3000

USER bun

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/api/healthcheck || exit 1

CMD ["bun", "apps/app/server.js"]
