import { expect, test } from "@playwright/test";

test.describe("Sign-in Visual Regression", () => {
	test.use({
		colorScheme: "light",
		viewport: { width: 1280, height: 900 },
	});

	test("should match the sign-in card layout", async ({ page }) => {
		await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

		const signInCard = page.getByTestId("sign-in-card");

		await expect(signInCard).toBeVisible();
		await expect(signInCard).toHaveScreenshot("sign-in-card.png", {
			animations: "disabled",
			caret: "hide",
			scale: "css",
		});
	});
});
