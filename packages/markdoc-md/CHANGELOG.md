# Changelog

## [Unpublished]

### Added

- `calc` and numeric `info` tags support a `round` presentation attribute for configurable decimal places or unrounded output.
- Calculated `calc` tags can contain number, option, and checkbox inputs, including numeric case values for formulas.
- Number switches: `switch` tags with `type="number"` (or inferred from condition cases) select the first `case` in document order whose structured condition (`eq`, `gt`, `gte`, `lt`, `lte`, `default=true`) matches; unset values match only the `default` case. Shared evaluation lives in `parse/case-conditions.ts` and is exported (`toCaseCondition`, `matchesCaseCondition`, `resolveMatchedCaseIndex`, `toNumericSwitchValue`, `serializeCaseCondition`).
- Unified variable-contract registry (`buildVariableContracts`, `VariableContract`, `VariableDomain`): every named `info`, `switch`, and `calc` mention contributes to one contract per variable with a value domain, agreeing identity settings, and roles. `analyzeMarkdocTemplate` now also returns `variables`.
- Tag kinds can coexist on one variable when domains agree: `info type="number"` + number `switch` deduplicate to a single input; `switch` on a `calc` renders conditional text on the computed value; `info` on a `calc` displays the computed value. New render-time resolution via `VariableContractProvider` and `useResolvedVariable` (stored value wins, else computed from formula, else raw); exported `evaluateFormula`.
- `switch` tags accept optional `unit` and `description` attributes.

### Changed

- Renamed `score` to `calc` as the canonical tag while preserving `score` as a backward-compatible alias.
- Replaced the `tag-kind-conflict` and `tag-settings-conflict` diagnostics with `variable-domain-conflict` and `variable-settings-conflict`; added `case-condition-invalid`, `case-unreachable`, and `orphan-case`. `MarkdocContractAttribute` no longer includes `type` (type disagreements surface as domain conflicts).
- Calculated tags now declare every referenced component as a nested tag so templates can be validated without interpreting formula text alone.
- Build and type-check against TypeScript 7.0.2 (workspace catalog unified on a single TypeScript version).

### Fixed

- Repeated input contracts and calculated-tag components are validated consistently without duplicating independent inputs.
- Boolean switches now resolve an undefined variable to the `false` case.
- Build script: the public-types check now runs through a dedicated `__tests__/tsconfig.json` (`tsc -p`) instead of passing files on the `tsc` command line, which TypeScript 7 rejects with TS5112 when a `tsconfig.json` is present.
