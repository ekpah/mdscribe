# CLAUDE.md

## Package Overview

Shared TypeScript configuration (`@repo/typescript-config`) for the monorepo.

## Configuration Files

- `base.json` - Base TypeScript config
- `nextjs.json` - Next.js app configuration
- `library.json` - Library/package configuration

## Usage

Extend in your `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```
