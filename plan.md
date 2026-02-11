# Open-Source Release Plan (Safety-First)

Last updated: 2026-02-09

## Objective

Open-source the monorepo in a way that is legally clean and explicit about privacy boundaries.

Short-term privacy position for launch:

- Cloud-hosted usage should **not** be treated as safe for sensitive patient PII/PHI yet.
- Self-hosting is the recommended path when users need strict control over data handling.

## Current Snapshot

### Repository state

- Branch: `staging`
- Local working tree has pre-existing changes (not part of this plan)
- Local `staging` is ahead of `origin/staging` by 12 commits

### Open pull requests (checked)

- #76 `Aiscribe error reporting` (draft)
- #75 `Landing page license pricing` (draft)
- #74 `Aiscribe context helper` (draft)
- #73 `Personal context for AI` (draft)
- #72 `User custom collections` (draft)
- #71 `Template categories system` (draft)
- #70 `Markdoc schema editor validation` (draft)
- #69 `Markdoc schema validation` (draft)
- #68 `Admin dashboard settings` (draft)

### Linear initiative clustering (ordered)

1. `P0 Open-Source Readiness` (now, highest priority)
2. `P1 Cloud Privacy Hardening` (next)
3. `P2 Post-OSS UX & Personalization` (after)

## P0: Open-Source Readiness (Now)

Primary issue: `SCR-105`

Execution issues:

- `SCR-108` OSS audit: secrets/internal endpoints/sensitive data scrub
- `SCR-109` Publish cloud caution + self-host recommendation
- `SCR-110` Self-hosting guide with data-control boundaries
- `SCR-111` OSS legal checklist: licenses/notices/attribution
- `SCR-112` Launch checklist and go/no-go
- `SCR-113` PR hygiene for stale draft PRs and issue sync

Milestones:

- `Audit & Redaction` (target: 2026-02-14)
- `Privacy Positioning & Docs` (target: 2026-02-21)
- `Self-Hosting Runbook` (target: 2026-02-28)
- `OSS Launch Sign-off` (target: 2026-03-07)

## P1: Cloud Privacy Hardening (Next)

Focus after public repo release:

- `SCR-100` Encrypt AIScribe input/output at rest
- `SCR-96` Move to stronger compliance-focused hosting setup

## P2: Post-OSS Initiatives (After)

Planned after launch/privacy baseline:

- `SCR-104` Intro tour
- `SCR-106` Adapt for personalization
- `SCR-101` Institution/team context provider
- `SCR-102` Extend user context metadata
- `SCR-103` Personal AI context profile field
- `SCR-92` uDiff editing path for AIScribe

## Required Public Messaging (Launch Blocker)

This wording (or equivalent) must be visible in README/docs:

- MDScribe is open-source and can be self-hosted.
- If you handle sensitive patient PII/PHI, self-hosting is recommended so you control storage, processing, and retention.
- Until stronger compliance controls are completed, cloud-hosted usage should be treated as unsuitable for sensitive patient data.

## License Normalization

- Canonical OSS license file: `LICENSE`
- Commercial/enterprise license file: `ee/LICENSE`
- Ensure docs and references point to `LICENSE` (not `license.md`)

## Launch Gate Checklist

All items must be true before broad OSS announcement:

- No leaked secrets/tokens/internal endpoints in repo history or current tree
- No real patient data or unsafe sample data in code/docs/fixtures
- License and attribution obligations reviewed and satisfied
- README/CONTRIBUTING/SECURITY/docs all aligned on privacy stance
- Self-hosting documentation is published and linked from README
- Draft PR backlog triaged (merged, closed, or explicitly deferred)
- Final go/no-go decision logged in `SCR-112`

## Suggested Execution Order (Short Horizon)

1. Complete `SCR-108` + `SCR-111` first (technical/legal hygiene).
2. In parallel, complete `SCR-109` and start docs updates in `SCR-107`.
3. Finish self-hosting docs in `SCR-110`.
4. Triage open drafts in `SCR-113`.
5. Run final launch gate in `SCR-112`.

