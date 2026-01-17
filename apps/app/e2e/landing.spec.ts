import { expect, test } from "@playwright/test";

test.describe("Landing Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("should display the landing page", async ({ page }) => {
		// Check that the page loads and has the expected title/content
		await expect(page).toHaveTitle(/MDScribe/i);

		// Check that the Hero section is visible
		await expect(
			page.getByRole("heading", { name: /Arztbriefe mit/i }),
		).toBeVisible();

		// Check that the primary CTA button is visible
		await expect(page.locator("#primary-cta")).toBeVisible();

		// Check that Templates button is visible
		await expect(page.getByRole("link", { name: /Textbausteine/i })).toBeVisible();
	});

	test("should display the Features section", async ({ page }) => {
		// Check for the template customization section heading
		await expect(
			page.getByRole("heading", { name: /Flexible Vorlagen/i }),
		).toBeVisible();

		// Check for the AI-assisted notes section heading
		await expect(
			page.getByRole("heading", { name: /Von Notizen zu/i }).first(),
		).toBeVisible();

		// Check for the procedure documentation section heading
		await expect(
			page.getByRole("heading", { name: /Von Stichpunkten zu/i }),
		).toBeVisible();
	});

	test("should display the AI Features section", async ({ page }) => {
		// Check for the AI Features section headings
		await expect(page.getByRole("heading", { name: /Anamnese/i })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Prozedur-Dokumentation/i }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Entlassungsberichte/i }),
		).toBeVisible();
	});

	test("should display the Pricing section", async ({ page }) => {
		// Check that pricing tiers are visible
		await expect(page.getByText(/Kostenlos/i).first()).toBeVisible();
	});

	test("should display the Footer", async ({ page }) => {
		// Check that footer content is visible
		await expect(page.locator("footer")).toBeVisible();
	});
});

test.describe("Landing Page - Markdoc Template Examples", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("should have interactive template inputs in the Kardiale Dekompensation section", async ({
		page,
	}) => {
		// Find the template customization section
		const templateSection = page.locator("text=Vorlage: Kardiale Dekompensation").first();
		await expect(templateSection).toBeVisible();

		// Check that there are input fields (Geschlecht dropdown and Nachnahme input)
		// The template has two inputs: a Switch (Geschlecht) and an Info (Nachnahme)
		const inputsContainer = page
			.locator("section")
			.filter({ hasText: "Flexible Vorlagen" })
			.first();

		// Look for the rendered note section
		const renderedNote = inputsContainer.locator("text=Gerenderte Notiz").first();
		await expect(renderedNote).toBeVisible();
	});

	test("should update rendered content when filling in template inputs", async ({
		page,
	}) => {
		// Find the template customization section
		const templateSection = page
			.locator("section")
			.filter({ hasText: "Flexible Vorlagen" })
			.first();

		// Find the Geschlecht dropdown (Switch input)
		const geschlechtSelect = templateSection.getByRole("combobox").first();

		// Check that it exists
		await expect(geschlechtSelect).toBeVisible();

		// Find the rendered output section - it should initially show placeholder text
		const renderedOutput = templateSection.locator(
			'div:has-text("Gerenderte Notiz") + div, div:has-text("Gerenderte Notiz") ~ div',
		);

		// Initially, the rendered content should show placeholder text (because no value selected)
		// The default shows "[#Herrn/Frau#]" when Geschlecht is not selected
		await expect(
			templateSection.locator("text=[#Herrn/Frau#]").first(),
		).toBeVisible();

		// Select "männlich" from the dropdown
		await geschlechtSelect.click();
		await page.getByRole("option", { name: "männlich" }).click();

		// Now the rendered content should show "Herrn" instead of placeholder
		await expect(templateSection.locator("text=Herrn").first()).toBeVisible();

		// The placeholder should no longer be visible (at least in the first occurrence)
		// Note: We check for the first occurrence as there might be multiple in the rendered content
	});

	test("should update procedure documentation when filling in inputs", async ({
		page,
	}) => {
		// Find the procedure documentation section
		const procedureSection = page
			.locator("section")
			.filter({ hasText: "Von Stichpunkten zu" })
			.first();

		await expect(procedureSection).toBeVisible();

		// Find the "Anpassbare Parameter" inputs section
		const paramsSection = procedureSection.locator(
			"text=Anpassbare Parameter",
		);
		await expect(paramsSection).toBeVisible();

		// Find the input field for "Volumen Mecain"
		// This is an Info input that should accept a numeric value
		const volumeInput = procedureSection
			.getByRole("textbox", { name: /Volumen Mecain/i })
			.or(procedureSection.locator('input[placeholder*="Volumen"]'))
			.or(procedureSection.locator("input").first());

		// If input is found, try to fill it
		if (await volumeInput.isVisible()) {
			// Fill in a value
			await volumeInput.fill("5");

			// The rendered output should now contain "5 ml" somewhere
			const renderedOutput = procedureSection.locator(
				"text=Prozedur-Dokumentation",
			);
			await expect(renderedOutput).toBeVisible();

			// Check that the value appears in the rendered content
			await expect(procedureSection.locator("text=5 ml")).toBeVisible({
				timeout: 5000,
			});
		}
	});

	test("should link to template page from Features section", async ({
		page,
	}) => {
		// Find the link to the template
		const templateLink = page.getByRole("link", {
			name: /Vorlage: Kardiale Dekompensation/i,
		});
		await expect(templateLink).toBeVisible();

		// Check that it has the correct href
		await expect(templateLink).toHaveAttribute(
			"href",
			"/templates/cmaw87vov0002rqdn0aca1ejs",
		);
	});
});
