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
- **Database**: PostgreSQL with Drizzle ORM (PGlite for local dev, Neon for production) + pgvector
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
   | `POSTGRES_DATABASE_URL` | PostgreSQL connection string (optional for local dev — uses PGlite) |
   | `ADMIN_EMAIL` | Email address of the instance administrator |
   | `OPENROUTER_API_KEY` | OpenRouter API key for AI model access |
   | `BETTER_AUTH_SECRET` | Secret for authentication |
   | `AUTH_POSTMARK_KEY` | Postmark API key for transactional emails |
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
   | `STRIPE_PLUS_PRICE_ID` | Stripe price ID for monthly plan |
   | `STRIPE_PLUS_PRICE_ID_ANNUAL` | Stripe price ID for annual plan |
   | `VOYAGE_API_KEY` | Voyage AI API key for embeddings |
   | `FLAGS_SECRET` | Feature flags secret |

4. Start the development server:
   ```bash
   bun dev
   ```

   The app runs on [http://localhost:3000](http://localhost:3000). Local development uses PGlite (in-memory PostgreSQL), so no external database setup is required.

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

## Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun run build` | Build all packages |
| `bun run lint` | Lint with Biome |
| `bun run test` | Run tests |
| `bun run knip` | Check for unused dependencies |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## License

MDScribe is dual-licensed:

- **AGPL-3.0-or-later** — Open-source codebase ([LICENSE](LICENSE))
- **Commercial License** — Enterprise features under `ee/` ([ee/LICENSE](ee/LICENSE))
