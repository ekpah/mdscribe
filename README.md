# MDScribe

Medical documentation platform powered by AI. MDScribe helps doctors reduce documentation time by generating discharge letters, admission notes, and other clinical documents from structured inputs.

## Features

- **AI Document Generation** — Generate discharge letters, admission notes, diagnoses, and more from structured prompts with streaming output
- **Template System** — Create and manage medical documentation templates with custom Markdoc extensions (scoring calculators, conditional content, case formatting)
- **Vector Search** — Find relevant templates using semantic similarity search powered by Voyage AI embeddings
- **Rich Text Editor** — TipTap-based editor with medical-specific extensions
- **Subscription Billing** — Stripe-integrated usage tracking and subscription management
- **Multi-Model AI** — Access Claude, Gemini, and other models through OpenRouter

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Runtime**: Bun
- **Database**: PostgreSQL with Drizzle ORM + pgvector
- **Authentication**: BetterAuth with Stripe integration
- **AI**: OpenRouter (multi-model), Voyage AI (embeddings), Langfuse (prompt management)
- **API**: oRPC for type-safe client-server communication
- **Styling**: Tailwind CSS v4
- **Monorepo**: Bun workspaces + Turborepo

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.2+
- Node.js 18+

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/ekpah/mdscribe.git
   cd mdscribe
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Copy and configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Required variables:
   | Variable | Description |
   |----------|-------------|
   | `POSTGRES_DATABASE_URL` | PostgreSQL connection string |
   | `ADMIN_EMAIL` | Email address of the instance administrator |
   | `OPENROUTER_API_KEY` | OpenRouter API key for AI model access |
   | `BETTER_AUTH_SECRET` | Secret for authentication |
   | `AUTH_POSTMARK_KEY` | Postmark API key for transactional emails |
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
   | `STRIPE_PLUS_PRICE_ID` | Stripe price ID for monthly plan |
   | `STRIPE_PLUS_PRICE_ID_ANNUAL` | Stripe price ID for annual plan |
   | `VOYAGE_API_KEY` | Voyage AI API key for embeddings |

4. Start local PostgreSQL (OrbStack/Docker):

   ```bash
   bun run db:up
   ```

   This command also runs `db:init` to apply schema and an idempotent development seed.

5. Start the development server:

   ```bash
   bun dev
   ```

   The app runs on [http://localhost:3000](http://localhost:3000).

## Project Structure

```
mdscribe/
├── apps/
│   ├── app/          # Main Next.js application
│   ├── docs/         # Documentation site (Fumadocs)
│   └── email/        # Email template preview (React Email)
├── packages/
│   ├── database/     # Drizzle ORM schema and client
│   ├── design-system/# Shared UI components
│   ├── email/        # Email sending utilities
│   ├── env/          # Environment variable validation
│   ├── markdoc-md/   # Custom Markdoc medical extensions
│   └── typescript-config/ # Shared TS config
└── ee/               # Enterprise features (commercial license)
```

## Privacy & Hosting (OSS)

Our short-term privacy position for the open-source launch:

- Cloud-hosted usage should not be treated as safe for sensitive patient PII/PHI until stronger compliance controls are complete.
- Self-hosting is the recommended path for users who need full control over where data is processed and stored.

This guidance is risk-based and intended to help teams choose an appropriate deployment model for their data sensitivity.
See `apps/docs/content/docs/self-hosting/index.mdx` for the self-hosting runbook.

## Production Database Migrations

Run `bun run db:migrate` in CI/CD before rolling out a version that includes schema changes. The Docker image is expected to start the app only and does not run migrations on container startup. `bun run db:migrate:deploy` remains as a compatibility alias if your deploy system already uses it.

For Dockerfile-based deployments such as Coolify, configure a `Post-deployment` hook instead of running migrations during container startup:

```sh
cd /app/packages/database && bunx drizzle-kit migrate --config=drizzle.config.ts
```

The runtime image ships `packages/database` so the hook can read the checked-in Drizzle config and SQL migration files.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## License

MDScribe is dual-licensed:

- **AGPL-3.0-or-later** — Open-source codebase ([LICENSE](LICENSE))
- **Commercial License** — Enterprise features under `ee/` ([ee/LICENSE](ee/LICENSE))
