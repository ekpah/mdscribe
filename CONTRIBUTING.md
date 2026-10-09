# Contributing to MDScribe

Thank you for your interest in contributing to MDScribe! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (v1.2+)
- Node.js 18+
- Git

### Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/mdscribe.git
   cd mdscribe
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```

4. Fill in the required environment variables in `.env`. See the [README](README.md) for details.

5. Start local PostgreSQL:
   ```bash
   bun run db:up
   ```
   This command also runs `db:init` to apply schema and idempotent development seed data.

6. Start the development server:
   ```bash
   bun dev
   ```

   The app runs on `http://localhost:3000`.

The app runs under Bun. Development and production builds use Webpack because
Turbopack's hashed external ESM module names fail to resolve under Bun on a
fresh start (including `sharp` and `privatemode-ai`). Docker still builds Next
under Node for build-worker compatibility; the production server remains Bun.
The Privatemode SDK itself does not require switching the app to Node, and is
loaded only when a Privatemode client is needed.

### Scribe OCR

All document OCR goes through one function, `extractOcrDocument` in
`apps/app/orpc/scribe/ocr/index.ts`. It takes a PDF or image and returns the
shared `OcrResult` (`apps/app/lib/ocr-types.ts`): Markdown text with HTML tables,
plus optional citation boxes per page. Boxes use a top-left origin in the
supplied, manually aligned page frame (PDF points or image pixels). Text is
preserved independently of boxes; consumers must never reconstruct tables from
citation geometry.

The engine is the admin's **Dokumenten-Modell** setting. Each engine is an adapter
in `ocr/adapters/` implementing `OcrAdapter` (`ocr/adapter.ts`):

| Adapter          | Engine                                          | Input          |
| ---------------- | ----------------------------------------------- | -------------- |
| `llm.ts`         | Vision LLM with structured output (incl. OpenRouter and Tinfoil) | rendered pages |
| `ocr-http.ts`    | Self-hosted OCR HTTP, e.g. `services/paddleocr` | rendered pages |
| `privatemode.ts` | DeepSeek OCR 2 via the attested Privatemode SDK | rendered pages |
| `mistral.ts`     | Mistral OCR 4 native document API               | original file  |

**Manual alignment is a product requirement.** Users must align images before
OCR and explicitly confirm their orientation in the preview, including images
that already look upright. Neither the application nor PaddleOCR detects or
corrects page/text-line orientation. A legacy HTTP service may report
`rotation: 0`; nonzero corrections are rejected. EXIF and PDF display metadata
are still applied consistently with the original preview; this is not content
orientation detection.

Mistral requests `table_format: "html"` and integrates separately returned tables
into the page transcription, retaining `rowspan` and `colspan`. Generic vision
LLMs, including OpenRouter's Mistral Large 4, use the same structural `text` and
`blocks` output schema and HTML-table prompt; they do not use Mistral's dedicated
OCR endpoint. Invalid geometry may omit citation boxes without losing text.
`OcrTextPreview` renders Markdown and HTML through one inert React allowlist:
source URLs, CSS, events and executable elements never become active. Template
renderers are not used because OCR text must not execute template syntax.

Page adapters receive EXIF-corrected JPEGs of at most 3000 px per side.
PDFs are rendered with LiteParse; images bypass it. To add an engine, add an
adapter, a branch in `createOcrAdapter`, and the provider protocol and connection
check in `lib/ocr-protocol.ts` and `orpc/admin/providers.ts`. Adapters own the
provider request, response validation, and box normalization; they must not put
document content into error messages. Authentication, quotas, and usage logging
stay in the oRPC handlers.

In orbs, setup installs the PaddleOCR service from `services/paddleocr` and
`.amp/services.yaml` runs it on port 8829. Development seeding adds it as a
selectable document model (not the default: it needs about 12 GB of RAM for a
phone photo), plus Mistral OCR and Privatemode OCR when `MISTRAL_API_KEY` or
`PRIVATEMODE_API_KEY` is set.

With a document model selected, PDF uploads run OCR immediately
(`scribe.extractContextFile`). Image uploads wait for manual alignment: users
can turn an image left or right, then select "Ausrichtung bestätigen und OCR
starten". Submitting cannot bypass this step, even with a vision-capable
generation model. Without a document model, previews show only the original,
no OCR controls or requests; generation sends original bytes to a model with
native document/vision capability instead.

Generation submissions use the shared `ContextDocument` union in
`apps/app/lib/ocr-types.ts`. With OCR enabled, `OcrContextDocument` carries
only `kind: "ocr"`, `name`, and `ocrResult` (text and optional page boxes).
It contains no `data`, MIME type, or original file size. OCR results are structurally validated user-provided
context, like other text inputs, not proof of provider provenance. There is no
signature, expiry, or model binding. The browser retains the file locally, but
submission reuses the preview result without uploading it or running OCR again,
even after an OCR model change. Only an explicit retry, rotation, or replacement
runs OCR again. Login and OCR endpoint authentication remain required. The
generator receives indexed document JSON containing text and geometry, never
original bytes. Standard generation, autofill, and agents share this contract;
citation emission is not yet implemented. Internal raw-file callers still support OCR
preprocessing and return updated results for their previews. Non-ZDR
`ai_scribe_ocr` usage events include the page geometry under `metadata.ocr`; ZDR
omits it and redacts the OCR text. Initial OCR events retain uploaded-file metadata
(name, MIME type, original size, decoded byte count), including under ZDR. Later
generation/autofill/agent summaries for OCR documents contain only `index`, `name`,
and `payloadBytes` calculated from the submitted OCR JSON. Standard generation
logs OCR text/geometry in its input notes only without ZDR; autofill and agents
log document summaries rather than OCR source content. Generation and agent ZDR
events omit input data; autofill retains its payload summary in metadata but
omits input data and redacts its output. Uploaded bytes and rendered images are
never logged. Reusing an OCR result creates no additional OCR event.

LiteParse has platform-specific native/PDFium dependencies, so do not omit
optional npm dependencies. It runs in-process without its worker pool, which is
incompatible with Bun 1.2.

## Project Structure

MDScribe is a monorepo managed with Bun workspaces and Turborepo:

- `apps/app` — Main Next.js application
- `apps/docs` — Documentation site (Fumadocs)
- `packages/database` — Drizzle ORM schema and client
- `packages/design-system` — Shared UI components
- `packages/email` — Email sending utilities
- `packages/markdoc-md` — Custom Markdoc extensions for medical templates

## Available Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun run build` | Build all packages |
| `bun run lint` | Lint all packages (Ultracite/OXC) |
| `bun run test` | Run tests |
| `bun run knip` | Check for unused dependencies |
| `bun run db:up` | Start local PostgreSQL container |
| `bun run db:down` | Stop local PostgreSQL container |
| `bun run db:init` | Re-run schema + idempotent seed |

## Branching Strategy

- `main` — Production branch, only receives merges from `staging`
- `staging` — Integration branch, all feature branches merge here first
- Feature branches are created from `staging`

### Branch Naming

- Features: `feature/<description>`
- Bug fixes: `fix/<description>`

### Workflow

1. Create a branch from `staging`:
   ```bash
   git checkout -b feature/my-feature origin/staging
   ```
2. Make your changes
3. Open a pull request targeting `staging`

## Code Style

We use [Ultracite](https://www.ultracite.ai/) v7 with [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) for linting and formatting.

Key conventions:

- **TypeScript**: Use `type` imports, avoid `any`, use `as const` for readonly values
- **Components**: Named exports, prefer React Server Components
- **Event handlers**: Prefix with `handle` (e.g., `handleClick`)
- **Boolean props**: Use auxiliary verbs (e.g., `isLoading`, `hasError`)
- **Styling**: Tailwind CSS v4 with design system tokens
- **Iteration**: Use `for...of` instead of `Array.forEach`
- **Functions**: Use arrow functions instead of function expressions

Run the linter before submitting:

```bash
bun run lint
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Ensure `bun run lint` and `bun run build` pass
- Add tests for new functionality where applicable
- Target the `staging` branch

## Licensing

MDScribe is open-source software licensed under the **Apache License 2.0**
(`Apache-2.0`). Contributions are accepted under the same license.

This project uses the [Developer Certificate of Origin 1.1](DCO). Sign off every
commit to certify that you have the right to submit the contribution:

```bash
git commit --signoff
```

The sign-off adds a `Signed-off-by: Name <email>` trailer using your Git author
identity. By contributing, you certify the statements in the DCO; this is not a
copyright assignment.
