# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MDScribe is a medical documentation webapp built as a monorepo that helps organize medical templates and assists doctors in their day-to-day work. It features AI-powered document generation, template management, and subscription-based usage tracking.

## Build Commands

Core development commands:
- `pnpm dev`: Start development server (Next.js on port 3000)
- `pnpm build`: Build all packages using Turbo
- `pnpm lint`: Run linting across all packages using Biome
- `pnpm test`: Run tests via Turbo
- `pnpm migrate`: Run Prisma database migrations and generate client

Database operations:
- `cd packages/database && npx prisma format && npx prisma generate && npx prisma db push`: Full database setup
- `cd packages/database && docker compose up -d`: Start local PostgreSQL database

Analysis and maintenance:
- `pnpm analyze`: Run bundle analysis (set ANALYZE=true)
- `pnpm knip`: Check for unused dependencies
- `pnpm bump-deps`: Update dependencies (excludes react-day-picker)

## Architecture

### Monorepo Structure
- **Apps**: `apps/app` (Next.js main app), `apps/docs` (Mintlify docs), `apps/email` (React Email), `apps/storybook`, `apps/studio`
- **Packages**: `packages/database` (Prisma), `packages/design-system` (UI components), `packages/email`, `packages/env`, `packages/markdoc-md`, `packages/typescript-config`

### Core Technologies
- **Framework**: Next.js 15 with App Router and React 19
- **Authentication**: BetterAuth with Stripe integration for subscriptions
- **Database**: PostgreSQL with Prisma ORM and pgvector for embeddings
- **AI Integration**: Anthropic Claude via ai-sdk, Langfuse for tracing, Voyage AI for embeddings
- **Styling**: Tailwind CSS v4 with design system extending "ultracite" configuration
- **API**: oRPC for type-safe client-server communication
- **State Management**: Jotai for global state, React Hook Form for forms
- **Testing**: Turbo for task orchestration

### Key Features
- **AI Document Generation**: Template-based medical document creation using Claude
- **Template Management**: User templates with favorites, categories, and vector search
- **Subscription System**: Stripe-powered billing with usage tracking and limits
- **Authentication Flow**: Email/password with verification, password reset, and email change
- **Usage Analytics**: PostHog integration with custom event tracking

### Database Schema
Key models: User, Template (with vector embeddings), Subscription, UsageEvent, Session, Account, Verification

### Authentication Architecture
- **Server**: `apps/app/auth.ts` - BetterAuth configuration with Prisma adapter
- **Client**: `apps/app/lib/auth-client.ts` - React hooks and client functions
- **Routes**: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
- **Features**: Email verification, subscription management, PostHog event tracking

### API Structure
- **oRPC Router**: `apps/app/orpc/router.ts` with authed/public endpoints
- **Main Endpoints**: `/api/rpc/[[...rest]]` for oRPC, streaming AI endpoints under `/api/scribe/`
- **Middleware**: Authentication (`orpc/middlewares/auth.ts`) and database access

### Template System
- **Custom Markdoc**: Extended with medical-specific tags (Case, Info, Score, Switch)
- **TipTap Editor**: Rich text editing with custom medical node extensions
- **Vector Search**: Template embeddings for relevant template discovery

## Code Style & Conventions

### Formatting
- **Linter**: Biome extending "ultracite" configuration
- **Styling**: Tailwind CSS v4 with CSS-first configuration (`@import "tailwindcss"`)
- **Components**: Named exports, prefer React Server Components, minimize 'use client'
- **Event Handlers**: Prefix with "handle" (handleClick, handleSubmit)
- **Boolean Props**: Use auxiliary verbs (isLoading, hasError)
- **Toasts**: Use react-hot-toast, not custom toast implementations

### TypeScript Standards
- Use TypeScript 5.8+ features
- Prefer type imports: `import type { Type } from 'module'`
- Use `as const` for readonly values
- Avoid `any` - use proper typing
- Use named exports for components

### CSS and Styling
- **Design System**: Use components from `@repo/design-system`
- **Colors**: Reference design system colors directly (e.g., `bg-solarized-green`)
- **Tailwind v4**: Use `@import "tailwindcss"` syntax, CSS theme variables
- **Responsive**: Container queries supported (`@sm:`, `@md:`, etc.)

### Authentication Usage
- **Server**: Use `auth.api.getSession({ headers: await headers() })` in Server Components/Actions
- **Client**: Use `useSession()` hook from auth client
- **Protected Routes**: Use `authed` middleware in oRPC handlers
- **Subscription Checks**: Access via session.user.subscriptions

## Environment Setup

Required environment variables (see turbo.json globalEnv):
- Database: POSTGRES_* variables for connection
- Auth: BETTER_AUTH_SECRET, AUTH_* for email services
- AI: ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, VOYAGE_API_KEY
- Stripe: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PLUS_PRICE_ID*
- Analytics: NEXT_PUBLIC_POSTHOG_*, LANGFUSE_*

## Testing Strategy

- Use existing test patterns in the codebase
- Run tests via `pnpm test` (Turbo orchestrated)
- Check package.json scripts for app-specific test commands

## Important Implementation Notes

- **AI Streaming**: Use ai-sdk with custom usage tracking in `/api/scribe/` endpoints
- **Vector Search**: Templates have embeddings for semantic search via Voyage AI
- **Email Templates**: Located in `packages/email/templates/` using React Email
- **Feature Flags**: Implemented via `flags` package with FLAGS_SECRET
- **Bundle Analysis**: Available via ANALYZE=true environment variable
- **Security**: Uses next-secure-headers, HSTS preload configuration