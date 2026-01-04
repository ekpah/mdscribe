# CLAUDE.md

## Package Overview

Shared React component library (`@repo/design-system`) providing UI components, TipTap editor integration, and Tailwind CSS v4 theme.

## Key Directories

- `components/ui/` - Core UI components (buttons, dialogs, inputs, tables)
- `components/editor/` - TipTap rich text editor components
- `components/ai-elements/` - AI-specific UI components
- `providers/` - Theme and query providers
- `lib/` - Utilities (cn, utils)

## Dependencies

- Radix UI primitives
- TipTap editor (`@tiptap/*`)
- React Aria Components
- Tailwind CSS v4 with `tailwind-merge`
- Sonner (toasts)

## Exports

```typescript
// UI components
import { Button, Dialog, Input, Table, ... } from "@repo/design-system/components/ui";

// Editor
import { Editor } from "@repo/design-system/components/editor";

// Utilities
import { cn } from "@repo/design-system/lib/utils";
```
