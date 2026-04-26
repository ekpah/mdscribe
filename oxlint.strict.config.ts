import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
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
    "**/apps/email/.react-email/**",
    "**/.react-email/**",
  ],
});
