# App Guidance

Scope: everything under `apps/app`. Root rules still apply. Scribe and shared input code have additional nested guidance.

## Architecture and Boundaries

- oRPC bases are `pub` and `authed` in `orpc.ts`; the router is `orpc/router.ts`. App routes/components use oRPC with TanStack Query and never import database helpers directly.
- BetterAuth: server code calls `auth.api.getSession(...)`; client code uses `useSession()`. Prefer direct `auth.api.*` calls over one-off forwarding wrappers.
- AI streaming handlers live in `orpc/scribe/handlers/`, prompts in `orpc/scribe/prompts/`, context in `orpc/scribe/context/`, and clients use `useScribeStream`.
- Templates use Markdoc plus TipTap and 1024-dimensional Voyage embeddings.
- `Template.information` and `DocumentTemplate.information` contain author-provided filling instructions. Render them as a distinct `<information>` block during AI generation/autofill; they are not example or clinical content, and document information stays outside PDF input definitions.
- Templates and documents are `public` or `private`. Public items are visible/useable/forkable by everyone; private items are author-only and require Plus to create or keep private.
- All German user-facing strings belong in `lib/user-messages.ts` (`USER_MESSAGES`). Translate visible labels, placeholders, aria labels, and permission errors before handoff.

## Legal Scope

- The privacy policy and general terms on `/legal` apply only to the MDScribe cloud service operated at `mdscribe.de`.
- For self-hosted or on-premise installations, MDScribe sells a software license but does not control deployment or the customer's data processing. The operator is independently responsible for infrastructure, privacy notices, and data protection.
- Do not make blanket Zero Data Retention claims unless every configured provider, fallback, embedding path, and internal log path technically enforces and verifies that promise.
- The operator confirms that MDScribe's own similar-product email marketing satisfies every condition of the existing-customer exception in § 7(3) UWG. The marketing preference may default to enabled for these eligible customers, must not be described as consent, and must preserve the required collection-time notice, notice in every message, and immediate free objection.

## Providers and Models

- Use only admin-configured DB providers/models; the DB is authoritative. `AiProvider` owns encrypted `apiKey`; `AiModel.providerId` is the FK and `(providerId, modelId)` is the sync key.
- The standard text model always produces the final answer. Its declared document/audio capabilities determine native attachment; undeclared media uses the configured speech-to-text or file/image slot in `direct` or `multimodal` mode. There is no multimodal default slot.
- OpenRouter sync requests `output_modalities=all` so transcription models appear, but does not infer/store modalities. Its STT endpoint uses JSON `input_audio: { data, format }`, not multipart form data.
- OpenAI-compatible providers require an explicit base URL. Sync models on connection creation and manual refresh; validate connectivity before persistence.
- Store OpenRouter `supported_parameters` in `AiModel.supportedParameters`; normalize missing values to `[]` at API/UI boundaries. Only send reasoning settings when the model explicitly advertises support.
- Default-model temperature is per slot in `AiDefaults`, resolved through `buildDefaultSelection`: explicit caller value → slot default → provider default (omit). Do not add model-level or single global temperature. Deterministic preprocessing and explicit playground values remain explicit.
- Tinfoil uses its Apache-2.0 SDK (`createTinfoilAI`/`TinfoilAI`) for attested HPKE generation and STT, never plain inference HTTP. Cache clients per credentials and evict failed handshakes. Sync only public catalog `chat|audio` models; map explicit reasoning support and do not fabricate parameter lists.

## Frontend and Admin UX

- Reuse and fix matching primitives from `packages/design-system` instead of creating local copies.
- `/admin/input-playground` is the audio playground: recording, transcription-model selection, and transcript only. Each audio row owns one play/pause control and scrubber; no speed menu or multi-track provider.
- `/admin/playground` attaches original truthful media directly to the selected model; it never routes media through global preprocessing. Defaults are temperature `1` and unset `maxTokens`.
- Prompt comparison has independent Prompt A/B base-prompt and template selectors; B is seeded from A and compiles through `orpc.admin.scribe.compilePrompt`. Highlight complete innermost XML sections by composition origin, never value matching or unpaired tag mentions.
- Playground results/editors grow with content. Overlay editors use an in-flow mirror plus absolutely stretched textarea and visible caret; plain growing textareas need JS autosizing because Firefox/Safari lack reliable `field-sizing` support.
- Template selectors use grouped design-system `Select` primitives; `Keins` stays unlabelled and only categories get labels. Keep ownership/favourite details in the adjacent tooltip, not selected values or badges.
- Right-edge template tabs switch only the preview/examples/information pane. The examples and information views each show an analogous horizontally and vertically centered empty-state card when no content is stored. Use singular `Like` only for exactly one. Workspace placeholders derive from existing template content.

## AI Vorlagen and Context Transfer

- User-facing wording is feminine `AI Vorlage` / `AI Vorlagen`; keep historical internal identifiers unchanged.
- `AiScribeFormConfig` is the source of truth. Global forms have `authorId = null`; user forms have an author. Public forms are globally available; private forms are owner-only and require Plus.
- Public execution is `/aiscribe/custom/[slug]`; user management is `/profile/ai-scribe` through root `orpc.scribeForms`. Do not recreate `orpc.user.scribeForms` or hash-based profile tabs.
- Built-in routes may use enabled DB overrides with the fixed `builtin-*` slugs. Overrides are managed separately under admin “Schnelle Dokument-Generierung” and excluded from public custom-form listings.
- Keep form configuration minimal: basis prompt/template and current clinical inputs, without per-form model, temperature, token, thinking-budget, or input-preset settings unless explicitly reintroduced.
- Context transfer is zero-knowledge: client token/key, AES-GCM ciphertext, server stores only a short-lived one-time token hash plus opaque envelope, and launch data stays in the URL fragment. Never place clinical plaintext or keys in queries, localStorage, logs, or usage events. Shared crypto lives in `lib/context-transfer-crypto.ts`.
- Model comparison reuses admin usage list/get and `orpc.admin.scribe.run`; replay only eligible built-in, non-redacted events.

## Template Editor and Documents

- For authenticated local UI verification, obtain the test database admin credentials from the repository seed data instead of treating the sign-in screen as a blocker.
- Template Markdoc validation is inline in TipTap and blocks save on errors. Source editing is admin-only. Page data lives in `app/templates/_lib/editor-page-data.ts`; categories come from `orpc.templates.editorContext`; templates support up to ten examples and user collections.
- Documents has remained feature-flagged and has never been deployed to real users. Until its first production release, replace draft document schema shapes directly; do not add compatibility adapters, data migrations, or schema version fields for superseded document definitions.
- Documents persist `DocumentTemplate.fieldDefinitions` as `{ inputs, bindings }` plus `pdfBytes`. `inputs[].attributes.primary` is the stable form/runtime value key; each binding connects one PDF `fieldName` to that key through `inputId` and may define an explicit `valueMap`. PDF field metadata is parsed when editing and is not persisted. Never persist document `parsedMarkdoc`/raw Markdoc.
- Document bindings may repeat a PDF `fieldName` when a multi-widget checkbox is intentionally split into separate boolean inputs. PDF filling resolves repeated bindings as one field operation and rejects conflicting non-empty selections. Separate PDF checkbox fields may share one choice input through per-binding `true`/`false` value maps.
- In the document editor, detach checkbox-backed choice options individually from the option row. Group separate checkbox cards through an explicit "Checkbox als Option hinzufügen" selection mode where the next eligible checkbox card click joins the target choice; do not use a target dropdown on the source card.
- Document detail and editor views switch the right preview column between PDF and information through the shared vertical edge tabs. Edit document information only in that right-column information view.
- Render one document-editor card per Markdoc input, even when multiple PDF fields bind to it. Show the bound PDF fields within that card and highlight every corresponding PDF widget together; adding a checkbox binding must not duplicate the Markdoc input card.
- Identify a multi-widget checkbox preview target by both its PDF `fieldName` and raw widget export value. After splitting or moving an option, highlight only the widget values owned by that Markdoc input's bindings.
- Use the same binding-aware `(fieldName, exportValue)` preview targeting in the document filling view. Bounding boxes stay in the PDF annotations and must not be persisted separately in the database.
- Keep document inputs PDF-agnostic render definitions. Bindings and their value maps own all PDF field and widget translation, including split and grouped checkboxes; Markdoc inputs must not encode or depend on the PDF field architecture.
- Treat PDF text fields configured as visual checkboxes as checkbox-like only after they have an explicit boolean `valueMap` (normally `true: "x"`, `false: ""`). They may be grouped into a Markdoc choice switch, where each binding writes its checked display value for its own option and blank for every other option.
- Classify unsupported AcroForm fields and multiselect option lists explicitly and keep their bindings disabled. Repeated checkbox widgets are a boolean when they share one export value and a choice only when they expose distinct export values.
- Enforce PDF byte, page, field, and widget limits on the server as well as in upload UI. Server save validation must reject binding values the parsed PDF field cannot represent.
- Document CRUD/PDF transport stays under `orpc.documents.templates.*`; parsing stays `orpc.documents.parseForm`; AIScribe OCR helpers stay under `orpc.scribe.*`. `list`/`get` exclude bytes and `getPdf` returns them. Do not add an HTTP PDF route.
- Document AI editing uses `orpc.documents.enhanceDefinition` and proposes the existing complete `{ inputs, bindings }` definition. Validate proposals against server-parsed PDF metadata and preserve exact PDF field names; do not introduce a second AI-only mapping schema.
