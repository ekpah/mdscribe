import { expect, test } from "@playwright/test";

test.use({ viewport: { height: 1000, width: 1600 } });

test("nested cases retain rich tags, chip selection stays local, and calculated references link to their definition", async ({
	page,
}) => {
	await page.goto("/sign-in");
	await page.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
	await page.getByLabel("Passwort", { exact: true }).fill("password123");
	await page.getByTestId("sign-in-card").getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/dashboard/);
	await page.goto("/templates/create");
	const main = page.getByRole("tabpanel", { exact: true, name: "Template" });
	await main.locator(".tiptap").evaluate((element) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData(
			"text/plain",
			`First line\nSecond line\n{% switch "outer" %}{% case "yes" %}Before {% info "volume" type="number" unit="ml" renderUnit=true /%} {% switch "inner" %}{% case "right" %}Right {% info "check" /%}{% /case %}{% /switch %}{% /case %}{% case "no" %}Alternative content{% /case %}{% /switch %}
SV: {% calc primary="SV" formula="100" description="Stroke volume" unit="ml" renderUnit=true /%}
PAC: {% calc primary="PAC" formula="[SV] / 2" %}{% info "SV" type="number" /%}{% /calc %}`,
		);
		(element as HTMLElement).focus();
		element.dispatchEvent(
			new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
		);
	});
	await expect(main.locator(".tiptap br:not(.ProseMirror-trailingBreak)")).toHaveCount(4);
	await main.locator('button[data-type="markdoc-calc"]').first().click();
	await expect(main.locator(".ProseMirror-hideselection")).toHaveCount(1);
	expect(
		await main
			.locator(".tiptap p")
			.evaluate((element) => getComputedStyle(element, "::selection").backgroundColor),
	).toBe("rgba(0, 0, 0, 0)");
	await expect(main.locator(".tiptap button svg")).toHaveCount(0);
	await expect(main.locator(".tiptap button")).toHaveCount(3);
	const inspector = page.getByRole("tabpanel", { exact: true, name: "Info" });
	await expect(main.locator('button[data-type="markdoc-calc"]').first()).toHaveText("SV· ml");
	await inspector.getByRole("checkbox", { name: "Einheit im Dokument anzeigen" }).uncheck();
	await expect(main.locator('button[data-type="markdoc-calc"]').first()).toHaveText("SV");
	await main.locator('button[data-type="markdoc-switch"]').click();
	await expect(main.getByRole("tab", { exact: true, name: "yes" })).toBeVisible();
	await expect(main.locator('button[data-type="markdoc-switch"]').first()).toBeVisible();
	await expect(main.getByRole("button", { exact: true, name: "Fett" })).toHaveCount(1);
	await expect(main.locator('.node-switchTag [data-testid="switch-content-editor"]')).toBeVisible();
	await expect(main.locator('button[data-type="markdoc-calc"]').last()).toBeVisible();
	await expect(inspector.getByLabel("Variablenname")).toHaveValue("outer");
	await expect(inspector.locator(".tiptap")).toHaveCount(0);
	await expect(main.locator('button[data-type="markdoc-info"]:visible')).toHaveText("volume· ml");
	await page.getByRole("tab", { exact: true, name: "Agent" }).click();
	await main.locator('button[data-type="markdoc-info"]:visible').click();
	await expect(inspector).toBeVisible();
	await inspector.getByRole("checkbox", { name: "Einheit im Dokument anzeigen" }).uncheck();
	await expect(main.locator('button[data-type="markdoc-info"]:visible')).toHaveText("volume");
	await main.getByRole("tab", { exact: true, name: "no" }).click();
	await main.locator('button[data-type="markdoc-switch"]').first().click();
	await expect(main.getByRole("tab", { exact: true, name: "no" })).toHaveAttribute("aria-selected", "true");
	await expect(main.locator(".tiptap").last()).toHaveText("Alternative content");
	await main.locator(".tiptap").last().click();
	await main.locator(".tiptap").last().press("ControlOrMeta+End");
	await page.keyboard.type(" edited");
	await main.locator(".tiptap").last().press("ControlOrMeta+a");
	await main.getByRole("button", { exact: true, name: "Fett" }).click();
	await expect(main.locator(".tiptap").last().locator("strong")).toHaveText(
		"Alternative content edited",
	);
	await main.getByRole("tab", { exact: true, name: "yes" }).click();
	await main.locator('button[data-type="markdoc-switch"]:visible').last().click();
	await expect(main.getByRole("tab", { exact: true, name: "right" })).toBeVisible();
	await main.locator('button[data-type="markdoc-info"]:visible').last().click();
	await inspector.getByLabel("Beschreibung (optional)").fill("Confirmed");
	await expect(inspector.getByLabel("Beschreibung (optional)")).toBeFocused();
	await expect(main.locator(".tiptap:visible")).toHaveCount(3);
	await expect(main.getByRole("button", { exact: true, name: "Fett" })).toHaveCount(1);
	// Editing surrounding text must keep the expanded nodes at their mapped positions.
	await main.locator(".tiptap").first().press("ControlOrMeta+Home");
	await page.keyboard.type("Intro ");
	await expect(main.getByRole("tab", { exact: true, name: "right" })).toBeVisible();
	// Both rich case levels remain serialized in the outer node, not flattened to text.
	const stored = await main
		.locator(".tiptap")
		.first()
		.evaluate((element) => {
			const { editor } = element as HTMLElement & { editor: { getHTML: () => string } };
			return decodeURIComponent(decodeURIComponent(editor.getHTML()));
		});
	expect(stored).toContain('description="Confirmed"');
	expect(stored).toContain('primary="inner"');
	expect(stored).toContain('primary="volume"');
	expect(stored).toContain("Alternative content edited");
	expect(stored).toContain("Intro First line");
	await main.getByRole("button", { exact: true, name: "Zuklappen" }).last().click();
	await expect(inspector.getByLabel("Variablenname")).toHaveValue("inner");
	await main.getByRole("tab", { exact: true, name: "no" }).click();
	await expect(main.locator(".tiptap").last()).toHaveText("Alternative content edited");
	await main.getByRole("button", { exact: true, name: "Zuklappen" }).click();
	await expect(main.locator(".tiptap:visible")).toContainText("First line");
	await main.locator('button[data-type="markdoc-calc"]').last().click();
	await inspector.getByRole("button", { exact: true, name: "[SV] · berechnet ↗" }).click();
	await expect(inspector.getByLabel("Variablenname")).toHaveValue("SV");
	await expect(inspector.getByLabel("Beschreibung (optional)")).toHaveValue("Stroke volume");
	await main.locator('button[data-type="markdoc-calc"]').last().click();
	await page.keyboard.press("Backspace");
	await expect(main.locator('button[data-type="markdoc-calc"]')).toHaveCount(1);
});
