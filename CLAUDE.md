# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MDScribe is a medical documentation webapp built as a monorepo that helps organize medical templates and assists doctors in their day-to-day work. It features AI-powered document generation, template management, and subscription-based usage tracking.

## Git Workflow

**Branching Strategy:**
- `main`: Production branch - only receives merges from `staging`
- `staging`: Integration branch - all feature branches merge here first
- Feature branches: Created from `staging` for individual features/fixes

**For AI Agents (Claude Code, etc.):**
- All changes by AI agents MUST target the `staging` branch
- Create feature branches from `staging`: `git checkout -b feature/my-feature origin/staging`
- Open PRs against `staging`, never directly against `main`
- Only `staging` is merged into `main` after testing and review

**Branch naming conventions:**
- AI agent branches: `claude/<description>-<session-id>`
- Feature branches: `feature/<description>`
- Bugfix branches: `fix/<description>`

## Build Commands

Core development commands:
- `bun dev`: Start development server (Next.js on port 3000)
- `bun run build`: Build all packages using Turbo
- `bun run lint`: Run linting across all packages using Biome
- `bun run test`: Run tests via Turbo
- `bun run migrate`: Run Prisma database migrations and generate client

Database operations:
- `cd packages/database && bunx prisma format && bunx prisma generate && bunx prisma db push`: Full database setup
- `cd packages/database && docker compose up -d`: Start local PostgreSQL + Neon proxy containers

Analysis and maintenance:
- `bun run analyze`: Run bundle analysis (set ANALYZE=true)
- `bun run knip`: Check for unused dependencies
- `bun run bump-deps`: Update dependencies (excludes react-day-picker)

## Architecture

### Monorepo Structure
- **Apps**: `apps/app` (Next.js main app), `apps/docs` (Fumadocs), `apps/email` (React Email), `apps/storybook`, `apps/studio`
- **Packages**: `packages/database` (Prisma), `packages/design-system` (UI components), `packages/email`, `packages/env`, `packages/markdoc-md`, `packages/typescript-config`

### Core Technologies
- **Runtime**: Bun (package manager and runtime)
- **Framework**: Next.js 16 with App Router and React 19
- **Authentication**: BetterAuth with Stripe integration for subscriptions
- **Database**: PostgreSQL with Prisma 7 (client engine, bun runtime) and pgvector for embeddings
- **AI Integration**: OpenRouter for model access, Langfuse for prompt management, Voyage AI for embeddings
- **Styling**: Tailwind CSS v4 with design system extending "ultracite" configuration
- **API**: oRPC for type-safe client-server communication
- **State Management**: Jotai for global state, React Hook Form for forms

### Database Schema
Key models: User, Template (with 1024-dim vector embeddings), Subscription, UsageEvent, TextSnippet, Session, Account, Verification

### oRPC API Structure

The API uses oRPC with two base handlers in `apps/app/orpc.ts`:
- `pub`: Public routes with database access (`os.use(dbProviderMiddleware)`)
- `authed`: Authenticated routes (`pub.use(requiredAuthMiddleware)`)

Router structure in `apps/app/orpc/router.ts`:
```typescript
router = {
  scribe: scribeHandler,           // Single AI generation
  scribeStream: scribeStreamHandler, // Streaming AI generation (unified for all document types)
  getUsage: getUsageHandler,       // Usage tracking
  templates: {
    ...publicTemplatesHandler,
    findRelevant: findRelevantTemplateHandler,  // Vector similarity search
  },
  documents: {
    parseForm: parseFormHandler,   // PDF form parsing with AI enhancement
  },
  user: {
    templates: userTemplatesHandler,
    snippets: snippetsHandler,
  },
  admin: {
    users: adminUsersHandler,
    usage: adminUsageHandler,
    embeddings: {
      stats: getEmbeddingStatsHandler,
      migrate: migrateEmbeddingsHandler,
    },
  },
}
```

### AI Streaming Endpoints

All AI streaming is handled by a unified oRPC handler in `apps/app/orpc/scribe/handlers.ts`:

```typescript
// Document types supported by the unified streaming handler
type DocumentType = "discharge" | "anamnese" | "diagnosis" | "physical-exam" |
                    "procedures" | "admission-todos" | "befunde" | "outpatient" | "icu-transfer";

// Configuration for each document type in apps/app/orpc/scribe/config.ts
const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> = {
  discharge: {
    promptName: "Inpatient_discharge_chat",
    modelConfig: { thinking: true, thinkingBudget: 12_000, maxTokens: 20_000, temperature: 0.3 },
    requiredFields: ["prompt"],
  },
  // ... other document types
};

// Client-side usage with useScribeStream hook (apps/app/hooks/use-scribe-stream.ts)
const { completion, isLoading, complete, stop } = useScribeStream({
  documentType: "discharge",
  onFinish: () => toast.success("Generated successfully"),
  onError: (error) => toast.error(error.message),
});

// Trigger generation
await complete(promptText, { model: "auto", audioFiles: [] });
```

### Authentication Architecture
- **Server**: `apps/app/auth.ts` - BetterAuth configuration with Prisma adapter
- **Client**: `apps/app/lib/auth-client.ts` - React hooks and client functions
- **Routes**: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
- **Server usage**: `auth.api.getSession({ headers: await headers() })`
- **Client usage**: `useSession()` hook from auth client

### Template System
- **Custom Markdoc**: Extended with medical-specific tags (Case, Info, Score, Switch)
- **TipTap Editor**: Rich text editing with custom medical node extensions
- **Vector Search**: Template embeddings for relevant template discovery via Voyage AI

## Code Style & Conventions

### Formatting
- **Linter**: Biome extending "ultracite" configuration (see `.cursor/rules/ultracite.mdc` for full rules)
- **Components**: Named exports, prefer React Server Components, minimize 'use client'
- **Event Handlers**: Prefix with "handle" (handleClick, handleSubmit)
- **Boolean Props**: Use auxiliary verbs (isLoading, hasError)
- **Toasts**: Use sonner: `import { toast } from 'sonner'`

### TypeScript Standards
- TypeScript 5.9+ features
- Prefer type imports: `import type { Type } from 'module'`
- Use `as const` for readonly values
- Avoid `any` - use proper typing
- Use `for...of` instead of `Array.forEach`
- Use arrow functions instead of function expressions

### Tailwind CSS v4
- **Import syntax**: `@import "tailwindcss"` (not `@tailwind` directives)
- **CSS-first config**: Use `@theme` directive in CSS instead of `tailwind.config.js`
- **Theme variables**: `--color-*`, `--font-*`, `--spacing-*`, etc.
- **Container queries**: `@sm:`, `@md:`, `@max-md:` built-in (no plugin needed)
- **Renamed utilities**: `shadow-sm` → `shadow-xs`, `rounded-sm` → `rounded-xs`, `blur-sm` → `blur-xs`
- **Colors**: Reference design system colors directly (e.g., `bg-solarized-green`), not via CSS variables

### Keyboard Shortcuts
Use `react-hotkeys-hook` with cross-platform support:
```typescript
import { useHotkeys } from 'react-hotkeys-hook';
import { isMac } from '@/lib/isMac';

useHotkeys(['meta+k', 'ctrl+k'], (e) => {
  e.preventDefault();
  e.stopPropagation();
  // handler logic
});
```

## Environment Setup

Required environment variables (see turbo.json):
- Database: `POSTGRES_DATABASE_URL`
- Auth: `BETTER_AUTH_SECRET`, `AUTH_POSTMARK_KEY`
- AI: `OPENROUTER_API_KEY`, `VOYAGE_API_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLUS_PRICE_ID`, `STRIPE_PLUS_PRICE_ID_ANNUAL`
- Analytics: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `LANGFUSE_*`
- Flags: `FLAGS_SECRET`

## Important Implementation Notes

- **AI Models**: Use OpenRouter provider for multi-model support (Claude, Gemini, GLM-4)
- **Prompts**: Managed in Langfuse with production/staging labels
- **Usage Tracking**: Token counts logged to `UsageEvent` table per generation
- **Vector Search**: Templates use 1024-dim embeddings (Voyage AI compatible)
- **Email Templates**: Located in `packages/email/templates/` using React Email
- **Bundle Analysis**: `ANALYZE=true bun build` in apps/app