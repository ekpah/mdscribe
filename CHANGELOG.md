# Changelog

## [Unpublished]

### Added

- The file input context now supports photo transfers from an unauthenticated phone via QR code.
- Pasting Markdoc text into the template editor now converts supported input, score, and switch syntax directly into interactive editor tags.

### Changed

- Aligned the landing-page feature previews with their vertical scroll interaction, including right-side pagination, consistent clinical titles, and matching inline vital-sign examples.
- Reworked the landing page copy to address doctors instead of developers: replaced technical terms like "Markdown" and "Markdoc" with "Textbausteine" throughout hero, feature sections, demo labels, and metadata.
- Unified all workspaces on TypeScript 7.0.2 via the root package catalog (workspaces previously used 5.9.3 while the root used 7.0.2).
- Build the app with Turbopack (the Next 16 default) instead of forcing `--webpack`; the flag was a leftover from deploy debugging, not a Turbopack incompatibility.

### Fixed

- Fill-document autofill now strips model-added Markdown JSON fences before structured-output parsing, preventing valid responses from failing with "could not parse the response".
- Amp portal previews now preserve their public URL configuration across setup commands, permit framing only from Amp origins, and ignore generated proxy artifacts.
- Docker build: copy the full pruned deps workspace into the `packages` and `builder` stages instead of only the root `node_modules`, so nested per-workspace `node_modules` from version-conflict resolution survive the stage boundary. Previously `bun x tsc` in `packages/markdoc-md` fell back to the root TypeScript 7 and the build failed with TS5112.
