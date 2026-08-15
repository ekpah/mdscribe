# Changelog

## [Unpublished]

### Added

### Changed

- Unified all workspaces on TypeScript 7.0.2 via the root package catalog (workspaces previously used 5.9.3 while the root used 7.0.2).
- Build the app with Turbopack (the Next 16 default) instead of forcing `--webpack`; the flag was a leftover from deploy debugging, not a Turbopack incompatibility.

### Fixed

- Docker build: copy the full pruned deps workspace into the `packages` and `builder` stages instead of only the root `node_modules`, so nested per-workspace `node_modules` from version-conflict resolution survive the stage boundary. Previously `bun x tsc` in `packages/markdoc-md` fell back to the root TypeScript 7 and the build failed with TS5112.
