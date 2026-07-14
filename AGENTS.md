# AGENTS.md

Global guidance for coding agents. More specific rules live next to the code they govern:

- `apps/app/AGENTS.md`: application architecture, product behavior, providers, templates, documents, and admin UI.
- `apps/app/orpc/scribe/AGENTS.md`: generation, prompt, context, harness, and usage rules.
- `apps/app/app/_components/input-context/AGENTS.md`: shared audio, file, and text input UX.
- `packages/design-system/AGENTS.md`: Base UI, Tailwind/Solarized, and editor primitives.

Before changing a scoped area, read its nearest `AGENTS.md`; the more specific file wins. Put new guidance in the narrowest applicable file instead of growing this root file.

## Proactive Agent Behavior

### Self-Updating

When the user corrects you, immediately update the most specific applicable `AGENTS.md`. Corrections are standing authorization.

- Treat user statements about local infrastructure as source of truth.
- The local PostgreSQL test database runs on port `5432`. The restricted command sandbox cannot reach loopback TCP; rerun DB-backed tests with external/network approval after sandboxed `ECONNREFUSED` instead of reporting the database unavailable.
- In provider/API discussions, “pi agent” means the Pi Agent used by OpenClaw, not Pydantic AI.

### Linear Issue Tracking

The project uses Linear team **Scribe**.

- “Keep in mind for later” means create a `Backlog` issue immediately.
- Immediate work moves the issue through `Todo` → `In Progress`; an open PR awaiting the user is `In Review` with `pr-open` and `awaiting-you`.
- After finishing or merging, mark the related issue `Done` and check for other resolved issues.
- “What should I do next?” means inspect open/backlog Linear issues before suggesting work.
- Agent-first triage: after issue creation, do a first implementation pass and prepare a PR when requested.

End a first-pass issue with:

```md
## Agent Handoff
- PR: <url> | Branch: `<name>` | Status: `ready for review` | `blocked` | `needs follow-up`
### Done: <items>
### Not done: <items>
### Validate: <steps>
### Next action for Nils: <single step>
```

## Delivery Checklist

For new functionality, deliver all relevant layers: frontend, oRPC/API, data boundary, authorization, usage logging, and billing/entitlement guards.

- Add focused unit tests and E2E coverage for major user workflows.
- Update `apps/docs` for user-facing changes and the nearest `AGENTS.md` for durable architectural changes.
- Every feature needs a React Email announcement draft following the existing marketing pattern (`packages/email/templates`, `apps/email/emails`, `packages/email/drafts.tsx`). Small fixes should explicitly state that no announcement is needed.
- Marketing bulk sends may use any `category: "marketing"` draft and require a typed confirmation phrase. Use generic greetings unless real per-recipient personalization exists; never use demo names.
- The AI Textbausteine announcement always uses `Hallo,` and never renders `userName`, including test sends.
- Admin test sends select an existing user and use that profile; never accept an arbitrary recipient address.

## Project and Licensing

MDScribe is a medical documentation monorepo for AI-assisted document generation, templates, and subscription-based usage tracking.

- License: Elastic License 2.0 (`Elastic-2.0`), source-available. Never reintroduce AGPL, FSL/Fair Source, or describe MDScribe as Open Source/Fair Source; user-facing wording is `quelloffen` / `Source Available`.
- Paid on-premise deployments are seat-gated by offline Ed25519/PASETO-style signed license keys containing edition, `maxSeats`, and optional flags. The private signing key stays outside the repo; `scripts/sign-license.ts` is the offline minting CLI.
- License verification is offline with an embedded public key and stays behind `resolveLicense()` in `apps/app/lib/license/` so callers never depend on the concrete verifier or add phone-home checks.
- All plan/license checks flow through `resolveProductEntitlements` and oRPC entitlement middleware. Edition is deployment-wide; Stripe plan is per-user.
- Enforcement is intentionally soft: expiry warns admins without disabling clinical work; exceeding `maxSeats` blocks only new signups.
- Future enterprise logic belongs in a top-level `ee/` workspace package when first needed. Database schema and migrations remain in `packages/database`.

## Git Workflow

- Flow: `main` ← `staging` ← feature branches. Agents target `staging`; verify the active branch before claims about CI, deployments, or releases.
- Branches: `<agent>/<description>-<session-id>`, `feature/<desc>`, `fix/<desc>`, or `review/prs-<numbers>`.
- Never commit without explicit user confirmation. Leave changes unstaged for review and never add AI attribution.
- Multiple-PR reviews use `review/prs-<numbers>` from `staging`, cherry-pick each PR, present findings, then wait for approval.
- Before creating a PR or recording PR metadata, run `bun run knip` and fix actionable findings affecting touched code.
- Keep one GitHub PR-check workflow; add checks there instead of new push-only workflows.

## Commands and Deployment

```bash
bun dev                  # dev server, port 3000
bun run build            # Turbo build
bun run lint:affected    # preferred lint
bun run test:affected    # preferred tests
bun run db:migrate       # Drizzle migrations
```

- Use the repo-pinned Turbo via root scripts. For package scripts use `bun run --cwd <dir> <script>`; avoid direct repo-level `ultracite`, `oxlint`, or `bun test`.
- Package-scoped app lint: `turbo run lint --filter=app`. Database development: `cd packages/database && bun run push|generate|dev`.
- Do not patch third-party dependencies for bundle size; use supported imports/upstream fixes or accept the cost.
- Run production migrations in CI/CD before rollout, never at application startup unless explicitly requested.
- Coolify uses a post-deployment `cd /app/packages/database && bun run migrate`. The runtime image must contain `packages/database`, its checked-in migrations, runtime `node_modules`, and `drizzle-kit`.

## Monorepo and Global Conventions

- Apps: `apps/app`, `apps/docs`, `apps/email`, `apps/storybook`, `apps/studio`.
- Packages: `packages/database`, `packages/design-system`, `packages/email`, `packages/env`, `packages/markdoc-md`, `packages/typescript-config`.
- Lint/format: Ultracite v7 with Oxlint and Oxfmt.
- Components use named exports, prefer RSC, and minimize `'use client'`.
- Prefix event handlers with `handle`; booleans use auxiliary verbs such as `isLoading` and `hasError`.
- TypeScript: use type imports, `as const`, no `any`, `for...of` instead of `forEach`, and arrow functions.
- Use `toast` from `sonner`; in Bun runtime code prefer Bun APIs over `node:*` compatibility imports.
- Keyboard shortcuts use `react-hotkeys-hook` with explicit macOS/Windows pairs such as `['meta+k', 'ctrl+k']`.
