# Contributing to MDScribe

Thank you for your interest in contributing to MDScribe! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) 1.2.23
- Node.js 24
- Git

### Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/mdscribe.git
   cd mdscribe
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```

4. Fill in the required environment variables in `.env`. See the [README](README.md) for details.

5. Start local PostgreSQL:
   ```bash
   bun run db:up
   ```
   This command also runs `db:init` to apply schema and idempotent development seed data.

6. Start the development server:
   ```bash
   bun dev
   ```

   The app runs on `http://localhost:3000`.

## Project Structure

MDScribe is a monorepo managed with Bun workspaces and Turborepo:

- `apps/app` — Main Next.js application
- `apps/docs` — Documentation site (Fumadocs)
- `apps/email` — Email template preview (React Email)
- `packages/database` — Drizzle ORM schema and client
- `packages/design-system` — Shared UI components
- `packages/email` — Email sending utilities
- `packages/env` — Environment variable validation
- `packages/markdoc-md` — Custom Markdoc extensions for medical templates
- `packages/typescript-config` — Shared TypeScript configuration

## Available Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun run build` | Build all packages |
| `bun run format` | Format the repository with Oxfmt |
| `bun run format:check` | Check formatting without changing files |
| `bun run lint` | Lint all packages (Ultracite/OXC) |
| `bun run typecheck` | Generate Next.js route types and typecheck all packages |
| `bun run test` | Run tests |
| `bun run knip` | Check for unused dependencies |
| `bun run db:up` | Start local PostgreSQL container |
| `bun run db:down` | Stop local PostgreSQL container |
| `bun run db:init` | Re-run schema + idempotent seed |

## Database Migrations

Migration SQL lives in `packages/database/drizzle`, and Drizzle applies files listed in
`packages/database/drizzle/meta/_journal.json`. The checked-in snapshots currently describe only
migrations 0000 and 0001; migrations 0002 onward were maintained manually. **Do not run
`drizzle-kit generate` until the snapshot metadata has been reconciled.** It may generate an
incorrect migration from stale metadata.

Until that reconciliation is complete, use this workflow for schema changes:

1. Update `packages/database/schema.ts`.
2. Add the next zero-padded migration SQL file under `packages/database/drizzle` by hand. Make the
   SQL safe for the supported upgrade state and use `--> statement-breakpoint` between statements
   where required by Drizzle.
3. Add the matching entry to `packages/database/drizzle/meta/_journal.json`, with the next `idx`, a
   unique increasing `when` value, and a `tag` exactly matching the SQL filename without `.sql`.
4. Validate an empty database by creating a disposable database, pointing
   `POSTGRES_DATABASE_URL` at it, and running `bun run db:migrate`.
5. Validate an upgrade by restoring or copying a representative pre-change database, recording its
   existing Drizzle migration history, then running `bun run db:migrate` against that disposable
   copy. Verify both the resulting schema/data and that a second migration run is a no-op.
6. Run the database and app typechecks plus representative DB-backed tests before submitting.

Never perform migration validation against a shared, production, or otherwise non-disposable
database. Snapshot reconciliation is intentionally a separate task.

## Branching Strategy

- `main` — Production branch, only receives merges from `staging`
- `staging` — Integration branch, all feature branches merge here first
- Feature branches are created from `staging`

### Branch Naming

- Features: `feature/<description>`
- Bug fixes: `fix/<description>`

### Workflow

1. Create a branch from `staging`:
   ```bash
   git checkout -b feature/my-feature origin/staging
   ```
2. Make your changes
3. Open a pull request targeting `staging`

## Code Style

We use [Ultracite](https://www.ultracite.ai/) v7 with [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) for linting and formatting.

Key conventions:

- **TypeScript**: Use `type` imports, avoid `any`, use `as const` for readonly values
- **Components**: Named exports, prefer React Server Components
- **Event handlers**: Prefix with `handle` (e.g., `handleClick`)
- **Boolean props**: Use auxiliary verbs (e.g., `isLoading`, `hasError`)
- **Styling**: Tailwind CSS v4 with design system tokens
- **Iteration**: Use `for...of` instead of `Array.forEach`
- **Functions**: Use arrow functions instead of function expressions

Run the linter before submitting:

```bash
bun run lint
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Ensure `bun run lint` and `bun run build` pass
- Add tests for new functionality where applicable
- Target the `staging` branch

## Licensing

MDScribe is source-available software licensed under the **Elastic License 2.0**
(`Elastic-2.0`). You may use, modify, and self-host it; you may not offer it as a
hosted/managed service to third parties or circumvent the license-key
functionality.

By contributing, you agree that your contributions are licensed under the
Elastic License 2.0, and you grant the MDScribe maintainer the right to
relicense and commercially license your contributions (this is required for the
license-key-gated commercial model to work).
