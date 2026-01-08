# CLAUDE.md

## Package Overview

Email utilities package (`@repo/email`) for sending transactional emails via Postmark.

## Key Files

- `templates/` - React Email template components
- `index.ts` - Email sending utilities

## Dependencies

- `@react-email/components` - Email component primitives
- `postmark` - Email delivery service

## Usage

```typescript
import { sendEmail } from "@repo/email";

await sendEmail({
  to: "user@example.com",
  template: "welcome",
  data: { name: "John" },
});
```
