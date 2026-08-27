# Changelog

## [Unpublished]

### Added

- Umami now tracks successful signups, logins, AI Scribe generations, template and document creation, and AI-assisted template and document filling.
- The file input context now supports photo transfers from an unauthenticated phone via QR code.
- Pasting Markdoc text into the template editor now converts supported input, score, and switch syntax directly into interactive editor tags.
- Users can now delete their own text templates from the template editor; dependent AI templates are removed and affected Brief-Baukasten sections revert to the default AI template.
- Users can now delete their own PDF document templates from the document editor.

### Changed

- The dashboard usage card now identifies active BYOK connections while continuing to show the MDScribe quota consumed by requests using other models.
- Aligned the landing-page feature previews with their vertical scroll interaction, including right-side pagination, consistent clinical titles, and matching inline vital-sign examples.
- Reworked the landing page copy to address doctors instead of developers: replaced technical terms like "Markdown" and "Markdoc" with "Textbausteine" throughout hero, feature sections, demo labels, and metadata.
- Unified all workspaces on TypeScript 7.0.2 via the root package catalog (workspaces previously used 5.9.3 while the root used 7.0.2).
- Build the app with Turbopack (the Next 16 default) instead of forcing `--webpack`; the flag was a leftover from deploy debugging, not a Turbopack incompatibility.

### Fixed

- Checkbox inputs now render their initially unchecked state as `false`, while empty date inputs no longer display an uncommitted current-date value.
- The admin user-management AI-usage column now follows each user's quota period and excludes usage billed through their own API key.
- Fill-document autofill now strips model-added Markdown JSON fences before structured-output parsing, preventing valid responses from failing with "could not parse the response".
- Amp portal previews now preserve their public URL configuration across setup commands, permit framing only from Amp origins, and ignore generated proxy artifacts.
- Docker build: copy the full pruned deps workspace into the `packages` and `builder` stages instead of only the root `node_modules`, so nested per-workspace `node_modules` from version-conflict resolution survive the stage boundary. Previously `bun x tsc` in `packages/markdoc-md` fell back to the root TypeScript 7 and the build failed with TS5112.
