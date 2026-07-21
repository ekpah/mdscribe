# Scribe Guidance

Scope: `apps/app/orpc/scribe`. Root and `apps/app/AGENTS.md` also apply.

## Generation and Usage

- Prompts are code-owned; no external prompt service. All usage is recorded in `UsageEvent`.
- The standard configured model produces the final response. Declared media is attached natively; other media is preprocessed through its configured slot. Never hardcode provider/model fallbacks.
- `fillInputs` is billable: apply the normal scribe usage limit and record one `ai_input_fill` event. Respect ZDR; never store raw audio/document bytes, only allowed text plus metadata and payload summaries.
- Playgrounds pass original browser media and truthful fallbacks directly to their selected model; production adapters choose compatible variants. Never relabel WebM/MP4 bytes as WAV.
- Usage-event quality evaluation uses the 9-item, 1-5 PDQI-9 rubric (total 9-45) scoped to the exact prompt harness, target field, and selected or fallback template. Never penalize content that belongs to another document section unless the target template or clinical safety requires it.

## Prompt Structure

- Shared fragments/builders belong in `prompts/core/`; family-specific static XML belongs directly in `prompts/families/<name>/index.ts`. Avoid family-local `shared/` folders, tiny aliases/wrappers, duplicated family paths, and arrays for fixed strings. Split only for cross-family reuse or genuine scanability.
- Harness wiring, IDs, labels, and aliases belong in `prompts/definitions/` plus the thin `prompts/registry.ts`.
- `anamnese`, `befunde`, `diagnosis`, and `epikrise` use `buildClinicalCorePrompt`. The builder owns identical clinical identity, uncertainty, style, and execution sections; families supply only document-specific slots. `procedure` remains standalone and receives shared uncertainty handling.

## Context, Templates, and Harnesses

- Context is split by `patient`, `template`, and `user`; each domain owns guidance/composition. Inject one combined `contextXml` and assemble date/context/task through the shared context user-prompt envelope.
- Keep `context/template/compose.ts` limited to selected-template references. Rendering/injection belongs in template guidance and `context/index.ts`.
- Template-capable harnesses use real template context when present and context-side built-in fallback otherwise. Fallback files live in `context/template/fallback-templates/`.
- `fillInputs` receives optional template/document information and composes it through the same template-context guidance; log only its character count, never the instruction text.
- Narrative discharge/outpatient/ICU settings share the `epikrise` system prompt; setting differences live only in fallback/user templates. Legacy IDs remain runtime aliases, while new forms offer only `epikrise`.
- Canonical input keys are `notes`, `diagnoseblock`, `anamnese`, `befunde`, and `epikrise`; accept legacy keys only during playground hydration.
- Registry `promptName`/`getPromptHarnessLabel` is the only harness-label source; fallback objects own fallback titles. `befunde` and `procedures` remain distinct harnesses even though both target `befunde`.
- Every harness has one target field via `getPromptHarnessTargetField`. The form main input represents that field and must not be duplicated as context. Context transfer maps main input/output through the same target-field mapping.
