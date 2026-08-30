# Markdoc Guidance

Scope: everything under `packages/markdoc-md`. Root rules still apply.

- Always update this package's `CHANGELOG.md` under the `[Unpublished]` section when creating a commit that touches `packages/markdoc-md`.
- Add each change under the appropriate `Added`, `Changed`, or `Fixed` heading.
- Every named `info`, `switch`, or `calc` tag mentions one shared variable identified by its `primary` name. Each variable has a single contract (`buildVariableContracts`): one value domain (`text`, `enum`, `number`, `boolean`, `date`), agreeing identity settings (`unit`, `description`, `source`, `formula`), and one or more roles (field, selector, computed). Validate through `validateMarkdocTagContracts`; do not add caller-specific duplicate handling.
- Different tag kinds may share a variable when their domains agree: `info type="number"` + number `switch`, `calc` + `switch`, `calc` + `info`. Conflicting domains or identity settings block template saves; input extraction collapses coexisting mentions to one input per variable.
- Number switches select the first case in document order whose structured condition (`eq`, `gt`, `gte`, `lt`, `lte`, `default=true`) matches. Condition evaluation lives in `parse/case-conditions.ts` and is shared by validation, extraction, and the React renderer; never reimplement it.
- Presentation settings such as `renderUnit` remain local to each tag occurrence and must not determine the shared input contract.
- Parsing stays tolerant for existing stored templates. Validation is enforced at editor and mutation boundaries rather than by throwing from render paths.
- Formula-only score tags are supported; `formula` is required and `primary` is optional.
