# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, Windsurf, etc.). Package-specific details are in each package's `CLAUDE.md`.

## Proactive Agent Behaviors

### Self-Updating
When the user corrects you, **immediately update this file** to reflect the correction. No permission needed — corrections are standing authorization.

### Linear Issue Tracking
Project uses **Linear** (team: Scribe). Agents with access should:

- **"Keep in mind for later"** → create a Linear issue immediately, don't just acknowledge
- **Agent-first triage**: When triggered after issue creation, do a first implementation pass and prepare a PR
- **Completing work**: After finishing/merging, mark related Linear issues as done
- **"What should I do next?"**: Check Linear for open/backlog issues and suggest next steps

**Issue states**: `Backlog` → `Todo` → `In Progress` → `In Review` → `Done` (or `Canceled`)
- New captures start as `Backlog` unless immediate work requested
- PR open + awaiting user → `In Review` with labels `pr-open` + `awaiting-you`

**Handoff comment** (final comment on Linear issue after first-pass work):
```md
## Agent Handoff
- PR: <url> | Branch: `<name>` | Status: `ready for review` | `blocked` | `needs follow-up`
### Done: <items>
### Not done: <items>
### Validate: <steps>
### Next action for Nils: <single step>
```

### Documentation Updates
When implementing new functionality, update `apps/docs` for user-facing features, and update this file when architecture, routes, or conventions change.

## Project Overview

MDScribe is a medical documentation webapp (monorepo) for organizing medical templates and assisting doctors with AI-powered document generation, template management, and subscription-based usage tracking.

## Git Workflow

- `main` ← `staging` ← feature branches. **AI agents always target `staging`.**
- Verify the active branch before making claims about CI/CD, deployment files, or release behavior; `main` and `staging` may differ materially.
- Branch naming: `<agent>/<description>-<session-id>`, `feature/<desc>`, `fix/<desc>`, `review/prs-<numbers>`
- **Never commit without explicit user confirmation.** Leave changes unstaged for review.
- **No AI attribution** in commits — no `Co-Authored-By`, no model/tool names.
- **PR review**: For multiple PRs, create `review/prs-<numbers>` from `staging`, cherry-pick each, present review, wait for approval.
- After pushing/merging, check Linear and close resolved issues.

## Build Commands

```bash
bun dev                  # Dev server (port 3000)
bun run build            # Build all (Turbo)
bun run lint:affected    # Lint changed packages (preferred)
bun run test:affected    # Test changed packages (preferred)
bun run db:migrate       # Run Drizzle migrations
```

- Use `turbo run lint --filter=app` for package-scoped checks
- Avoid direct `ultracite check` / `oxlint` / `bun test` at repo level — use Turbo for caching
- When using Bun with a package-specific cwd, use `bun run --cwd <dir> <script>` or `cd <dir> && bun run <script>`; avoid `bun --cwd <dir> run <script>`
- Production deploys should run `bun run db:migrate` in CI/CD before rollout; do not rely on Docker startup migrations
- Database: `cd packages/database && bun run push|generate|dev`

## Architecture

### Monorepo Structure
- **Apps**: `apps/app` (Next.js), `apps/docs` (Fumadocs), `apps/email` (React Email), `apps/storybook`, `apps/studio`
- **Packages**: `packages/database` (Drizzle ORM), `packages/design-system` (UI), `packages/email`, `packages/env`, `packages/markdoc-md`, `packages/typescript-config`

### Core Technologies
Bun, Next.js 16 + React 19, BetterAuth + Stripe, PostgreSQL + Drizzle ORM + pgvector, OpenRouter + Langfuse + Voyage AI, Tailwind CSS v4, oRPC, Jotai + React Hook Form

### Key Architecture (details in `apps/app/CLAUDE.md`)
- **oRPC**: Base handlers (`pub`, `authed`) in `apps/app/orpc.ts`. Router in `orpc/router.ts`.
- **AI Streaming**: Unified handler in `orpc/scribe/handlers.ts` with per-document-type config. Client uses `useScribeStream` hook.
- **Auth**: BetterAuth in `auth.ts`. Server: `auth.api.getSession(...)`. Client: `useSession()`.
- **Templates**: Custom Markdoc tags + TipTap editor. 1024-dim Voyage AI embeddings for vector search.
- **DB access boundary**: App routes/components use oRPC/TanStack Query only — no direct DB helpers under `app/`.

## Code Style & Conventions

- **Linter**: Ultracite v7 with Oxlint + Oxfmt (see `.cursor/rules/ultracite.mdc`)
- **Components**: Named exports, prefer RSC, minimize `'use client'`
- **Naming**: `handle` prefix for event handlers, auxiliary verbs for booleans (`isLoading`, `hasError`)
- **TypeScript**: Type imports (`import type`), `as const`, no `any`, `for...of` over `forEach`, arrow functions
- **Toasts**: `import { toast } from 'sonner'`
- **Runtime**: Prefer Bun-native APIs over Node compatibility APIs; in Bun runtime code avoid `node:*` imports unless absolutely necessary
- **Tailwind v4**: `@import "tailwindcss"`, `@theme` in CSS, colors via design system tokens (e.g. `bg-solarized-green`), renamed utilities (`shadow-xs`, `rounded-xs`, `blur-xs`)
- **Keyboard shortcuts**: `react-hotkeys-hook` with `['meta+k', 'ctrl+k']` pattern
- **User messages**: All German user-facing text in `apps/app/lib/user-messages.ts` (`USER_MESSAGES`)

## Implementation Rules

### AI / Scribe
- Use admin-configured providers from DB — no hardcoded fallbacks
- Prompts managed in Langfuse (production/staging labels). Usage logged to `UsageEvent`.
- Context engine: Build via providers in `orpc/scribe/context`, inject single `contextXml` variable. Add new domains as separate providers, don't extend `patient_context`.
- Canonical input keys: `notes`, `diagnoseblock`, `anamnese`, `befunde` only. Legacy keys accepted only in playground hydration layer.
- Only send reasoning options when model explicitly advertises support; otherwise omit entirely.

### Provider / Model System
- Schema: `AiProvider` with `AiModel.providerId` FK. Encrypted credentials in `apiKey` column.
- Resolver: `resolveProviderModel(...)`. OpenAI-compatible requires explicit base URL — no fallbacks.
- Sync provider models into `AiModel` on creation and manual refresh. `(providerId, modelId)` as sync key. DB is authoritative.
- Playground reads models from DB, not live API fetches. Model selector uses shadcn `Select`.
- Admin settings: `/admin/settings/models` — vertical tabs `Verbindungen` + `Modelle`. Validate connectivity before creating provider.

### Template Editor
- WYSIWYG: Markdoc valid by construction — no inline validation in TipTap mode
- Source editing: Admin only (`session.user.email === env.ADMIN_EMAIL`)
- Page data centralized in `app/templates/_lib/editor-page-data.ts`. Routes under `(editor)/` with auth redirect.
- Categories: Fetch via `orpc.templates.editorContext`, pass as `categorySuggestions`.

### Misc
- Nuqs + menubar: Keep menubar auth loading client-side — async server wrapper under `NuqsAdapter` causes crashes
- License file: `LICENSE` at repo root (not `license.md`)

## Environment Variables

Database: `POSTGRES_DATABASE_URL` | Auth: `BETTER_AUTH_SECRET`, `AUTH_POSTMARK_KEY` | AI: `OPENROUTER_API_KEY`, `VOYAGE_API_KEY` | Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLUS_PRICE_ID`, `STRIPE_PLUS_PRICE_ID_ANNUAL` | Analytics: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `LANGFUSE_*`

## Documentation Lookup

Use Context7 MCP proactively for library/API docs — don't wait for the user to ask.
