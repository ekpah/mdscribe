# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package Overview

This is the `@repo/database` package - the Drizzle ORM layer for MDScribe. It uses PostgreSQL with pgvector extension for template embeddings, with dual runtime support:
- **Local Development**: PGlite (in-memory PostgreSQL)
- **Production**: PostgreSQL via node-postgres (`pg`)

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
```

## Architecture

### Key Files
- `schema.ts` - Drizzle schema definitions for all tables
- `client.ts` - Database client with dual runtime (PGlite/node-postgres)
- `types.ts` - Auto-generated TypeScript types from schema
- `init-schema.ts` - SQL initialization for PGlite
- `test.ts` - Testing utilities
- `drizzle.config.ts` - Drizzle Kit configuration

### Database Client

The client automatically detects the environment:

```typescript
// Local development: Uses PGlite (in-memory)
// - No external database required
// - Fast startup, isolated per session
// - Schema auto-initialized on startup

// Production: Uses node-postgres (pg)
// - Connection pooling via pg Pool
// - Requires POSTGRES_DATABASE_URL
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
import { database } from "@repo/database";

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
POSTGRES_DATABASE_URL  # Required for production, optional for local dev
```

## Important Notes

- Package is marked `server-only` - cannot be imported in client components
- Template embeddings are 1024-dimensional (Voyage AI compatible)
- PGlite uses in-memory mode to avoid file lock conflicts with Next.js HMR
- Relations are defined bidirectionally for Drizzle query builder support
