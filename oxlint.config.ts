import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
	extends: [core, react, next],
	// Ultracite 7.10 enabled a broad set of migration and style rules that do
	// not match this repository's existing conventions. Keep correctness rules
	// enforced while rolling React Compiler diagnostics out as warnings.
	rules: {
		"no-await-in-loop": "off",
		"prefer-named-capture-group": "off",
		"require-unicode-regexp": "off",
		"react/function-component-definition": "off",
		"react/hook-use-state": "off",
		"react/jsx-handler-names": "off",
		"react/no-object-type-as-default-prop": "warn",
		"react/no-unstable-nested-components": "warn",
		"react/react-compiler": "warn",
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
