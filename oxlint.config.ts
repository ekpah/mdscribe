import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";

export default defineConfig({
	extends: [core, react, next, shadcn],
	jsPlugins: shadcn.jsPlugins,
	// Ultracite 7.10 enabled a broad set of migration and style rules that do
	// not match this repository's existing conventions. Keep correctness rules
	// enforced while rolling React Compiler diagnostics out as warnings.
	// Ultracite 8 adds jsx-a11y's label association check; existing labels that
	// are not tied to a control stay warnings until they are fixed.
	rules: {
		"jsx-a11y/label-has-associated-control": [
			"warn",
			{
				controlComponents: ["Input", "Select", "Textarea", "Checkbox", "Radio"],
				depth: 3,
				labelComponents: ["Label"],
			},
		],
		"no-await-in-loop": "off",
		"prefer-named-capture-group": "off",
		"require-unicode-regexp": "off",
		"react/capitalized-calls": "warn",
		"react/error-boundaries": "warn",
		"react/exhaustive-effect-dependencies": "warn",
		"react/function-component-definition": "off",
		"react/globals": "warn",
		"react/hook-use-state": "off",
		"react/hooks": "warn",
		"react/immutability": "warn",
		"react/incompatible-library": "warn",
		"react/invariant": "warn",
		"react/jsx-handler-names": "off",
		"react/memo-dependencies": "warn",
		"react/no-deriving-state-in-effects": "warn",
		"react/no-object-type-as-default-prop": "warn",
		"react/no-unstable-nested-components": "warn",
		"react/preserve-manual-memoization": "warn",
		"react/purity": "warn",
		"react/refs": "warn",
		"react/rule-suppression": "warn",
		"react/set-state-in-effect": "warn",
		"react/set-state-in-render": "warn",
		"react/static-components": "warn",
		"react/syntax": "warn",
		"react/todo": "warn",
		"react/unsupported-syntax": "warn",
		"react/use-memo": "warn",
		"react/void-use-memo": "warn",
		// The shadcn preset's design-system rules are errors upstream. Report the
		// existing hits as warnings while they are cleaned up; no-restyle stays off
		// because pages style shared components at the call site throughout.
		"shadcn/no-arbitrary-values": ["warn", { allow: ["layout"] }],
		"shadcn/no-inline-styles": "warn",
		"shadcn/no-raw-colors": "warn",
		"shadcn/no-restyle": "off",
		"shadcn/no-unknown-classes": "warn",
		"shadcn/require-static-classes": "warn",
		"unicorn/import-style": "off",
		"unicorn/prefer-export-from": "off",
		"unicorn/prefer-number-coercion": "off",
	},
	ignorePatterns: [
		"**/node_modules/**",
		"**/.next/**",
		"**/.turbo/**",
		"**/coverage/**",
		"**/dist/**",
		"**/build/**",
		"**/.source/**",
		"**/packages/design-system/components/ui/**",
		"**/packages/design-system/lib/**",
		"**/packages/design-system/hooks/**",
		"**/apps/docs/**/*.json",
		"**/.react-email/**",
	],
});
