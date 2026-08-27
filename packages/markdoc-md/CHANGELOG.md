# Changelog

## [Unpublished]

### Added

### Changed

- Build and type-check against TypeScript 7.0.2 (workspace catalog unified on a single TypeScript version).

### Fixed

- Boolean switches now resolve an undefined variable to the `false` case.
- Build script: the public-types check now runs through a dedicated `__tests__/tsconfig.json` (`tsc -p`) instead of passing files on the `tsc` command line, which TypeScript 7 rejects with TS5112 when a `tsconfig.json` is present.
