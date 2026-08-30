# `markdoc-md`

Typed Markdoc schemas, validation, source resolution, and optional React rendering for templates
that read input values, conditionally render text, calculate values, and cite source material.

## Install

```sh
npm install markdoc-md
```

`@markdoc/markdoc` is installed automatically as a production dependency. The React peer is
optional; install `react` and `react-dom` when using `markdoc-md/react`. The package is ESM-only,
supports Node.js 20 or newer, includes TypeScript declarations and source maps, and does not require
React for parsing, validation, citation resolution, or FHIR source evaluation.

## Public entry points

| Import | Purpose | Runtime |
| --- | --- | --- |
| `markdoc-md` | Headless config, validation, input analysis, source and citation helpers | Node or browser |
| `markdoc-md/config` | Default Markdoc schema | Node or browser |
| `markdoc-md/parse` | Input analysis, validation, and boolean coercion | Node or browser |
| `markdoc-md/citations` | Source parsing and injectable citation resolvers | Browser-oriented; HTTPS/FHIR work in Node |
| `markdoc-md/sources` | FHIRPath-backed input source evaluation | Node or browser |
| `markdoc-md/react` | React renderer, providers, hooks, and default components | React client/SSR |
| `markdoc-md/editor` | Tolerant HTML rendering and browser-only HTML-to-Markdoc conversion | Node or browser as documented |

Only these entry points are public. Imports into package-internal directories are intentionally not
supported.

## Quick start

```ts
import {
  analyzeMarkdocTemplate,
  validateMarkdocTemplate,
} from "markdoc-md";

const template = `{% info "patient_name" /%}`;
const diagnostics = validateMarkdocTemplate(template);
const { inputs } = analyzeMarkdocTemplate(template);
```

```tsx
import { DynamicMarkdocRenderer } from "markdoc-md/react";

export function Preview() {
  return (
    <DynamicMarkdocRenderer
      markdocContent={`Hello {% info "patient_name" /%}`}
      variables={{ patient_name: "Ada" }}
    />
  );
}
```

The default React components emit semantic elements, `data-*` hooks, and utility class names. They
remain functional without a CSS framework. Applications can replace any component or pass a
custom wrapper class through `DynamicMarkdocRenderer`.

## Extending the schema

The package exports a regular Markdoc `Config`. Compose it explicitly when adding schemas, and pass
the same resulting config to validation and rendering so both boundaries agree:

```tsx
import { markdocConfig, validateMarkdocTemplate } from "markdoc-md";
import { renderMarkdocAsReact } from "markdoc-md/react";

const config = {
  ...markdocConfig,
  tags: {
    ...markdocConfig.tags,
    badge: {
      attributes: { tone: { type: String } },
      children: ["text"],
      render: "Badge",
    },
  },
};

const diagnostics = validateMarkdocTemplate(source, config);
const output = renderMarkdocAsReact(source, {
  config,
  components: { Badge },
});
```

For `info`, `switch`, and `case`, the first positional string is the `primary` attribute. These two
`info` forms are therefore equivalent:

```markdoc
{% info "patient_name" /%}
{% info primary="patient_name" /%}
```

## `cite`

Marks inline content as a citation. Clicking the rendered mark asks the host application to resolve
the source and show it in the source modal. Hovering highlights one citation; holding Command on
macOS or Control on other platforms highlights all citations.

```markdoc
{% cite source="mdscribe://file/FILE_ID" quote="The phrase in the source" %}
  visible cited text
{% /cite %}
```

| Attribute | Required | Meaning |
| --- | --- | --- |
| `source` | Yes | URI-like source reference described below. |
| `quote` | No | Phrase to find and highlight in the resolved source. Matching is case-insensitive and whitespace-normalized for MDScribe input and file sources. |

The body is the visible citation mark and may contain text, emphasis, strong text, and inline code.
Links, nested citations, other Markdoc tags, and block content are rejected at validation
boundaries. Tolerant rendering keeps the visible body of malformed stored templates but makes an
invalid citation inert. `quote` lookup is best-effort. If the phrase is not found, the source still
opens without a text highlight or document bounding box.

### Citation source forms

| Source | Meaning |
| --- | --- |
| `mdscribe://file/<id>` | A file in the current MDScribe file context. Encode the ID as one URI path segment. |
| `mdscribe://input/<id>` | A text field or immutable text snapshot in the current MDScribe text context. |
| `https://...` | An external page displayed in a sandboxed, no-referrer modal iframe. |
| `fhir://<FHIRPath>` | A non-empty FHIRPath expression evaluated against the configured FHIR Bundle, or handled by a custom FHIR resolver. |

`source` is an application-resolved URI: its scheme selects a resolver and does not by itself
authorize browser navigation. The built-in `mdscribe` scheme is an opaque registry format that a
host may map to any storage system. Only credential-free HTTPS URLs are accepted as external
sources; `http://` URLs and HTTPS URLs containing a username or password are rejected. Custom
schemes are never passed to browser navigation. Bare file IDs and the legacy `file` and `url`
attributes are not supported; use `source` and construct internal references with
`createMdscribeSource`.

Examples:

```markdoc
{% cite source="mdscribe://input/anamnese" quote="Keine bekannten Allergien" %}Allergies{% /cite %}

{% cite source="https://example.org/report#results" %}published report{% /cite %}

{% cite source="fhir://Observation.where(code.coding.code = '718-7').last().value" %}latest value{% /cite %}
```

### Citation fragments

Everything before `#` is the source identity. The fragment is a source-specific locator. The
following locator conventions are reserved:

| Fragment | Intended source | Meaning |
| --- | --- | --- |
| `#page=<page>&bbox=<x>,<y>,<width>,<height>` | `mdscribe://file/...` | A rectangular document region. Pages are 1-based; bounding-box values use document/page coordinates. |
| `#char=<start>,<end>` | `mdscribe://input/...` | A half-open character range (`start` inclusive, `end` exclusive) in an immutable text snapshot. |
| `#path=<path>` | `fhir://...` | A structured subpath interpreted by a custom FHIR resolver. |
| Any remote-defined fragment, such as `#results` | `https://...` | Passed through to the external page and interpreted by that page. |

Examples:

```text
mdscribe://file/report-123#page=2&bbox=10,20,300,80
mdscribe://input/anamnese#char=120,182
fhir://Patient.where(id='123')#path=name.family
https://example.org/report#results
```

There is currently no fragment allowlist: parsable URI fragments are retained even when they do
not use one of these conventions. Unknown fragments have no built-in MDScribe behavior; an HTTPS
page or a custom resolver may give them meaning.

Current built-in behavior:

- The parser preserves file and input fragments separately from their IDs.
- The built-in file and input resolvers currently locate `quote` dynamically and do not yet apply
  `page`/`bbox` or `char` fragments.
- The default FHIR resolver evaluates the expression before `#`; a custom FHIR resolver may
  interpret `#path`.
- HTTPS fragments are part of the iframe URL and behave according to the remote page.

Use a `quote` when a citation should locate content with the current built-in resolvers. Use a
fragment when the application has a resolver that understands it, or when storing a stable locator
for future/persisted resolution. Character offsets only remain valid when the referenced input is
immutable or revisioned. Citations that must survive source edits should resolve against an
immutable snapshot, content hash, or revision. The host registry owns source content, labels, MIME
types, revisions, and access policy while the Markdoc citation stays compact.

Citation sources are limited to 8,192 characters and quotes to 4,000 characters. The built-in
input resolver accepts up to 2 MiB of source text. Matching is Unicode-normalized,
case/diacritic-insensitive, whitespace-tolerant, and handles words hyphenated across line breaks.

## `info`

Renders one value from the renderer's `variables` object. The `primary` value is the variable key.
If the key is absent, the tag renders an empty value.

```markdoc
{% info "weight" type="number" description="Current body weight" unit="kg" round=1 renderUnit=true /%}
```

| Attribute | Required | Default | Meaning |
| --- | --- | --- | --- |
| `primary` | Yes | — | Variable/input key. It may be written as the first positional string. |
| `type` | No | `string` | Input contract: `string`, `number`, or `date`. |
| `description` | No | — | Human-readable input guidance/metadata. |
| `unit` | No | — | Unit metadata. |
| `round` | No | — | For numeric inputs, rounds the rendered value to this many decimal places. `false` leaves it unrounded. |
| `renderUnit` | No | `false` | Appends `unit` to the rendered value when true. |
| `source` | No | — | Source metadata, for example a `fhir://...` expression used by an upstream value-population flow. The renderer itself does not fetch it. |

## `switch` and `case`

`switch` selects one immediate `case` whose `primary` value equals the current variable value. A
`case` is only meaningful inside a `switch`.

```markdoc
{% switch "smoking" type="boolean" %}
  {% case "true" %}Current smoker{% /case %}
  {% case "false" %}Not a current smoker{% /case %}
{% /switch %}
```

### `switch` attributes

| Attribute | Required | Default | Meaning |
| --- | --- | --- | --- |
| `primary` | Yes | — | Variable/input key. It may be written as the first positional string. |
| `type` | No | `string` | `string`, `boolean`, or `checkbox`. `checkbox` has the same rendering contract as `boolean`. |
| `source` | No | — | Source metadata used by an upstream value-population flow. The renderer itself does not fetch it. |

For `boolean` and `checkbox`, boolean values, `0`/`1`, and the strings `"false"`/`"true"` or
`"0"`/`"1"` are normalized to the matching case name. String switches only match string values.
Only immediate `case` children are rendered; unrelated child tags are discarded by the transform.

### `case` attributes

| Attribute | Required | Meaning |
| --- | --- | --- |
| `primary` | Yes | The value that must equal the enclosing switch value. It may be written as the first positional string. |

The body may contain inline text and formatting.

## `calc`

Evaluates an `fparser` formula against the renderer's variables and displays the result. Boolean
values and the strings `"true"`/`"false"` become `1`/`0`. Numeric results are rounded to at most two
decimal places by default. Set `round` to another number of decimal places or to `false` to leave the
result unrounded. An invalid or unevaluable formula renders `...` instead of throwing.

Every variable referenced by the formula must be included as an `info` or `switch` child of that
calculation. The children appear together below the calculated value in the Inputs panel but are ignored
when rendering document content. Boolean and `checkbox` switches become `1` when checked and `0`
when unchecked. String switches use the numeric `value` of their selected case:

```markdoc
{% calc primary="risk_score" formula="[age] + [age_group] + [smoker]" unit="points" %}
{% info "age" type="number" /%}
{% switch "age_group" %}{% case "under-65" value=0 %}Under 65{% /case %}{% case "65-plus" value=2 %}65 or older{% /case %}{% /switch %}
{% switch "smoker" type="checkbox" %}{% case "true" %}Yes{% /case %}{% case "false" %}No{% /case %}{% /switch %}
{% /calc %}
```

| Attribute | Required | Default | Meaning |
| --- | --- | --- | --- |
| `formula` | Yes | — | Formula evaluated by `fparser`; bracketed names refer to variables. |
| `primary` | No | — | Stable name for the calculated value. Formula-only calculations are supported. |
| `unit` | No | — | Display unit. |
| `round` | No | `2` | Number of decimal places, from `0` to `100`; `false` disables rounding. |
| `renderUnit` | No | `false` | Appends `unit` to the result when true. |

## Shared input contracts

Repeated `info`, `switch`, or named `calc` tags with the same `primary` refer to one logical value.
Repeated occurrences may omit metadata, but their non-empty contract attributes must not conflict:

- `info`: `type`, `unit`, `description`, and `source`
- `switch`: `type`, `source`, and numeric `value` for cases with the same key
- named `calc`: `formula`

An `info` and a `switch` must not reuse the same `primary`. Presentation-only settings such as
`round` and `renderUnit` may differ between occurrences.

## Rendering and validation

Validate templates at editor and mutation boundaries with `validateMarkdocTemplate`. It combines
Markdoc syntax/schema diagnostics, citation-source validation, and the shared input-contract checks
used by `validateMarkdocTagContracts`:

```ts
const diagnostics = validateMarkdocTemplate(template);
const blocksSave = diagnostics.some((item) => item.severity === "error");
```

Rendering intentionally remains tolerant for older stored templates. Invalid citations render as
annotated, non-interactive text instead of throwing or invoking a resolver. Invalid or missing
attributes on `info`, `switch`, `case`, and `calc` also render inertly or with the calculation `...`
fallback. Malformed calc formulas are reported as `calc-formula-invalid` schema diagnostics.

`score` remains accepted as a legacy alias for `calc`. Rendering and editor serialization normalize
legacy `{% score %}` tags to canonical `{% calc %}` syntax.
`analyzeMarkdocTemplate` returns the same complete diagnostics alongside discovered inputs.

The package root and `markdoc-md/citations` export `parseCitationSource`, `createMdscribeSource`,
`resolveCitation`, resolver types, limits, and quote-search helpers. `resolveCitation` always
returns a resolution result, normalizes custom-resolver failures, and accepts an optional
`AbortSignal` through its context. Context capabilities are optional: an HTTPS citation can be
resolved with `{}`, while text, file, and FHIR sources only require their corresponding context.

Document quote lookup can use the default HTTP endpoint or a host-provided resolver:

```ts
const result = await resolveCitation(citation, {
  files,
  createFileUrl: (file) => URL.createObjectURL(file),
  documentResolver: async (file, quote, signal) => {
    // Return a validated CitationDocumentLocation or null.
    return locateQuoteInYourDocumentService(file, quote, signal);
  },
});
```

File persistence, authentication, extraction, caching, request limits, and object-URL revocation
remain host-application responsibilities. External HTTPS previews use a sandboxed, no-referrer
iframe; sites that deny embedding through CSP or `X-Frame-Options` may not display in the modal.

Errors have a stable `code` discriminator suitable for localization; the bundled English message
is a safe fallback. Host resolver exceptions are not exposed verbatim.

`DynamicMarkdocRenderer` is exported from `markdoc-md/react` and receives the template and its
current variables:

```tsx
<DynamicMarkdocRenderer
  markdocContent={template}
  variables={{ age: 42, smoker: true }}
  onCitationSelect={(citation) => openCitation(citation)}
  onTagSelect={(primary) => focusInput(primary)}
/>
```

`onCitationSelect` receives `{ source: string, quote?: string }`. Citation source resolution and the
modal are host-application responsibilities; the renderer only emits the selection event. The
library does not bundle a source picker or preview modal. A host can offer inputs for every built-in
source form—file registry entry, text snapshot, HTTPS URL, or FHIRPath—and serialize the selection
with `createMdscribeSource` or the documented URI syntax.

`renderMarkdocAsReact` is the lower-level SSR-safe renderer. It accepts custom `config` and
`components` maps. `renderTipTapHTML` from `markdoc-md/editor` produces HTML without requiring a DOM.
`htmlToMarkdoc` performs the reverse conversion and deliberately throws outside an environment with
`DOMParser`; use `isHtmlToMarkdocSupported()` before offering that editor action.
