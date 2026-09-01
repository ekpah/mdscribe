# Changelog

## [Unpublished]

### Added

- Admins can now create and revise Markdoc templates with an AI agent embedded in the Template Editor sidebar, including audio and file context, while retaining the existing Info view.
- `calc` and numeric `info` tags now support Liquid-style `round` values for configurable decimal places, including `round=false` for unrounded output.
- Calculated template inputs now support nested number, option, and checkbox components, editable overrides, and automatic recalculation.
- Umami now tracks successful signups, logins, AI Scribe generations, template and document creation, and AI-assisted template and document filling.
- The file input context now supports photo transfers from an unauthenticated phone via QR code.
- Pasting Markdoc text into the template editor now converts supported input, calc, and switch syntax directly into interactive editor tags.
- Users can now delete their own text templates from the template editor; dependent AI templates are removed and affected Brief-Baukasten sections revert to the default AI template.
- Users can now delete their own PDF document templates from the document editor.
- Number switches: switch tags can now branch on numeric values with structured case conditions (equal, greater/less bounds, ranges, and a default case), selecting the first matching case; the template editor offers a "Zahl" switch type with a per-case condition editor, and the input panel renders a numeric field with optional unit.
- One template variable can now be shared across tag kinds when their value types agree: a number info and a number switch merge into a single input, a switch can branch on a calculated score, and an info can display a calculated value.

### Changed

- The dashboard usage card now identifies active BYOK connections while continuing to show the MDScribe quota consumed by requests using other models.
- Renamed the Markdoc `score` tag to `calc`, while retaining `score` as a backward-compatible alias across parsing, rendering, the editor, and documentation.
- Fill Inputs now receives template guidance and examples and can prefer component values while accepting an explicit calculated result when components are incomplete.
- Split the generic design primitives, Markdoc TipTap editor, and app-owned input renderer into explicit package boundaries.
- Aligned the landing-page feature previews with their vertical scroll interaction, including right-side pagination, consistent clinical titles, and matching inline vital-sign examples.
- Reworked the landing page copy to address doctors instead of developers: replaced technical terms like "Markdown" and "Markdoc" with "Textbausteine" throughout hero, feature sections, demo labels, and metadata.
- Unified all workspaces on TypeScript 7.0.2 via the root package catalog (workspaces previously used 5.9.3 while the root used 7.0.2).
- Build the app with Turbopack (the Next 16 default) instead of forcing `--webpack`; the flag was a leftover from deploy debugging, not a Turbopack incompatibility.

### Fixed

- Mobile sidebars now use their configured background and foreground colors, and selecting a template input no longer navigates away from the input panel.
- Number inputs now accept `.` and `,` decimal separators without resetting the cursor, including calculated template component fields.
- The landing page no longer overflows horizontally or shifts when the Avatar menu opens.
- Template validation now synchronizes repeated input contracts, repairs missing calculated components, and keeps interactions scoped to the correct repeated tag instance.
- Checkbox inputs now render their initially unchecked state as `false`, while empty date inputs no longer display an uncommitted current-date value.
- The admin user-management AI-usage column now follows each user's quota period and excludes usage billed through their own API key.
- Fill-document autofill now strips model-added Markdown JSON fences before structured-output parsing, preventing valid responses from failing with "could not parse the response".
- Amp portal previews now preserve their public URL configuration across setup commands, permit framing only from Amp origins, and ignore generated proxy artifacts.
- Docker build: copy the full pruned deps workspace into the `packages` and `builder` stages instead of only the root `node_modules`, so nested per-workspace `node_modules` from version-conflict resolution survive the stage boundary. Previously `bun x tsc` in `packages/markdoc-md` fell back to the root TypeScript 7 and the build failed with TS5112.
