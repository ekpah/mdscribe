# CLAUDE.md

## Package Overview

Custom Markdoc extensions (`@repo/markdoc-md`) for medical documentation templates.

## Key Files

- `tags/` - Custom Markdoc tag definitions
- `nodes/` - Custom Markdoc node definitions
- `components/` - React components for rendering tags

## Custom Tags

- `Case` - Case study formatting
- `Info` - Information callouts
- `Score` - Medical scoring calculators (with `fparser` for formulas)
- `Switch` - Conditional content blocks

## Dependencies

- `@markdoc/markdoc` - Markdoc parser and transformer
- `fparser` - Formula parser for Score calculations

## Usage

```typescript
import { tags, nodes, components } from "@repo/markdoc-md";

// Use with Markdoc.transform()
const content = Markdoc.transform(ast, { tags, nodes });
```
