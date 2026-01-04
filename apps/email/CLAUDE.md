# CLAUDE.md

## Package Overview

Email template preview app using React Email for developing and testing transactional emails.

## Commands

```bash
bun dev     # Start preview server on port 3003
bun build   # Build email templates
bun export  # Export templates to HTML
```

## Key Files

- `emails/` - React Email template components
- Templates are used by `@repo/email` package for sending

## Dependencies

- `react-email` - Email template framework
- `@react-email/preview-server` - Development preview server
