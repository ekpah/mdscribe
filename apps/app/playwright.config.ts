import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const playwrightBaseURL =
	process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${playwrightPort}`;

export default defineConfig({
	testDir: "./__tests__/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: playwrightBaseURL,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: `bun --bun next dev -p ${playwrightPort}`,
		url: playwrightBaseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
	},
});
