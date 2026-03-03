import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const playwrightBaseURL =
	process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${playwrightPort}`;

export default defineConfig({
	forbidOnly: !!process.env.CI,
	fullyParallel: true,
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	reporter: "html",
	retries: process.env.CI ? 2 : 0,
	testDir: "./__tests__/e2e",
	use: {
		baseURL: playwrightBaseURL,
		trace: "on-first-retry",
	},
	webServer: {
		command: `bun --bun next dev -p ${playwrightPort}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
		url: playwrightBaseURL,
	},
	workers: process.env.CI ? 1 : undefined,
});
