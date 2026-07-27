# CLAUDE.md

## Package Overview

Mintlify documentation source for MDScribe. The previous Fumadocs/Next.js
runtime and its `meta.json` files have been removed. Page files live directly
under this directory so their file paths match the public documentation routes.

## Commands

```bash
bun run --cwd apps/docs dev          # local preview on port 3333
bun run --cwd apps/docs validate     # validate the Mintlify build
bun run --cwd apps/docs check:links  # find broken internal links
```

## Key Files

- `docs.json` - Mintlify appearance, navigation, redirects, and site settings
- `style.css` - global Solarized light/dark styling
- `*.mdx` and topic directories - documentation pages and public routes
