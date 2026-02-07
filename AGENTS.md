# AGENTS.md

This file provides guidance to AI coding agents working on this repository (Claude Code, Cursor, Copilot, Windsurf, etc.).

## Proactive Agent Behaviors

### Self-Updating
**When the user corrects you — whether about code patterns, architecture, conventions, or any project-specific knowledge — you MUST update this file to reflect the correction.** This ensures all agents learn from every interaction, not just the current session.

- After receiving a correction, immediately update the relevant section of this file (or add a new one)
- If a correction contradicts existing content, replace the outdated information
- Keep updates concise and factual — record *what* the correct approach is, not the story of how you learned it
- If the correction is tool-specific (e.g., only relevant to Claude Code), note that in the update
- Do not ask for permission to update this file — corrections are standing authorization to edit it

### Linear Issue Tracking
The project uses **Linear** (team: Scribe) for issue tracking. Agents with Linear access should:

- **"Keep in mind for later"**: When the user mentions something to do later, to remember, or to keep in mind — create a Linear issue for it immediately. Don't just acknowledge it; persist it in Linear so it doesn't get lost.
- **"What should I do next?"**: When the user asks what to work on, check Linear for open issues assigned to them or in the backlog, and suggest next steps.
- **Completing work**: After finishing a task that resolves a Linear issue, mark the issue as done. If a push or PR merge resolves issues, check Linear and close them.

### Documentation Updates
When implementing new functionality, update relevant documentation:

- **User-facing features**: Update `apps/docs` if the feature is documented there, or note the need for docs
- **Architecture changes**: Update the Architecture section of this file if new packages, routes, or patterns are introduced
- **API changes**: Update the oRPC API Structure section when routes are added/modified
- **New conventions**: If a new pattern is established during implementation, document it in Code Style & Conventions

## Project Overview

MDScribe is a medical documentation webapp built as a monorepo that helps organize medical templates and assists doctors in their day-to-day work. It features AI-powered document generation, template management, and subscription-based usage tracking.

## Git Workflow

**Branching Strategy:**
- `main`: Production branch - only receives merges from `staging`
- `staging`: Integration branch - all feature branches merge here first
- Feature branches: Created from `staging` for individual features/fixes

**For AI Agents:**
- All changes by AI agents MUST target the `staging` branch
- Create feature branches from `staging`: `git checkout -b feature/my-feature origin/staging`
- Open PRs against `staging`, never directly against `main`
- Only `staging` is merged into `main` after testing and review

**Branch naming conventions:**
- AI agent branches: `<agent>/<description>-<session-id>` (e.g. `claude/fix-auth-abc123`, `cursor/add-feature-xyz`)
- Feature branches: `feature/<description>`
- Bugfix branches: `fix/<description>`
- Review branches: `review/prs-<numbers>` (e.g. `review/prs-74-75-76`)

**PR Review Workflow:**
- When asked to review multiple PRs together, create a local `review/prs-<numbers>` branch from `staging`
- Cherry-pick each PR as a separate commit with a clean, concise commit message
- Present the review, then wait for approval before merging into `staging`
- After merge, close the original PRs with a comment noting they were merged via the review branch

**Committing Rule:**
- NEVER commit changes without explicit user confirmation
- When making edits or improvements, leave changes unstaged for the user to review
- Only stage and commit when the user explicitly asks to commit, merge, or confirms the changes look good

**Post-Commit:**
- After pushing or finalizing work (PR merge, push), check Linear for related issues
- Mark relevant Linear issues as done when the commits fully resolve them

## Build Commands

Core development commands:
- `bun dev`: Start development server (Next.js on port 3000)
- `bun run build`: Build all packages using Turbo
- `bun run lint`: Run linting across all packages using Biome
- `bun run test`: Run tests via Turbo
- `bun run migrate`: Run Drizzle database migrations

Database operations:
- `cd packages/database && bun run push`: Push schema changes to database
- `cd packages/database && bun run generate`: Generate new migrations
- `cd packages/database && bun dev`: Start Drizzle Studio for database inspection

Analysis and maintenance:
- `bun run analyze`: Run bundle analysis (set ANALYZE=true)
- `bun run knip`: Check for unused dependencies
- `bun run bump-deps`: Update dependencies (excludes react-day-picker)

## Architecture

### Monorepo Structure
- **Apps**: `apps/app` (Next.js main app), `apps/docs` (Fumadocs), `apps/email` (React Email), `apps/storybook`, `apps/studio`
- **Packages**: `packages/database` (Drizzle ORM), `packages/design-system` (UI components), `packages/email`, `packages/env`, `packages/markdoc-md`, `packages/typescript-config`

### Core Technologies
- **Runtime**: Bun (package manager and runtime)
- **Framework**: Next.js 16 with App Router and React 19
- **Authentication**: BetterAuth with Stripe integration for subscriptions
- **Database**: PostgreSQL with Drizzle ORM (PGlite for local dev, Neon serverless for production) and pgvector for embeddings
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
    get: getTemplateHandler,         // Public: get template by ID
    findRelevant: findRelevantTemplateHandler,  // Vector similarity search
    favourites: getFavouritesHandler,  // Get user's favorited templates
    authored: getAuthoredHandler,      // Get user's authored templates
    create: createTemplateHandler,     // Create new template
    update: updateTemplateHandler,     // Update template (author only)
    addFavourite: addFavouriteHandler,
    removeFavourite: removeFavouriteHandler,
  },
  documents: {
    parseForm: parseFormHandler,   // PDF form parsing with AI enhancement
  },
  user: {
    recentActivity: getRecentActivityHandler,  // User's recent usage events
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
- **Server**: `apps/app/auth.ts` - BetterAuth configuration with Drizzle adapter
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
- **Renamed utilities**: `shadow-sm` -> `shadow-xs`, `rounded-sm` -> `rounded-xs`, `blur-sm` -> `blur-xs`
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
- **AI Scribe context engine**: Build context in `apps/app/orpc/scribe/context` via providers, then inject a single `contextXml` prompt variable.
- **Canonical scribe input keys**: Use only `notes`, `diagnoseblock`, `anamnese`, `befunde` for patient/form input payloads.
- **Do not use legacy keys**: `dischargeNotes`, `procedureNotes`, and `vordiagnosen` are deprecated and should not be produced or consumed.
- **Context extensibility**: Add new context domains (e.g. template/institution/guideline/evidence) as separate providers rather than extending `patient_context`.

## Documentation Lookup

When you need library/API documentation, code generation help, or setup/configuration steps, use Context7 MCP (or equivalent documentation tools) proactively — don't wait for the user to ask.
