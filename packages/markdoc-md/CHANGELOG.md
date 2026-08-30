# Changelog

## [Unpublished]

### Added

- `calc` and numeric `info` tags support a `round` presentation attribute for configurable decimal places or unrounded output.
- Calculated `calc` tags can contain number, option, and checkbox inputs, including numeric case values for formulas.

### Changed

- Renamed `score` to `calc` as the canonical tag while preserving `score` as a backward-compatible alias.
- Calculated tags now declare every referenced component as a nested tag so templates can be validated without interpreting formula text alone.
- Build and type-check against TypeScript 7.0.2 (workspace catalog unified on a single TypeScript version).

### Fixed

- Repeated input contracts and calculated-tag components are validated consistently without duplicating independent inputs.
- Boolean switches now resolve an undefined variable to the `false` case.
- Build script: the public-types check now runs through a dedicated `__tests__/tsconfig.json` (`tsc -p`) instead of passing files on the `tsc` command line, which TypeScript 7 rejects with TS5112 when a `tsconfig.json` is present.
