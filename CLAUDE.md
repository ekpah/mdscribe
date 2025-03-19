# MDScribe Codebase Guidelines

## Project Structure
- Monorepo using pnpm workspaces
- Apps: app (Next.js), docs, email, storybook, studio
- Packages: database (Prisma), design-system, email, env, typescript-config

## Build Commands
- `pnpm build`: Build all packages using Turbo
- `pnpm dev`: Run development server
- `pnpm lint`: Run linting across all packages
- `pnpm test`: Run tests (via Turbo)
- `pnpm migrate`: Run Prisma migrations

## Code Style
- TypeScript for all code
- React Server Components preferred when possible
- Minimize 'use client' directives
- Use named exports for components
- Use BetterAuth for authentication
- Use react-hot-toast for toasts

## Formatting
- Biome for formatting and linting
- Extends "ultracite" configuration
- Tailwind CSS v4 for styling
- Prefix event handlers with "handle" (handleClick, handleSubmit)
- Use descriptive names with auxiliary verbs (isLoading, hasError)

## Tech Stack
- Next.js 15 (App Router)
- React 19
- TypeScript 5.8+
- Tailwind CSS v4
- Prisma (PostgreSQL)
- Shadcn UI / Radix UI components