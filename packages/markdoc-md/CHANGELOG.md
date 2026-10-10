# Changelog

## [Unpublished]

### Fixed

- Editor serialization no longer inserts a blank line before a directly adjacent `details` tag.

### Added

- Editor HTML tables serialize to built-in Markdoc list tables with colspan/rowspan annotations, inline formatting, and line breaks, without custom table schemas or layout metadata. Template rendering and rich-text copying include portable table styling.
- React renderers support an opt-in `layout="template"` that preserves soft breaks, explicit empty lines, and Details-adjacent gaps as real HTML structure, with portable compact typography for rich-text copying. Standard Markdown rendering remains unchanged.
- `details` tags render GitHub-style collapsible sections with an optional `summary` and an `open` default, using native `<details>`/`<summary>` elements. The summary keeps the body font and line height, and the body follows with normal line spacing. A section written directly next to a paragraph or another section (no blank line) continues those lines without a paragraph gap; a blank line keeps the gap, and `renderTipTapHTML`/`htmlToMarkdoc` roundtrip it as an empty editor paragraph. Sections accept rich Markdown, nested tags, and nested sections; inputs inside a collapsed section are still discovered, and editor HTML roundtrips through `{% details %}` blocks.
- `condition` tags select numeric content: a scalar primary with scalar comparisons, or an array primary with positional comparisons where `null` skips a member. Comparisons within a case are ANDed and the first matching case renders. Members become individual number inputs. Evaluation is shared through `parseConditionCase`, `selectConditionCase`, `matchesCaseCondition`, and `toNumericValue`.
- `renameFormulaVariable` renames a variable in a formula, bracketed or bare, adding brackets when the new name needs them.
- `resolveCalculatedValues` and `calculateCalcValue` resolve named calculations globally in dependency order, including hidden ones, applying merged categorical case mappings. `DynamicMarkdocRenderer` publishes these results to all tags.
- Extracted inputs carry occurrence-local branch `visibility`; `isBranchVisible` and `selectedSwitchCases` evaluate it without merging selections of repeated tags.
- `calc` and numeric `info` tags support a `round` presentation attribute for configurable decimal places or unrounded output.
- Calculated `calc` tags can contain number, option, and checkbox inputs, including numeric case values for formulas.
- Unified variable-contract registry (`buildVariableContracts`, `VariableContract`, `VariableDomain`): every named `info`, `switch`, and `calc` mention contributes to one contract per variable with a value domain, agreeing identity settings, and roles. `analyzeMarkdocTemplate` now also returns `variables`.
- Numeric `info`, `condition`, and `calc` mentions share one variable contract. A formula reference to a declared switch reuses that switch as a calc component.
- `switch` tags accept optional `unit` and `description` attributes.

### Changed

- `switch` is categorical only. `type="number"`, array primaries, and comparison cases are rejected (`number-switch-unsupported`, `array-switch-unsupported`, `comparison-in-switch`); repeated options merge globally, conflicting numeric values fail validation, and defaults cannot carry values. Boolean cases count as 1/0 unless mapped individually. Removed the number-switch helpers `toCaseCondition`, `hasCaseCondition`, `resolveMatchedCaseIndex`, and `serializeCaseCondition`.
- `useResolvedVariable` no longer evaluates a variable's contract formula; `DynamicMarkdocRenderer` publishes every named calculation instead, and only a tag carrying its own `formula` (calc) evaluates it.
- Formula constants such as `PI` and `E` are not reported as variables by `getFormulaVariables`, so they never become inputs.
- Named calculations round their result, including explicit overrides, before dependents use it; repeated named calcs must agree on `round` as well as `formula`.
- `calc` requires a non-empty `primary`.
- Calculations stay unset until all formula inputs are filled in (checkboxes always count as filled) and when the result is not finite, instead of treating missing values as 0. `resolveCalculatedValues` leaves such calculations and their dependents `undefined`, `calculateCalcValue` returns `number | undefined`, and `evaluateFormula` returns `undefined` for empty inputs. `calc` and `info` tags show the new `CALC_PLACEHOLDER` (`…`) meanwhile.
- New diagnostics: `calc-variable-not-numeric` for text or date fields used in a formula, `calc-cycle` for named calcs that depend on themselves, and the `case-condition-invalid` reasons `missing-option` for switch cases without a key and `condition-case-value` for condition cases with a `value`; `requires-number-switch` is now `comparison-in-switch`. Keyless switch cases never match. `toNumericSwitchValue` is now `toNumericValue`, which formulas also use.
- Renamed `score` to `calc` as the canonical tag while preserving `score` as a backward-compatible alias.
- Replaced the `tag-kind-conflict` and `tag-settings-conflict` diagnostics with `variable-domain-conflict` and `variable-settings-conflict`; added `case-condition-invalid`, `case-unreachable`, and `orphan-case`. `MarkdocContractAttribute` no longer includes `type` (type disagreements surface as domain conflicts).
- Formula references no longer need child declarations: undeclared references become number inputs, and `calc-components-missing` was removed.
- Build and type-check against TypeScript 7.0.2 (workspace catalog unified on a single TypeScript version).

### Fixed

- A nested mention of a variable no longer suppresses its independent input: input deduplication is per list, and nested inputs keep their branch visibility.
- Editor HTML and Markdoc roundtrips of nested switches and conditions preserve rich case content and comparisons, including inside calc components and tables inside condition cases.
- Info values keep their background across wrapped lines.
- Editor HTML JSON-encodes case values and comparisons and non-string switch/condition primaries, and `htmlToMarkdoc` keeps invalid boolean literals, so invalid stored literals stay invalid after an editor roundtrip.
- Untyped switches with "true"/"false" cases select and map boolean values.
- `round` rounds decimal halves such as `1.005` up instead of down from floating-point error.
- Cases accept rich Markdown and nested template tags without spurious child-schema warnings.
- Editor HTML roundtrips preserve soft and hard line breaks, consecutive and boundary breaks, and empty paragraphs using durable Markdown padding instead of discarded whitespace.
- `calc` and legacy `score` tags accept and preserve their shared `description` and `source` attributes in editor HTML roundtrips.
- Repeated input contracts and calculated-tag components are validated consistently without duplicating independent inputs.
- Boolean switches now resolve an undefined variable to the `false` case.
- Build script: the public-types check now runs through a dedicated `__tests__/tsconfig.json` (`tsc -p`) instead of passing files on the `tsc` command line, which TypeScript 7 rejects with TS5112 when a `tsconfig.json` is present.
