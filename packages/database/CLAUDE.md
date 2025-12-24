# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

This is the `@repo/database` package - the Prisma ORM layer for MDScribe. It uses PostgreSQL with the Neon serverless adapter and pgvector extension for template embeddings.

## Commands

```bash
# Start local PostgreSQL + Neon proxy containers
pnpm dev

# Deploy migrations and generate Prisma client (production build)
pnpm build

# Generate Prisma client only (runs automatically on postinstall if DB URL exists)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name <migration_name>

# Push schema changes without migration (development only)
npx prisma db push

# Format schema file
npx prisma format
```

## Architecture

### Database Setup
- **Local Development**: Docker Compose runs PostgreSQL 17 on port 5432 and a Neon HTTP proxy on port 4444
- **Production**: Neon serverless PostgreSQL
- **Adapter**: Uses `@prisma/adapter-neon` with `PrismaNeon` for serverless compatibility

### Prisma Configuration
- Schema: `prisma/schema.prisma`
- Generated client output: `prisma/generated/`
- Engine type: `client` (not binary) with `bun` runtime
- Preview features: `postgresqlExtensions` for pgvector

### Key Models
- **User**: Core user with BetterAuth fields, linked to subscriptions, templates, and usage tracking
- **Template**: Medical document templates with `Unsupported("vector(1024)")` embedding field for semantic search
- **Subscription**: Stripe subscription data with plan, status, and billing period
- **UsageEvent**: Token usage tracking per user with event name and timestamp
- **TextSnippet**: User text shortcuts with unique `[userId, key]` constraint

### Exports
The package exports:
- `database`: Singleton PrismaClient instance
- Type exports for all models: `User`, `Template`, `Subscription`, `Account`, `Session`, `Verification`, `UsageEvent`, `Prisma`, `PrismaClient`

## Environment Variables

```
POSTGRES_DATABASE_URL  # Full connection string (required)
```

Local development URL: `postgres://postgres:postgres@localhost:5432/main` (via Neon proxy: port 4444)

## Important Notes

- Package is marked `server-only` - cannot be imported in client components
- Template embeddings use 1024-dimensional vectors (Voyage AI compatible)
- Migrations are in `prisma/migrations/` - do not modify existing migration files
- The Neon proxy is required locally to simulate Neon's HTTP-based connection pooling
