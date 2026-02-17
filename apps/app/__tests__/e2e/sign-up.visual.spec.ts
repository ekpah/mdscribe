import { expect, test } from "@playwright/test";

test.describe("Sign-up Visual Regression", () => {
	test.use({
		colorScheme: "light",
		viewport: { width: 1280, height: 900 },
	});

	test("should match the sign-up card layout", async ({ page }) => {
		await page.goto("/sign-up", { waitUntil: "domcontentloaded" });

		const signUpCard = page.getByTestId("sign-up-card");

		await expect(signUpCard).toBeVisible();
		await expect(signUpCard).toHaveScreenshot("sign-up-card.png", {
			animations: "disabled",
			caret: "hide",
			scale: "css",
		});
	});
});
