import { expect, test } from "@playwright/test";

test.describe("BYOK settings", () => {
	test("authenticated users can open the write-only KI access dashboard", async ({ page }) => {
		await page.goto("/sign-in");
		const signInCard = page.getByTestId("sign-in-card");
		await signInCard.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
		await signInCard.getByLabel("Passwort").fill("password123");
		await signInCard.getByRole("button", { name: "Anmelden" }).click();
		await page.waitForURL(/\/dashboard/);

		await page.goto("/profile/ai-access");
		await expect(page.getByRole("heading", { name: "KI-Zugang" })).toBeVisible();
		await expect(
			page.getByText(
				"Verwalte eigene API-Schlüssel für die vom Administrator freigeschalteten KI-Verbindungen.",
			),
		).toBeVisible();
		await expect(page.getByRole("link", { exact: true, name: "KI-Zugang" })).toBeVisible();
	});
});
