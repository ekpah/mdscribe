# AI Scribe Editor Redesign Plan

This document outlines the implementation plan for redesigning the AI Scribe editor as the core "Medical Note IDE" functionality.

## Overview

The redesign is split into 3 phases:
1. **Phase 1**: Migrate prompts from Langfuse to local TypeScript configuration
2. **Phase 2**: Implement diff-based editing with session tracking
3. **Phase 3**: IDE features (future scope)

---

## Phase 1: Prompt Migration (Remove Langfuse Dependency)

### Goals
- Move all prompts from Langfuse to version-controlled TypeScript in `config.ts`
- Remove `langfuse` package dependency
- Start with `diagnoseblock_update` prompt for ICU Editor, then migrate all 9 prompts

### Files to Modify

#### 1. `apps/app/orpc/scribe/config.ts`
Add prompt content directly to each document type config:

```typescript
export const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> = {
  diagnosis: {
    promptName: "diagnoseblock_update", // Keep for reference
    prompt: {
      system: `Du bist ein medizinischer Dokumentationsassistent...`,
      userTemplate: `Anamnese: {{anamnese}}
Befunde: {{befunde}}
Aktuelle Diagnosen: {{diagnoseblock}}
Notizen: {{notes}}

Aktualisiere den Diagnoseblock basierend auf den neuen Informationen.`,
    },
    processInput: (prompt: string) => { /* existing */ },
    modelConfig: { /* existing */ },
  },
  // ... other document types
};
```

#### 2. `apps/app/orpc/scribe/types.ts`
Add prompt types:

```typescript
export interface PromptConfig {
  system: string;
  userTemplate: string;
}

export interface DocumentTypeConfig {
  promptName: string; // Legacy reference
  prompt: PromptConfig;
  processInput: (prompt: string) => Record<string, unknown>;
  modelConfig: ModelConfig;
}
```

#### 3. `apps/app/orpc/scribe/handlers.ts`
Replace Langfuse prompt fetching with local prompt compilation:

```typescript
// REMOVE:
// const textPrompt = await langfuse.getPrompt(config.promptName, ...);
// const compiledPrompt = textPrompt.compile({...});

// ADD:
function compilePrompt(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    String(variables[key] ?? '')
  );
}

const systemMessage = config.prompt.system;
const userMessage = compilePrompt(config.prompt.userTemplate, {
  ...processedInput,
  todaysDate,
});
```

#### 4. `apps/app/orpc/scribe/index.ts`
Remove Langfuse client initialization.

#### 5. `apps/app/package.json`
Remove `langfuse` dependency.

### Migration Order
1. `diagnoseblock_update` (diagnosis) - ICU Editor priority
2. `ICU_transfer_chat` (icu-transfer)
3. `ER_Anamnese_chat` (anamnese)
4. `ER_Koerperliche_Untersuchung_chat` (physical-exam)
5. `ER_Befunde_chat` (befunde)
6. `ER_Admission_Todos_chat` (admission-todos)
7. `Inpatient_discharge_chat` (discharge)
8. `Outpatient_visit_chat` (outpatient)
9. `Procedure_chat` (procedures)

### Testing
- Each prompt migration should be tested against the corresponding aiscribe page
- Compare output quality with Langfuse-served prompts

---

## Phase 2: Diff-Based Editing with Session Tracking

### Goals
- LLM returns only changes (udiffs) instead of full document
- Individual hunk accept/reject UI (Cursor-style)
- Session tracking for usage analytics
- Fix line spacing to match non-editor aiscribe pages

### 2.1 Database Schema Changes

#### `packages/database/schema.ts`
Add `sessionId` column to `UsageEvent`:

```typescript
export const usageEvent = pgTable(
  "UsageEvent",
  {
    // ... existing columns
    sessionId: text("sessionId"), // NEW: Groups events by document session
  },
  (table) => [
    // ... existing indexes
    index("UsageEvent_sessionId_idx").on(table.sessionId), // NEW
  ],
);
```

Run migration: `cd packages/database && bun run generate && bun run push`

### 2.2 Session ID Management

#### `apps/app/hooks/use-editor-session.ts` (NEW)
```typescript
import { useEffect, useState } from 'react';

export function useEditorSession() {
  const [sessionId] = useState(() => {
    // Generate once per component mount (document session)
    return `eds_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  });

  return sessionId;
}
```

### 2.3 Usage Event Types

#### `apps/app/lib/usage-logging.ts`
Add new event types and sessionId support:

```typescript
type EditorEventType =
  | 'ai_scribe_editor:enhance'      // AI generation requested
  | 'ai_scribe_editor:accept'       // Hunk accepted
  | 'ai_scribe_editor:reject'       // Hunk rejected
  | 'ai_scribe_editor:accept_all'   // All hunks accepted
  | 'ai_scribe_editor:reject_all';  // All hunks rejected

interface EditorUsageEvent {
  sessionId: string;
  eventType: EditorEventType;
  sectionId?: string;
  // For accept/reject events:
  hunkIndex?: number;
  originalText?: string;
  newText?: string;
}
```

### 2.4 UDiff Format & Prompt Changes

#### Diff Response Schema
LLM will return JSON with array of hunks:

```typescript
interface DiffHunk {
  contextBefore: string[];  // 1-3 lines for matching
  remove: string[];         // Lines to remove
  add: string[];            // Lines to add
  contextAfter: string[];   // 1-3 lines for matching
}

interface DiffResponse {
  hunks: DiffHunk[];
  summary?: string;  // Optional explanation
}
```

#### Prompt Modifications
Add diff instructions to each prompt's system message:

```typescript
const DIFF_SYSTEM_SUFFIX = `
IMPORTANT: Return ONLY the changes in JSON format, not the full document.
Format your response as:
{
  "hunks": [
    {
      "contextBefore": ["line before change"],
      "remove": ["lines to remove"],
      "add": ["lines to add"],
      "contextAfter": ["line after change"]
    }
  ],
  "summary": "Brief explanation of changes"
}

Rules:
- Each hunk modifies a specific section
- contextBefore/contextAfter: 1-3 unchanged lines for matching
- remove: lines to delete (empty array if only adding)
- add: lines to insert (empty array if only removing)
- Work with WHOLE LINES only
- If no changes needed, return {"hunks": [], "summary": "No changes required"}
`;
```

### 2.5 Diff Application Logic

#### `apps/app/lib/diff-utils.ts` (NEW)
```typescript
export interface DiffHunk {
  contextBefore: string[];
  remove: string[];
  add: string[];
  contextAfter: string[];
  // Computed during matching:
  matchedLineStart?: number;
  matchedLineEnd?: number;
  status?: 'pending' | 'accepted' | 'rejected';
}

export function matchHunksToDocument(
  document: string,
  hunks: DiffHunk[]
): DiffHunk[] {
  const lines = document.split('\n');

  return hunks.map(hunk => {
    // Find context match using sliding window
    const contextPattern = [...hunk.contextBefore, ...hunk.remove];
    const matchStart = findContextMatch(lines, contextPattern);

    if (matchStart === -1) {
      console.warn('Could not match hunk context:', hunk.contextBefore);
      return { ...hunk, status: 'rejected' as const };
    }

    return {
      ...hunk,
      matchedLineStart: matchStart + hunk.contextBefore.length,
      matchedLineEnd: matchStart + hunk.contextBefore.length + hunk.remove.length,
      status: 'pending' as const,
    };
  });
}

export function applyAcceptedHunks(
  document: string,
  hunks: DiffHunk[]
): string {
  const lines = document.split('\n');
  const acceptedHunks = hunks
    .filter(h => h.status === 'accepted' && h.matchedLineStart !== undefined)
    .sort((a, b) => (b.matchedLineStart ?? 0) - (a.matchedLineStart ?? 0)); // Apply from bottom up

  for (const hunk of acceptedHunks) {
    lines.splice(
      hunk.matchedLineStart!,
      hunk.remove.length,
      ...hunk.add
    );
  }

  return lines.join('\n');
}
```

### 2.6 UI Components

#### `packages/design-system/components/editor/DiffHunkView.tsx` (NEW)
Cursor-style individual hunk display:

```typescript
interface DiffHunkViewProps {
  hunk: DiffHunk;
  onAccept: () => void;
  onReject: () => void;
  isDisabled?: boolean;
}

export function DiffHunkView({ hunk, onAccept, onReject, isDisabled }: DiffHunkViewProps) {
  return (
    <div className="group relative rounded border border-solarized-blue/20 bg-background">
      {/* Context before (dimmed) */}
      {hunk.contextBefore.map((line, i) => (
        <div key={`ctx-before-${i}`} className="px-3 py-0.5 text-muted-foreground text-sm">
          {line}
        </div>
      ))}

      {/* Removed lines */}
      {hunk.remove.map((line, i) => (
        <div key={`remove-${i}`} className="bg-solarized-red/10 px-3 py-0.5 text-solarized-red line-through text-sm">
          {line}
        </div>
      ))}

      {/* Added lines */}
      {hunk.add.map((line, i) => (
        <div key={`add-${i}`} className="bg-solarized-green/10 px-3 py-0.5 text-solarized-green text-sm">
          {line}
        </div>
      ))}

      {/* Context after (dimmed) */}
      {hunk.contextAfter.map((line, i) => (
        <div key={`ctx-after-${i}`} className="px-3 py-0.5 text-muted-foreground text-sm">
          {line}
        </div>
      ))}

      {/* Accept/Reject buttons - Cursor style (inline, right side) */}
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onAccept}
          disabled={isDisabled}
          className="rounded bg-solarized-green p-1 text-white hover:bg-solarized-green/90 disabled:opacity-50"
          title="Accept (⌘Y)"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={onReject}
          disabled={isDisabled}
          className="rounded bg-solarized-red p-1 text-white hover:bg-solarized-red/90 disabled:opacity-50"
          title="Reject (⌘N)"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
```

#### `packages/design-system/components/editor/MarkdownDiffEditor.tsx`
Modify to support multiple hunks:

```typescript
interface MarkdownDiffEditorProps {
  // ... existing props
  hunks?: DiffHunk[];  // NEW: Array of hunks from LLM
  onHunkAccept?: (index: number) => void;
  onHunkReject?: (index: number) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

// Add state for pending hunks
const [pendingHunks, setPendingHunks] = useState<DiffHunk[]>([]);

// Block new enhancements while hunks are pending
const hasPendingHunks = pendingHunks.some(h => h.status === 'pending');
const canEnhance = !hasPendingHunks && !isStreaming;
```

### 2.7 Line Spacing Fix

#### `packages/design-system/components/editor/MarkdownDiffEditor.tsx`
Change line spacing to match non-editor pages:

```typescript
// BEFORE:
"prose prose-sm focus:outline-none w-full h-full max-w-none",
"prose-p:my-1 prose-p:text-foreground",

// AFTER:
"focus:outline-none w-full h-full max-w-none",
"text-sm leading-relaxed whitespace-pre-line",
"[&_p]:my-0 [&_p]:text-foreground",
"[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-0",
"[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-0",
"[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-0",
```

For diff view:
```typescript
// BEFORE:
"whitespace-pre-wrap p-3 text-sm leading-normal"

// AFTER:
"whitespace-pre-line p-3 text-sm leading-relaxed"
```

### 2.8 Streaming Handler Changes

#### `apps/app/orpc/scribe/handlers.ts`
1. Accept `sessionId` from client
2. Parse diff response from LLM
3. Log granular events

```typescript
// Input schema update
const input = z.object({
  documentType: z.enum([/* ... */]),
  messages: z.array(uiMessageSchema),
  model: z.enum([/* ... */]).optional(),
  audioFiles: z.array(audioFileSchema).optional(),
  sessionId: z.string().optional(), // NEW
});

// Response parsing for diffs
const result = streamText({
  // ... existing config
  experimental_transform: (chunk) => {
    // Parse JSON diff response
    try {
      const parsed = JSON.parse(chunk.text);
      if (parsed.hunks) {
        return { type: 'diff', hunks: parsed.hunks, summary: parsed.summary };
      }
    } catch {
      // Not JSON yet, continue streaming
    }
    return chunk;
  },
});
```

---

## Phase 3: IDE Features (Future Scope)

### Planned Features
- **Split pane view**: Side-by-side original and edited document
- **Version history**: Track document revisions within session
- **Section navigation**: Quick jump to document sections
- **Collaborative editing**: Multiple users editing same document
- **Template suggestions**: AI-powered template recommendations
- **Keyboard shortcuts**: Full keyboard navigation (Vim-style optional)

### Architecture Considerations
- Consider using Yjs or Automerge for collaborative editing
- LocalStorage/IndexedDB for offline draft persistence
- WebSocket connection for real-time collaboration

---

## Implementation Checklist

### Phase 1: Prompt Migration
- [ ] Create `PromptConfig` type in `types.ts`
- [ ] Add `compilePrompt` utility function
- [ ] Migrate `diagnoseblock_update` prompt (priority)
- [ ] Migrate remaining 8 prompts
- [ ] Remove Langfuse client from `index.ts`
- [ ] Remove `langfuse` from `package.json`
- [ ] Update tests to not mock Langfuse
- [ ] Test all 9 document types

### Phase 2: Diff-Based Editing
- [ ] Add `sessionId` column to `UsageEvent` schema
- [ ] Run database migration
- [ ] Create `useEditorSession` hook
- [ ] Create `diff-utils.ts` with matching logic
- [ ] Add diff instructions to prompts
- [ ] Create `DiffHunkView` component
- [ ] Update `MarkdownDiffEditor` for multi-hunk support
- [ ] Implement accept/reject event logging
- [ ] Fix line spacing in editor and diff views
- [ ] Add keyboard shortcuts (⌘Y accept, ⌘N reject)
- [ ] Test with ICU Editor flow

### Phase 3: IDE Features
- [ ] Design split pane architecture
- [ ] Implement version history
- [ ] Add section navigation
- [ ] Evaluate collaborative editing libraries

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| LLM returns malformed diff JSON | Add fallback to full-document mode; validate JSON schema |
| Context matching fails for ambiguous text | Increase context lines; add fuzzy matching; log failures |
| Prompt quality degrades after migration | A/B test against Langfuse before removing |
| Performance with many hunks | Virtualize hunk list; batch accept/reject operations |

---

## Success Metrics

- **Token savings**: Measure reduction in output tokens (target: 50%+ reduction)
- **Accept rate**: Track % of hunks accepted vs rejected
- **Session analytics**: Average enhancements per session, time to accept
- **User feedback**: Qualitative feedback on diff UX vs current approach
