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
- CI workflows: keep a single GitHub Action workflow for PR checks; add checks (for example `knip`) to that PR workflow instead of creating extra push-only workflows.

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
- Coolify Dockerfile deploys should use a `Post-deployment` hook for DB migrations: `cd /app/packages/database && bunx drizzle-kit migrate --config=drizzle.config.ts`
- Do not add Docker startup migration entrypoints or bundled migration runners unless the user explicitly asks for that tradeoff
- Keep `packages/database` in the final runtime image so the Coolify post-deployment hook can read `drizzle.config.ts` and the checked-in `drizzle/` SQL files
- Database: `cd packages/database && bun run push|generate|dev`

## Architecture

### Monorepo Structure
- **Apps**: `apps/app` (Next.js), `apps/docs` (Fumadocs), `apps/email` (React Email), `apps/storybook`, `apps/studio`
- **Packages**: `packages/database` (Drizzle ORM), `packages/design-system` (UI), `packages/email`, `packages/env`, `packages/markdoc-md`, `packages/typescript-config`

### Core Technologies
Bun, Next.js 16 + React 19, BetterAuth + Stripe, PostgreSQL + Drizzle ORM + pgvector, OpenRouter + Langfuse + Voyage AI, Tailwind CSS v4, oRPC, Jotai + React Hook Form

### Key Architecture (details in `apps/app/CLAUDE.md`)
- **oRPC**: Base handlers (`pub`, `authed`) in `apps/app/orpc.ts`. Router in `orpc/router.ts`.
- **AI Streaming**: Unified handler modules live in `orpc/scribe/handlers/`. Prompt composition lives in `orpc/scribe/prompts`, context composition lives in `orpc/scribe/context`. Client uses `useScribeStream` hook.
- **Auth**: BetterAuth in `auth.ts`. Server: `auth.api.getSession(...)`. Client: `useSession()`.
- **Auth API calls**: Prefer direct `auth.api.*` calls where used; avoid one-off wrapper helpers unless they provide shared behavior beyond simple forwarding.
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
- Prompt text fragments live under `apps/app/orpc/scribe/prompts/core/` and `apps/app/orpc/scribe/prompts/families/` as plain strings. Prefer direct multiline literals in each family entry file (usually `index.ts`) and avoid unnecessary string composition. Keep harness wiring in `apps/app/orpc/scribe/prompts/definitions/` and keep `prompts/registry.ts` as a thin lookup/registry layer.
- Any prompt fragment reused across families (for example shared system-role builders or template-usage instructions) must live in `apps/app/orpc/scribe/prompts/core/`, not in `families/*/shared`.
- Keep family folders lean: avoid `shared/` subfolders under individual families; move reusable fragments into `prompts/core/` and keep family folders focused on family-specific fragments only.
- In `prompts/core/`, it is acceptable to group multiple shared XML-tag fragments in a single module when it materially reduces file/folder sprawl and preserves prompt behavior.
- Avoid tiny non-semantic prompt files (for example one-line `input-label` wrappers or pure alias files); inline these constants into the nearest meaningful parent prompt module instead.
- Avoid duplicated nested family paths such as `families/<name>/<name>/...`; keep fragments directly under `families/<name>/...` with an optional `index.ts` family entry.
- For prompt families that use XML-structured instructions, default to one family entry module with direct tag literals. Split into extra files only when text is reused across families or a single file becomes meaningfully harder to scan.
- Prefer direct multiline template literals for static prompt text and fixed-size section composition. Use array joins only when list length is data-driven or meaningfully dynamic.
- Avoid family-local “guidance/sections/process” split files when they only hold static one-off strings; inline those into the family entry module instead.
- Context lives under `apps/app/orpc/scribe/context/` split by source domain (`patient`, `template`, `user`). Each domain owns its own guidance and composition, and the scribe flow injects a single combined `contextXml` variable.
- Keep `context/template/compose.ts` minimal (selected-template reference formatting only). Keep template-context rendering/injection logic in `context/template/guidance.ts` and `context/index.ts` to avoid duplicated composition paths.
- User prompt assembly (date/context/task ordering plus template-usage guidance) is centralized in `apps/app/orpc/scribe/context/` via the shared context user-prompt envelope; prompt registry entries should call that helper instead of hand-building user prompt order.
- Template-capable harnesses (currently discharge, icu-transfer, procedures) use context-side template guidance resolution: inject built-in fallback template guidance only when `<template_context>` is missing, and let real template context replace fallback automatically.
- Keep built-in fallback template content in `apps/app/orpc/scribe/context/template/fallback-templates/` (including anamnese/discharge/icu-transfer/procedures) and resolve these via context template fallback helpers (rather than embedding fallback template strings directly in family prompt modules).
- Canonical input keys: `notes`, `diagnoseblock`, `anamnese`, `befunde` only. Legacy keys accepted only in playground hydration layer.
- Built-in `/aiscribe/*` routes keep their hardcoded UI as fallback, but can now prefer DB-backed overrides by fixed slugs (`builtin-discharge`, `builtin-er`, `builtin-icu`, `builtin-outpatient`, `builtin-procedures`, `builtin-diagnoseblock`) that route through custom-form execution when present and enabled.
- When refactoring input UIs, treat the production `/aiscribe` inputs as the canonical component. Playground/admin input tabs should reuse that component (or a direct extraction of it) instead of introducing a parallel simplified variant.
- User-facing wording for these custom pages is `AI Textbausteine` / `AI Text`, not `AI Forms`.
- Custom AI Textbausteine live in `AiScribeFormConfig`, are managed from `/admin/settings/models` in the `AI Textbausteine` tab, render on `/aiscribe/custom/[slug]`, use a path auto-derived from the name, and currently always use the full clinical context inputs (`notes`, `diagnoseblock`, `anamnese`, `befunde`). The admin/public APIs for these forms should stay minimal: no configurable input preset and no per-form temperature / max-tokens / thinking-budget fields unless explicitly reintroduced. In that admin UI, use the searchable `ModelSelector`, label the model field `KI-Modell`, keep the prompt field label `Basis-Prompt`, require an explicit confirmation step before deletion, and keep the cards compact: there is no separate `/aiscribe/custom/...` path box, the title itself is the public link with an external-link icon only when the entry is enabled, prompt/template/model metadata should use a two-column layout with labels on the left and values on the right, and the enabled state in the overview card must be a real inline `Aktiviert` switch that can be changed without opening the edit dialog. Delete confirmation in the card must reserve stable space so the UI does not jump when switching between trash icon and confirm buttons. If an AI Textbaustein is disabled, its public `/aiscribe/custom/[slug]` link must render inactive because the route returns 404.
- Only send reasoning options when model explicitly advertises support; otherwise omit entirely.

### Provider / Model System
- Schema: `AiProvider` with `AiModel.providerId` FK. Encrypted credentials in `apiKey` column.
- Resolver: `resolveProviderModel(...)`. OpenAI-compatible requires explicit base URL — no fallbacks.
- Sync provider models into `AiModel` on creation and manual refresh. `(providerId, modelId)` as sync key. DB is authoritative.
- Playground reads models from DB, not live API fetches. Model selector uses shadcn `Select`.
- Admin settings: `/admin/settings/models` — vertical tabs `Verbindungen` + `Modelle`. Validate connectivity before creating provider.

### Template Editor
- WYSIWYG: Inline Markdoc validation in TipTap mode (red squiggles + hover errors); block save when Markdoc validation has errors
- Source editing: Admin only (`session.user.email === env.ADMIN_EMAIL`)
- Page data centralized in `app/templates/_lib/editor-page-data.ts`. Routes under `(editor)/` with auth redirect.
- Categories: Fetch via `orpc.templates.editorContext`, pass as `categorySuggestions`.
- Template examples: Up to 10 final-output examples per template are stored in `TemplateExample` and edited in the template editor.
- Collections: User-managed template collections via `orpc.user.collections.*` with `TemplateCollection` / `TemplateCollectionTemplate` tables.

### Misc
- Nuqs + menubar: Keep menubar auth loading client-side — async server wrapper under `NuqsAdapter` causes crashes
- License file: `LICENSE` at repo root (not `license.md`)

## Environment Variables

Database: `POSTGRES_DATABASE_URL` | Auth: `BETTER_AUTH_SECRET`, `AUTH_POSTMARK_KEY` | AI: `OPENROUTER_API_KEY`, `VOYAGE_API_KEY` | Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLUS_PRICE_ID`, `STRIPE_PLUS_PRICE_ID_ANNUAL` | Analytics: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `LANGFUSE_*`

## Documentation Lookup

Use Context7 MCP proactively for library/API docs — don't wait for the user to ask.
