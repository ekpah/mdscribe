# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package Overview

This is the `@repo/database` package - the Drizzle ORM layer for MDScribe. It uses PostgreSQL with pgvector extension for template embeddings in all environments.

## Commands

```bash
# Start Drizzle Studio for database inspection
bun dev

# Generate new migrations
bun run generate

# Run migrations
bun run migrate

# Push schema changes directly (development)
bun run push

# Apply schema + idempotent seed to local dev database
bun run bootstrap
```

## Architecture

### Key Files
- `schema.ts` - Drizzle schema definitions for all tables
- `client.ts` - Database client (postgres-js)
- `types.ts` - Auto-generated TypeScript types from schema
- `init-schema.ts` - SQL initialization used by test helpers
- `test.ts` - Testing utilities
- `drizzle.config.ts` - Drizzle Kit configuration

### Database Client

The client uses postgres-js with one shared process-local client:

```typescript
// All environments:
// - Requires POSTGRES_DATABASE_URL
// - Uses drizzle-orm/postgres-js
// - Shared global singleton client to avoid reconnect churn in dev
```

### Schema Tables

| Table | Purpose |
|-------|---------|
| `user` | Core user with BetterAuth fields, Stripe integration |
| `account` | OAuth accounts linked to users |
| `session` | User sessions with token, expiration, IP tracking |
| `verification` | Email verification tokens |
| `template` | Medical templates with 1024-dim vector embeddings |
| `subscription` | Stripe subscription data |
| `usageEvent` | Token usage tracking per AI generation |
| `textSnippet` | User text shortcuts (unique per userId+key) |
| `favourites` | Many-to-many user↔template junction |

### Custom Vector Type

Templates use a custom Drizzle type for Voyage AI embeddings:

```typescript
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return "vector(1024)"; },
  toDriver(value: number[]): string { return `[${value.join(",")}]`; },
  fromDriver(value: string): number[] { /* parse "[1,2,3]" */ }
});
```

## Exports

```typescript
// Database client
import { database } from "@repo/database/client";

// Schema tables
import { user, template, subscription, usageEvent, ... } from "@repo/database";

// Types
import type { User, Template, NewUser, NewTemplate, ... } from "@repo/database";

// Drizzle operators
import { eq, and, or, sql, inArray, ... } from "@repo/database";
```

## Testing

```typescript
import { startTestServer, createTestUser } from "@repo/database/test";

const { db, close } = await startTestServer("my-test");
const { user, session } = await createTestUser(db, { email: "test@example.com" });
// ... run tests ...
await close();
```

## Environment Variables

```
POSTGRES_DATABASE_URL  # Required in all environments
POSTGRES_DATABASE_URL_TEST  # Optional override used by @repo/database/test
```

## Important Notes

- Package is marked `server-only` - cannot be imported in client components
- Template embeddings are 1024-dimensional (Voyage AI compatible)
- Local development uses a real PostgreSQL instance (recommended via `docker-compose.dev-db.yml`)
- Relations are defined bidirectionally for Drizzle query builder support
