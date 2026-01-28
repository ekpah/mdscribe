# Contributing to MDScribe

Thank you for your interest in contributing to MDScribe! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (v1.2+)
- Node.js 18+
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

5. Start the development server:
   ```bash
   bun dev
   ```

   The app runs on `http://localhost:3000`. Local development uses PGlite (in-memory PostgreSQL), so no external database is required.

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
| `bun run lint` | Lint all packages (Biome) |
| `bun run test` | Run tests |
| `bun run knip` | Check for unused dependencies |

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

We use [Biome](https://biomejs.dev/) with the [ultracite](https://github.com/harshtalks/ultracite) configuration for formatting and linting.

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

MDScribe is dual-licensed:

- **AGPL-3.0-or-later** for the open-source codebase
- **Commercial license** for enterprise features under `ee/`

By contributing, you agree that your contributions will be licensed under the same terms.
