# Markdoc Guidance

Scope: everything under `packages/markdoc-md`. Root rules still apply.

- Always update this package's `CHANGELOG.md` under the `[Unpublished]` section when creating a commit that touches `packages/markdoc-md`.
- Add each change under the appropriate `Added`, `Changed`, or `Fixed` heading.
- Every named `info`, `switch`, `condition`, or `calc` tag mentions one shared variable identified by its `primary` name (each member of an array `condition` primary is one variable). Each variable has a single contract (`buildVariableContracts`): one value domain (`text`, `enum`, `number`, `boolean`, `date`), agreeing identity settings (`unit`, `description`, `source`, `formula`), and one or more roles (field, selector, computed). Validate through `validateMarkdocTagContracts`; do not add caller-specific duplicate handling.
- Different tag kinds may share a variable when their domains agree: numeric `info`, `condition`, and `calc`. A categorical `switch` cannot share a numeric variable. Conflicting domains or identity settings block template saves; input extraction collapses coexisting mentions to one input per variable in each input list.
- `condition` selects numeric scalar or aligned-array cases. Comparisons (`eq`, `gt`, `gte`, `lt`, `lte`) within one case are ANDed, `null` skips an array member, and the first matching case wins. Condition evaluation lives in `parse/case-conditions.ts`; never reimplement it. `switch` is categorical only.
- Presentation settings such as `renderUnit` remain local to each tag occurrence and must not determine the shared input contract.
- Array conditions align every comparison with primary order. Their unit/description are local, source belongs on individual fields, and case `value` is forbidden. Emit scalar member inputs with separate branch visibility, never group IDs.
- Calc `round` is a shared publication policy, unlike info presentation rounding. Resolve every named calc globally, including those in hidden branches, and round before dependent calculations with `parse/calculated-values.ts`. A non-empty explicit value overrides a calculation; callers decide how manual and AI values combine into explicit values.
- Categorical switch case mappings are merged globally by variable and case key. Formula-only numeric dependencies become inputs; they do not need child declarations.
- Parsing stays tolerant for existing stored templates. Validation is enforced at editor and mutation boundaries rather than by throwing from render paths.
- Formula-only calc/score tags are supported without child declarations; both `formula` and a non-empty `primary` are required.
