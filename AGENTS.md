# AGENTS.md

Global guidance for coding agents. More specific rules live next to the code they govern:

- `apps/app/AGENTS.md`: application architecture, product behavior, providers, templates, documents, and admin UI.
- `apps/app/orpc/scribe/AGENTS.md`: generation, prompt, context, harness, and usage rules.
- `apps/app/app/_components/input-context/AGENTS.md`: shared audio, file, and text input UX.
- `packages/design-system/AGENTS.md`: Base UI, Tailwind/Solarized, and editor primitives.
- `packages/markdoc-md/AGENTS.md`: tag contracts, validation, parsing, and rendering behavior.

Before changing a scoped area, read its nearest `AGENTS.md`; the more specific file wins. Put new guidance in the narrowest applicable file instead of growing this root file.

## Proactive Agent Behavior

### Self-Updating

When the user corrects you, immediately update the most specific applicable `AGENTS.md`. Corrections are standing authorization.

- Treat user statements about local infrastructure as source of truth.
- Use the `improve` skill only when the user explicitly requests it by name; do not infer it from audit, planning, review, or recommendation requests.
- Store local implementation-plan artifacts under the intentionally git-ignored `plans/` directory, not `advisor-plans/`.
- The local PostgreSQL test database runs on port `5432`. The restricted command sandbox cannot reach loopback TCP; rerun DB-backed tests with external/network approval after sandboxed `ECONNREFUSED` instead of reporting the database unavailable.
- In provider/API discussions, “pi agent” means the Pi Agent used by OpenClaw, not Pydantic AI.
- In privacy-filter discussions, “PII Shield” means Microsoft’s PII Shield privacy proxy introduced through the Azure Developer Community unless the user identifies a different product.

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

For new functionality, deliver all relevant layers: frontend, oRPC/API, data boundary, authorization, usage logging, and rate limiting where applicable (no new billing or paid-entitlement guards; the project is non-commercial).

- Add focused unit tests and E2E coverage for major user workflows.
- Update `apps/docs` for user-facing changes and the nearest `AGENTS.md` for durable architectural changes.
- Every feature needs a React Email announcement draft following the existing marketing pattern (`packages/email/templates`, `apps/email/emails`, `packages/email/drafts.tsx`). Small fixes should explicitly state that no announcement is needed.
- Marketing bulk sends may use any `category: "marketing"` draft and require a typed confirmation phrase. Use generic greetings unless real per-recipient personalization exists; never use demo names.
- The AI Textbausteine announcement always uses `Hallo,` and never renders `userName`, including test sends.
- Admin test sends select an existing user and use that profile; never accept an arbitrary recipient address.

## Project and Licensing

MDScribe is a medical documentation monorepo for AI-assisted document generation and templates, run as a non-commercial open-source side project.

- License: AGPL-3.0 (`AGPL-3.0-only`), decided 2026-07-29, replacing the interim Elastic-2.0 period (the original history was AGPL). Describe MDScribe publicly as `Open Source`; do not use `quelloffen`, `Source Available`, or ELv2 wording anymore. Published AGPL versions stay AGPL forever.
- Non-commercial: no subscriptions, no checkout, no license-key sales, no B2B contracts. Voluntary support/donations without functional perks are acceptable and must not be marketed as tax-deductible. The single legacy Plus subscriber is wound down personally and in an orderly way per the master plan, never silently.
- The first hosted-cloud BYOK implementation is an optional alternative to the existing limited operator-funded free quota. Admins expose BYOK per configured provider connection; users may store keys only for those exposed connections and cannot change their protocol or base URL. Calls fully covered by active user keys bypass the MDScribe quota; operator-funded calls retain the current free test quota. User keys must never appear in logs, error messages, or usage events.
- The offline license-key infrastructure (`apps/app/lib/license/`, `scripts/sign-license.ts`, `resolveProductEntitlements`, entitlement middleware) is dormant: keep it compiling, add no new paid gates, sell no keys. Under AGPL, third parties may legally remove such checks; that is accepted.
- Real or merely pseudonymized patient data belongs exclusively in self-hosted deployments operated by the user's institution; the hosted cloud stays synthetic/anonymized-content only.
- Relicensing and monetization options stay open only while Nils is the sole copyright holder: introduce DCO/CLA before merging any outside contribution. Future commercial logic would live in a top-level `ee/` workspace package and requires a new explicit decision; the archived B2B plan (`plans/archive-b2b-onpremise-masterplan.md`) is the starting point. Database schema and migrations remain in `packages/database`.
- Keep the documentation-assistant boundary in features and marketing: no diagnosis detection, finding interpretation, risk scoring, dosing, or therapy recommendations.

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
