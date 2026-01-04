# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this app.

## App Overview

This is the main MDScribe Next.js application - a medical documentation platform with AI-powered document generation, template management, and subscription billing.

## Commands

```bash
bun dev          # Start dev server on port 3000
bun run build    # Production build
bun run lint     # Run linting
bun test         # Run Bun tests
bun test:watch   # Run tests in watch mode
bun run analyze  # Bundle analysis (ANALYZE=true)
```

## Directory Structure

```
apps/app/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (sign-in, sign-up, etc.)
│   ├── aiscribe/          # AI document generation pages
│   ├── templates/         # Template management
│   ├── admin/             # Admin dashboard
│   └── layout.tsx         # Root layout
├── orpc/                   # oRPC API handlers
│   ├── router.ts          # Main router definition
│   ├── scribe/            # AI generation handlers
│   ├── templates/         # Template CRUD + search
│   ├── documents/         # PDF parsing
│   ├── user/              # User templates & snippets
│   └── admin/             # Admin endpoints
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities
├── __tests__/             # Bun test files
├── auth.ts                # BetterAuth configuration
└── orpc.ts                # oRPC base handlers
```

## oRPC API

### Base Handlers (`orpc.ts`)
- `pub`: Public routes with database middleware
- `authed`: Authenticated routes (extends pub)

### Key Endpoints

| Route | Purpose |
|-------|---------|
| `scribeStream` | Streaming AI document generation |
| `getUsage` | User token usage tracking |
| `templates.findRelevant` | Vector similarity search |
| `documents.parseForm` | PDF form parsing |
| `user.templates.*` | User template CRUD |
| `user.snippets.*` | Text snippet management |
| `admin.*` | Admin dashboard endpoints |

### AI Streaming

Document generation uses unified streaming handler:

```typescript
// Supported document types
type DocumentType = "discharge" | "anamnese" | "diagnosis" | "physical-exam" |
                    "procedures" | "admission-todos" | "befunde" | "outpatient" | "icu-transfer";

// Client-side usage
const { completion, isLoading, complete } = useScribeStream({
  documentType: "discharge",
  onFinish: () => toast.success("Done"),
});

await complete(prompt, { model: "auto" });
```

## Authentication

Uses BetterAuth with Drizzle adapter:

```typescript
// Server-side
import { auth } from "@/auth";
const session = await auth.api.getSession({ headers: await headers() });

// Client-side
import { useSession } from "@/lib/auth-client";
const { data: session } = useSession();
```

Routes: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`

## Testing

Tests use Bun test with PGlite for isolated database:

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, createTestUser } from "@repo/database/test";

describe("my test", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await startTestServer("my-test"));
  });

  afterAll(async () => {
    await close();
  });

  test("example", async () => {
    const { user } = await createTestUser(db);
    // ... test logic
  });
});
```

## Key Dependencies

- `ai` + `@ai-sdk/anthropic` + `@openrouter/ai-sdk-provider`: AI SDK with multi-model support
- `better-auth` + `@better-auth/stripe`: Authentication with subscription billing
- `@orpc/*`: Type-safe API layer
- `langfuse`: Prompt management and observability
- `voyageai`: Vector embeddings for template search
- `nuqs`: URL search params state
- `react-hotkeys-hook`: Keyboard shortcuts

## Important Patterns

- **Server Components**: Prefer RSC, minimize `'use client'`
- **Event handlers**: Prefix with `handle` (handleClick, handleSubmit)
- **Boolean props**: Use auxiliary verbs (isLoading, hasError)
- **Toasts**: Use sonner: `toast.success()`, `toast.error()`
- **Forms**: React Hook Form with Zod validation
