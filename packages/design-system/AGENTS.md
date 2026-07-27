# Design System Guidance

Scope: `packages/design-system`.

- UI primitives use Base UI (`@base-ui/react`, `base-rhea`), never Radix. Follow upstream shadcn structure, use `render` rather than `asChild`, and prune unused exports so knip stays clean.
- Use Base UI state attributes (`data-open`, `data-closed`, `data-active`, `data-hidden`, `data-pressed`) and variables (`--anchor-width`, `--available-height`), not Radix equivalents.
- Base UI specifics: single accordion uses `multiple={false}`; toggle-group values are arrays; tabs use `keepMounted`; tooltip delay is `delay`. `Select.GroupLabel` stays inside `Select.Group`; standalone dropdown labels render a plain `div`.
- Use `SearchableSelect` for long predefined lists that benefit from filtering; keep short enum choices on `Select` so they retain native listbox semantics without a redundant input.
- Tailwind v4 uses existing semantic/Solarized tokens. Do not expand `@theme` for one-off states.
- Solarized neutrals swap automatically in dark mode. Write light-mode neutral classes without `dark:` overrides and never use raw Solarized variables in components.
- Canvas APIs need resolved CSS colors, not Tailwind token names. Prefer inherited `text-*` color for `LiveWaveform` and omit `barColor` when possible.
- Tag editing uses the Figma-style inspector in `components/editor/tag-inspector/`: sidebar at `xl+`, bottom sheet below, node chips only select, and the editor connects through `onEditorChange`. Do not restore per-tag popovers.
- Icon actions beside labelled fields align with the input control, not the label row.
- `SelectTrigger` height variants use the `size` prop. Keep size classes mergeable so an explicit consumer height can override the default; do not combine `data-[size]` height selectors with plain `h-*` overrides.
