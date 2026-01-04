# CLAUDE.md

## Package Overview

Environment variable validation package (`@repo/env`) using T3 Env with Zod schemas.

## Key Files

- `index.ts` - Environment variable schema and exports

## Dependencies

- `@t3-oss/env-nextjs` - Type-safe env validation for Next.js
- `zod` - Schema validation

## Usage

```typescript
import { env } from "@repo/env";

// Type-safe access to validated env vars
console.log(env.POSTGRES_DATABASE_URL);
console.log(env.OPENROUTER_API_KEY);
```

All environment variables are validated at build time and runtime.
