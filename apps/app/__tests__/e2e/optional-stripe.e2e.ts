import { expect, test } from "@playwright/test";

// Run against a server started with all four STRIPE_* values empty, with
// STRIPE_SECRET_KEY="" also passed to Playwright. Other E2E runs retain billing.
test.describe("Stripe-disabled instance", () => {
	test.skip(process.env.STRIPE_SECRET_KEY !== "", "Requires a Stripe-disabled server");

	test("public pricing does not offer unavailable billing", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByRole("heading", { exact: true, name: "MDScribe Free" })).toBeVisible();
		await expect(page.getByRole("heading", { exact: true, name: "MDScribe Plus" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: /Monatlich|Jährlich/ })).toHaveCount(0);
		await expect(page.locator('a[href="/subscription"]')).toHaveCount(0);

		await page.goto("/subscription");
		await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fdashboard/);
	});

	test("login, settings, quota display and admin work without billing controls", async ({
		page,
	}) => {
		test.setTimeout(90_000);
		await page.goto("/sign-in");
		const signInCard = page.getByTestId("sign-in-card");
		await signInCard.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
		await signInCard.getByLabel("Passwort").fill("password123");
		await signInCard.getByRole("button", { name: "Anmelden" }).click();
		await page.waitForURL(/\/dashboard/);

		for (const [path, heading] of [
			["/dashboard", "KI-Nutzung"],
			["/profile/account", "Account"],
			["/profile/ai-scribe", "AI-Scribe"],
			["/profile/ai-access", "KI-Zugang"],
			["/admin/users", "Benutzerverwaltung"],
		]) {
			await page.goto(path);
			await expect(page.getByRole("heading", { exact: true, name: heading }).first()).toBeVisible();
			await expect(page.locator("body")).not.toContainText(
				/\b(?:Plus|Abonnement|Stripe|Upgrade|Abo)\b/i,
			);
			await expect(page.locator('a[href="/subscription"]')).toHaveCount(0);
		}
		await expect(page.getByText(/\$.*\/ \$0\.30/).first()).toBeVisible();
		await expect(page.getByRole("columnheader", { name: "Abo" })).toHaveCount(0);
		await page.setViewportSize({ height: 844, width: 390 });
		await expect(page.locator("body")).not.toContainText(/\b(?:Plus|Abonnement|Abo)\b/);

		await page.goto("/subscription");
		await expect(page).toHaveURL(/\/dashboard$/);
		await page.setViewportSize({ height: 900, width: 1280 });
		await page.goto("/profile/ai-scribe");
		for (const [button, comboboxIndex] of [
			["Neue AI Vorlage", 2],
			["Neuer Brief-Baukasten", 0],
		] as const) {
			await page.getByRole("button", { name: button }).click();
			const dialog = page.getByRole("dialog");
			await dialog.getByRole("combobox").nth(comboboxIndex).click();
			await expect(page.getByRole("option", { exact: true, name: "Privat" })).toBeDisabled();
			await expect(dialog).not.toContainText(/Plus|Abonnement|Upgrade/);
			await page.keyboard.press("Escape");
			await dialog.getByRole("button", { name: "Abbrechen" }).click();
			await expect(dialog).toBeHidden();
		}
		for (const path of ["/templates/create", "/documents/create"]) {
			await page.goto(path);
			await page.getByRole("combobox", { name: "Sichtbarkeit" }).click();
			await expect(page.getByRole("option", { exact: true, name: "Privat" })).toBeDisabled();
			await page.getByRole("option", { exact: true, name: "Öffentlich" }).click();
			await page.getByRole("button", { name: "Hinweis zur Sichtbarkeit" }).hover();
			await expect(
				page.getByText(/Private (?:Textbausteine|Dokumente) sind für Ihr Konto nicht verfügbar/),
			).toBeVisible();
			await expect(page.locator("body")).not.toContainText(/Plus|Abonnement|Upgrade/);
		}
	});
});

test("configured billing still loads on demand and sends an upgrade request", async ({ page }) => {
	test.skip(!process.env.STRIPE_SECRET_KEY, "Requires a Stripe-configured server");
	test.setTimeout(60_000);
	await page.goto("/");
	await expect(page.getByRole("heading", { exact: true, name: "MDScribe Plus" })).toBeVisible();
	await page.goto("/sign-in");
	const signInCard = page.getByTestId("sign-in-card");
	await signInCard.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
	await signInCard.getByLabel("Passwort").fill("password123");
	await signInCard.getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/dashboard/);
	// Intercept before it reaches the server: no checkout or external Stripe call.
	await page.route("**/api/auth/subscription/upgrade", (route) =>
		route.fulfill({
			body: JSON.stringify({ code: "TEST_CHECKOUT_BLOCKED", message: "Test checkout blocked" }),
			contentType: "application/json",
			status: 400,
		}),
	);
	for (const [path, button] of [
		["/profile/account", "Abonnieren"],
		["/subscription", "Jetzt Plus aktivieren"],
	]) {
		await page.goto(path);
		const requestPromise = page.waitForRequest("**/api/auth/subscription/upgrade");
		await page.getByRole("button", { name: button }).click();
		const request = await requestPromise;
		expect(request.postDataJSON()).toMatchObject({
			cancelUrl: path,
			plan: "plus",
			successUrl: path,
		});
	}
	await page.goto("/admin/users");
	await expect(page.getByRole("columnheader", { name: "Abo" })).toBeVisible();
});
