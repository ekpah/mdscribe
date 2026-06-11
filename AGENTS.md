# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, Windsurf, etc.). Package-specific details are in each package's `CLAUDE.md`.

## Proactive Agent Behaviors

### Self-Updating
When the user corrects you, **immediately update this file** to reflect the correction. No permission needed — corrections are standing authorization.
- If the user states local infrastructure status (for example, "it is running"), treat that as source of truth and continue from that state.
- If the user refers to "pi agent" in provider/API architecture discussions, they mean the Pi Agent used by OpenClaw, not Pydantic AI.

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

### Feature Implementation Checklist
When implementing new functionality, deliver the complete feature rather than only one layer of it:
- Implement the feature end to end across the relevant frontend, oRPC/API handlers, data access boundaries, auth/authorization checks, usage-event logging, and billing/entitlement guards.
- Add or update focused unit tests for changed behavior, and add E2E coverage for major user-facing workflows.
- Update `apps/docs` for user-facing features, and update this file when architecture, routes, or conventions change.
- For every new feature, add a React Email user-notification draft matching the existing marketing draft pattern (template in `packages/email/templates`, preview in `apps/email/emails`, registered in `packages/email/drafts.tsx`; for example the Reha-Antrag announcement), and reference it in the PR or handoff. For small fixes, explicitly note that no announcement is needed.
- Admin bulk-send actions for email drafts must be restricted by draft category, not individual draft id: marketing broadcasts may target any `category: "marketing"` draft, and must require an explicit typed confirmation phrase before sending.
- Marketing broadcast emails must not use demo recipient names such as `Dr. Max Mustermann`; use generic greetings like `Hallo,` unless per-recipient personalization is explicitly implemented.
- The AI Textbausteine announcement email specifically must always use the generic greeting `Hallo,` and must not render a `userName`, including selected-user test sends.
- Admin test-send actions for email drafts must select an existing user and render personalization from that user's profile; do not accept arbitrary raw recipient email addresses for test sends.

### Frontend Corrections
- Canvas-backed components need actual CSS color values, not Tailwind token names. For `LiveWaveform`, prefer inherited `text-*` color and omit `barColor`; passing values like `"solarized-base2"` is invalid for `CanvasRenderingContext2D.fillStyle` and can leave the internal fade gradient as the fill style.
- If a matching component exists in `packages/design-system/components/ui`, use and fix that shared component instead of keeping a playground-local duplicate.
- `/admin/input-playground` is now the admin audio playground: keep it focused on recording audio, switching the transcription model, and displaying the transcript. Audio rows should keep playback controls simple: no speed/options button and no multi-track `AudioPlayerProvider`; each recorded audio row should own its playback state, one play/pause button, and one scrubber.
- Audio scrubbers must never pass `NaN` or `Infinity` to `HTMLMediaElement.currentTime`; sanitize unresolved media duration/time values before seeking.
- Firefox records MediaRecorder audio as WebM without reliable duration metadata; for local recorded blobs, prefer Web Audio (`decodeAudioData` + `AudioBufferSourceNode`) over media-element `currentTime` hacks so seeking/replay works in Firefox and Chromium/Edge before copying back into production inputs.
- Recorded audio submission preserves the original browser recording plus optional truthful fallbacks such as PCM WAV. Provider adapters must choose the right variant per provider/model; never relabel WebM/MP4 bytes as `audio/wav`.
- OpenRouter model sync must query `output_modalities=all` so STT/transcription models are listed, but do not infer, parse, or store model modalities. Admins choose compatible models for each global default slot.
- OpenRouter speech-to-text uses `/api/v1/audio/transcriptions` with JSON `input_audio: { data, format }`; do not send multipart `FormData`. Use normal chat/audio input only for multimodal generation models.
- `/admin/playground` model runs treat the selected playground model as multimodal for attached audio/files. Do not preprocess playground media through global STT or file/image defaults; attach the original browser recording plus truthful fallbacks directly to the selected model.
- `orpc.scribe.fillInputs` is billable usage: enforce the same scribe usage limit and log one `ai_input_fill` event. Do not store raw audio or document bytes in `UsageEvent`; store text input only when existing ZDR rules allow it plus audio/file metadata and payload summaries.
- Shared input UX for template filling and AIScribe lives in `apps/app/app/_components/input-context/`. Keep recorder/playback/file/text-context behavior there and pass it into design-system primitives via render props; do not reintroduce high-level input recorder/fill controls inside `packages/design-system`.
- Reusable input tab content lives in `audio-input.tsx`, `document-input.tsx`, and `text-input.tsx`; keep `InputContextControls` focused on panel orchestration and submission wiring.
- AIScribe input tabs should avoid nested independently scrollable areas: do not make the tab panel itself scrollable; give it a stable minimum height, let inner textareas/content grow (`field-sizing-content`, no max height, `overflow-hidden`), and let the parent/page grow so the full panel is shown.
- AIScribe main text entry should have its own visible border and focus ring; do not put the active/focus highlight around the whole tab panel or prompt wrapper.
- On mobile, text-context overlays must stay height-constrained and scrollable so footer actions remain reachable.
- Template detail right-edge tabs switch only the right preview/examples pane; they must not replace the full card or hide the left input column when a template has inputs.
- Like-count labels use singular `Like` for exactly 1 and plural `Likes` otherwise.
- Template selector triggers should look like normal single-line selects after selection and use grouped shadcn Select primitives (`SelectGroup`, `SelectLabel`, `SelectSeparator`) from the design-system UI. Keep the top `Keins` option unlabelled; only actual template categories should have group labels. Keep template author/favourite ownership details out of selected values and option badges; explain in the adjacent Template tooltip that own and favourited templates are selectable.

## Project Overview

MDScribe is a medical documentation webapp (monorepo) for organizing medical templates and assisting doctors with AI-powered document generation, template management, and subscription-based usage tracking.

## Licensing & Open-Core Architecture

- The repo is licensed **FSL-1.1-Apache-2.0** (Fair Source, converts to Apache 2.0 after 2 years per release). Root `LICENSE` holds the FSL text; every `package.json` sets `"license": "FSL-1.1-Apache-2.0"`. The project was previously AGPL-3.0-or-later; do not reintroduce AGPL references.
- In user-facing text, describe MDScribe as `Fair Source` / `quelloffen`, **not** `Open Source` (FSL is source-available, not OSI open source).
- Future enterprise features (audit log, SSO/OIDC, org management, …) go in a **top-level `ee/` directory** as a workspace package (`@repo/ee`) under **Elastic License 2.0** with its own `LICENSE` file. `ee/` does not exist yet — create it only when the first enterprise feature lands; do not scatter enterprise code through `apps/` or `packages/`.
- Core code imports `@repo/ee` only at thin, explicit wiring points (for example spreading `eeAuthPlugins(license)` into the better-auth `plugins` array in `auth.ts`). Routes/oRPC mounts in `apps/app` stay thin re-exports of `ee/` logic.
- All feature gating (plan **and** future edition/license-key) must flow through `resolveProductEntitlements` in `apps/app/lib/product-entitlements.ts` and the oRPC entitlements middleware. Never check plans/subscriptions inline elsewhere. Enterprise license keys are signed tokens verified offline at boot (no phone-home) and resolve to edition entitlements.
- DB schema and migrations for enterprise tables stay in `packages/database` under the core license (single migration chain); only the logic is gated in `ee/`.

## Git Workflow

- `main` ← `staging` ← feature branches. **AI agents always target `staging`.**
- Verify the active branch before making claims about CI/CD, deployment files, or release behavior; `main` and `staging` may differ materially.
- Branch naming: `<agent>/<description>-<session-id>`, `feature/<desc>`, `fix/<desc>`, `review/prs-<numbers>`
- **Never commit without explicit user confirmation.** Leave changes unstaged for review.
- **No AI attribution** in commits — no `Co-Authored-By`, no model/tool names.
- **PR review**: For multiple PRs, create `review/prs-<numbers>` from `staging`, cherry-pick each, present review, wait for approval.
- Before creating a PR or recording PR metadata, always run `bun run knip` and fix any reported unused exports or other actionable findings that affect the touched code.
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

- `bun dev` uses the repo-pinned Turbo version through the root package script. Direct `turbo dev` depends on the shell's `turbo` binary; if it reports missing `dev` tasks, check `turbo --version` and update the global binary to match the repo's Turbo major version.
- Use `turbo run lint --filter=app` for package-scoped checks
- Avoid direct `ultracite check` / `oxlint` / `bun test` at repo level — use Turbo for caching
- When using Bun with a package-specific cwd, use `bun run --cwd <dir> <script>` or `cd <dir> && bun run <script>`; avoid `bun --cwd <dir> run <script>`
- Production deploys should run `bun run db:migrate` in CI/CD before rollout; do not rely on Docker startup migrations
- Coolify Dockerfile deploys should use a `Post-deployment` hook for DB migrations, but the final runtime image must also make `drizzle-kit` resolvable from `/app/packages/database/drizzle.config.ts` (for example by copying `/app/node_modules` from the deps stage, or otherwise ensuring `drizzle-kit` is installed in the runtime image). With the current standalone-only runner image, `cd /app/packages/database && bunx drizzle-kit migrate --config=drizzle.config.ts` can fail because the config imports `defineConfig` from `drizzle-kit`.
- Prefer the post-deployment hook `cd /app/packages/database && bun run migrate` once runtime `node_modules` includes `drizzle-kit`.
- Do not add Docker startup migration entrypoints or bundled migration runners unless the user explicitly asks for that tradeoff
- Keep `packages/database` in the final runtime image so the Coolify post-deployment hook can read `drizzle.config.ts` and the checked-in `drizzle/` SQL files, and keep the required migration dependencies available in the runtime image as well
- Database: `cd packages/database && bun run push|generate|dev`

## Architecture

### Monorepo Structure
- **Apps**: `apps/app` (Next.js), `apps/docs` (Fumadocs), `apps/email` (React Email), `apps/storybook`, `apps/studio`
- **Packages**: `packages/database` (Drizzle ORM), `packages/design-system` (UI), `packages/email`, `packages/env`, `packages/markdoc-md`, `packages/typescript-config`

### Key Architecture (details in `apps/app/CLAUDE.md`)
- **oRPC**: Base handlers (`pub`, `authed`) in `apps/app/orpc.ts`. Router in `orpc/router.ts`.
- **AI Streaming**: Unified handler modules live in `orpc/scribe/handlers/`. Prompt composition lives in `orpc/scribe/prompts`, context composition lives in `orpc/scribe/context`. Client uses `useScribeStream` hook.
- **Auth**: BetterAuth in `auth.ts`. Server: `auth.api.getSession(...)`. Client: `useSession()`.
- **Auth API calls**: Prefer direct `auth.api.*` calls where used; avoid one-off wrapper helpers unless they provide shared behavior beyond simple forwarding.
- **Templates**: Custom Markdoc tags + TipTap editor. 1024-dim Voyage AI embeddings for vector search.
- **Documents**: `/documents` mirrors the templates UX (library/detail/create/edit) and persists `pdfBytes` + `fieldDefinitions` only. `parsedMarkdoc` is derived on demand from `fieldDefinitions` and is never stored. Canonical APIs live under `orpc.documents.templates.*`, including PDF transport via `orpc.documents.templates.getPdf` (base64 payload); do not add `/api/documents/[id]/pdf`.
- **Visibility**: Templates and documents store `visibility` (`public` or `private`). Public items are visible, usable, and forkable by everyone; private items are visible only to their author, including binary document PDF access. Creating or saving private templates/documents requires the Plus entitlement from `PRODUCT_PLANS`; non-Plus users can only save them as public.
- **DB access boundary**: App routes/components use oRPC/TanStack Query only — no direct DB helpers under `app/`.

## Code Style & Conventions

- **Linter**: Ultracite v7 with Oxlint + Oxfmt (see `.cursor/rules/ultracite.mdc`)
- **Components**: Named exports, prefer RSC, minimize `'use client'`
- **Naming**: `handle` prefix for event handlers, auxiliary verbs for booleans (`isLoading`, `hasError`)
- **TypeScript**: Type imports (`import type`), `as const`, no `any`, `for...of` over `forEach`, arrow functions
- **Toasts**: `import { toast } from 'sonner'`
- **Runtime**: Prefer Bun-native APIs over Node compatibility APIs; in Bun runtime code avoid `node:*` imports unless absolutely necessary
- **Tailwind v4**: `@import "tailwindcss"`, `@theme` in CSS, colors via design system tokens (e.g. `bg-solarized-green`), renamed utilities (`shadow-xs`, `rounded-xs`, `blur-xs`). Do not expand the global `@theme` color set for one-off UI states; prefer existing semantic colors like `primary` or already-registered Solarized utilities to avoid breaking light/dark behavior.
- **Keyboard shortcuts**: `react-hotkeys-hook` with `['meta+k', 'ctrl+k']` pattern
- **User messages**: All German user-facing text in `apps/app/lib/user-messages.ts` (`USER_MESSAGES`)
- Admin playground and reusable audio input controls must not leave copied component labels in English; translate visible labels, aria labels, placeholders, and permission errors to German before handing off.
- **Form actions**: Icon-only action buttons beside labeled text fields should align with the input controls, not the label row.

## Implementation Rules

### AI / Scribe
- Use admin-configured providers from DB — no hardcoded fallbacks
- Model selection: text-only AIScribe and input-fill requests always use the default text model. Requests with audio, PDF, image, or other file input first use the default multimodal model when configured; otherwise they preprocess through speech-to-text and/or file-image defaults before finishing with the default text model.
- Prompts managed in Langfuse (production/staging labels). Usage logged to `UsageEvent`.
- Prompt text fragments live under `apps/app/orpc/scribe/prompts/core/` and `apps/app/orpc/scribe/prompts/families/` as plain strings. Prefer direct multiline literals in each family entry file (usually `index.ts`) and avoid unnecessary string composition. Keep harness wiring in `apps/app/orpc/scribe/prompts/definitions/` and keep `prompts/registry.ts` as a thin lookup/registry layer. Prompt harness IDs, display names, and backward-compatible aliases belong in the prompt registry/definitions area; do not add a separate `lib` helper for this.
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
- Built-in override entries are managed separately in admin (`/admin/settings/models` → `AI Vorlagen` → `Schnelle Dokument-Generierung`) and are not treated as public custom AI Vorlagen (`/aiscribe/custom/*` and `orpc.scribeForms.listAvailable` exclude them).
- Admin model comparison lives at `/admin/model-comparison` and reuses `orpc.admin.usage.list/get` plus `orpc.admin.scribe.run`; do not add a dedicated comparison endpoint unless the workflow needs server-only behavior. It samples replayable built-in AIScribe `UsageEvent` inputs only; custom form and redacted/ZDR events should not be replayed unless explicit support is added.
- When refactoring input UIs, treat the production `/aiscribe` inputs as the canonical component. Playground/admin input tabs should reuse that component (or a direct extraction of it) instead of introducing a parallel simplified variant.
- User-facing wording for these custom pages is `AI Vorlagen` / `AI Vorlage` (no hyphen), not `AI Forms`, `AI Text`, or `AI Textbausteine`. The grammatical gender is feminine (`Neue AI Vorlage`, `diese AI Vorlage`). Internal identifiers (slugs like `ai-texts-announcement`, file names like `user-ai-texts-card.tsx`, the `scribeForms` namespaces) keep their historical names.
- Custom AI Vorlagen live in `AiScribeFormConfig`, render on `/aiscribe/custom/[slug]`, use a path auto-derived from the name, and currently always use the full clinical context inputs (`notes`, `diagnoseblock`, `anamnese`, `befunde`). Admin-created/global AI Vorlagen have `authorId = null`, default to public visibility, and are managed from `/admin/settings/models` in the `AI Vorlagen` tab. User-owned AI Vorlagen have `authorId` set, are managed from `/profile/ai-scribe`, and use the root `orpc.scribeForms` namespace for list/create/update/delete/editor context; do not reintroduce `orpc.user.scribeForms`. User-owned AI Vorlagen support `visibility = public | private`: public entries are visible and usable by everyone like admin-created entries, while private entries are author-only in `orpc.scribeForms` plus `orpc.scribeStream` and require Plus to create or keep private. The user profile settings use route-based sections (`/profile/account`, `/profile/ai-scribe`) with a left settings sidebar; do not reintroduce hash-based profile tabs such as `/profile#profile`. The admin/public APIs for these forms should stay minimal: no configurable input preset, no explicit per-textbaustein model selection, and no per-form temperature / max-tokens / thinking-budget fields unless explicitly reintroduced. In that admin UI, keep the prompt field label `Basis-Prompt`, require an explicit confirmation step before deletion, and keep the cards compact: there is no separate `/aiscribe/custom/...` path box, the title itself is the public link with an external-link icon only when the entry is enabled, prompt/template metadata should use a two-column layout with labels on the left and values on the right, and the enabled state in the overview card must be a real inline `Aktiviert` switch that can be changed without opening the edit dialog. Delete confirmation in the card must reserve stable space so the UI does not jump when switching between trash icon and confirm buttons. If an AI Vorlage is disabled, its public `/aiscribe/custom/[slug]` link must render inactive because the route returns 404.
- Only send reasoning options when model explicitly advertises support; otherwise omit entirely.

### Provider / Model System
- Schema: `AiProvider` with `AiModel.providerId` FK. Encrypted credentials in `apiKey` column.
- Resolver: `resolveProviderModel(...)`. OpenAI-compatible requires explicit base URL — no fallbacks.
- Sync provider models into `AiModel` on creation and manual refresh. `(providerId, modelId)` as sync key. DB is authoritative.
- Store OpenRouter `supported_parameters` on `AiModel.supportedParameters`; UI parameter controls should use this capability list instead of reconstructing fake support from booleans.
- Treat `supportedParameters` as optional at API/UI boundaries and normalize it to `[]`; older query-cache payloads or pre-sync rows may not include the field yet.
- Playground reads models from DB, not live API fetches. Model selector uses shadcn `Select`.
- Admin settings: `/admin/settings/models` — vertical tabs `Verbindungen` + `Modelle`. Validate connectivity before creating provider.
- The `tinfoil` protocol must go through the `tinfoil` npm SDK (`createTinfoilAI` for generation, `TinfoilAI` for STT), never plain HTTP to `inference.tinfoil.sh` — the SDK provides the attestation + HPKE end-to-end encryption guarantees that justify the provider. Cache provider/client instances per credential set (attestation handshake is expensive); evict rejected handshakes. Model sync uses the public `/v1/models` catalog, keeps only `type: chat|audio`, maps the explicit `reasoning` flag to `supportsReasoning`, and leaves `supportedParameters` empty (no fabricated capability lists). Base URL is optional (SDK resolves the verified endpoint; set only for proxies). Provider docs live in `apps/docs/content/docs/providers/`.

### Template Editor
- WYSIWYG: Inline Markdoc validation in TipTap mode (red squiggles + hover errors); block save when Markdoc validation has errors
- Source editing: Admin only (`session.user.email === env.ADMIN_EMAIL`)
- Page data centralized in `app/templates/_lib/editor-page-data.ts`. Routes under `(editor)/` with auth redirect.
- Categories: Fetch via `orpc.templates.editorContext`, pass as `categorySuggestions`.
- Template examples: Up to 10 final-output examples per template are stored as the `Template.examples` string array and edited in the template editor.
- Collections: User-managed template collections via `orpc.user.collections.*` with `TemplateCollection` / `TemplateCollectionTemplate` tables.

### Documents
- Route family: `app/documents/layout.tsx`, `app/documents/page.tsx`, `app/documents/[id]/page.tsx`, `app/documents/(editor)/create/page.tsx`, `app/documents/(editor)/[id]/edit/page.tsx`.
- Persisted entity: `DocumentTemplate` table with `fieldDefinitions` (jsonb), `pdfBytes` (bytea), author, timestamps.
- Server namespace stays nested at `orpc.documents.templates.*` (`list`, `get`, `getPdf`, `create`, `update`, `editorContext`), while `orpc.documents.parseForm` remains for PDF form parsing. OCR/document-to-text helpers related to AIScribe live under `orpc.scribe.*` (for example `orpc.scribe.ocrToMarkdown`), not the documents namespace.
- Keep `fieldDefinitions` as source of truth and build `parsedMarkdoc` only via `buildParsedMarkdocFromFieldDefinitions`; never persist `parsedMarkdoc` or raw `markdocContent` for documents.
- `list` and `get` must exclude raw `pdfBytes`; binary delivery stays in `getPdf` response payload.
