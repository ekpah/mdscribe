import { devices, expect, test } from "@playwright/test";

test.use({ viewport: { height: 1000, width: 1600 } });

test("inserting details remains responsive on mobile", async ({ browser }, testInfo) => {
	const context = await browser.newContext({
		...devices["Pixel 7"],
		baseURL: testInfo.project.use.baseURL,
	});
	const page = await context.newPage();
	try {
		await page.goto("/sign-in");
		await page.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
		await page.getByLabel("Passwort", { exact: true }).fill("password123");
		await page.getByTestId("sign-in-card").getByRole("button", { name: "Anmelden" }).tap();
		await page.waitForURL(/\/dashboard/);
		await page.goto("/templates/create");
		const main = page.getByRole("tabpanel", { exact: true, name: "Template" });
		await main.locator(".tiptap").tap();
		await main.getByRole("button", { exact: true, name: "Details" }).tap();

		const summary = main.locator("textarea[data-details-summary]:focus");
		await expect(summary).toHaveValue("");
		await summary.fill("Mobile details");
		await expect(main.getByLabel("Beschriftung des Details-Abschnitts")).toHaveValue(
			"Mobile details",
		);
	} finally {
		await context.close();
	}
});

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
	await expect(main.getByRole("tab", { exact: true, name: "no" })).toHaveAttribute(
		"aria-selected",
		"true",
	);
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

test("wrapping existing details focuses the newly inserted summary", async ({ page }) => {
	await page.goto("/sign-in");
	await page.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
	await page.getByLabel("Passwort", { exact: true }).fill("password123");
	await page.getByTestId("sign-in-card").getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/dashboard/);
	await page.goto("/templates/create");
	const main = page.getByRole("tabpanel", { exact: true, name: "Template" });
	const editor = main.locator(".tiptap");
	const pasteDetails = async () => {
		await editor.evaluate((element) => {
			const clipboardData = new DataTransfer();
			clipboardData.setData(
				"text/plain",
				'{% details summary="Original outer" %}\nOuter body\n{% details summary="Original inner" %}\nInner body\n{% /details %}\n{% /details %}',
			);
			(element as HTMLElement).focus();
			element.dispatchEvent(
				new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
			);
		});
	};
	await pasteDetails();

	const selectDetails = async (summary: string) => {
		await editor.evaluate((element, selectedSummary) => {
			const { editor: tipTap } = element as HTMLElement & {
				editor: {
					commands: { setNodeSelection: (pos: number) => void };
					state: {
						doc: {
							descendants: (
								callback: (
									node: { attrs: { summary?: string }; type: { name: string } },
									pos: number,
								) => boolean | void,
							) => void;
						};
					};
				};
			};
			let position: number | null = null;
			tipTap.state.doc.descendants((node, pos) => {
				if (node.type.name === "detailsTag" && node.attrs.summary === selectedSummary) {
					position = pos;
					return false;
				}
			});
			if (position === null) {
				throw new Error(`Could not find details section ${selectedSummary}`);
			}
			tipTap.commands.setNodeSelection(position);
		}, summary);
		await main.getByRole("button", { exact: true, name: "Details" }).click();
		const summaries = main.getByLabel("Beschriftung des Details-Abschnitts");
		await expect(main.locator("textarea[data-details-summary]:focus")).toHaveValue("");
		await expect(summaries).toHaveCount(3);
		expect(
			await summaries.evaluateAll((elements) =>
				elements.map((element) => (element as HTMLTextAreaElement).value),
			),
		).toContain(summary);
	};

	await selectDetails("Original outer");
	await expect(main.getByLabel("Beschriftung des Details-Abschnitts").nth(2)).toHaveValue(
		"Original inner",
	);
	await page.reload();
	await pasteDetails();
	await selectDetails("Original inner");
	await expect(main.getByLabel("Beschriftung des Details-Abschnitts").nth(0)).toHaveValue(
		"Original outer",
	);
});

test("inserting details within a paragraph focuses the new summary", async ({ page }) => {
	await page.goto("/sign-in");
	await page.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
	await page.getByLabel("Passwort", { exact: true }).fill("password123");
	await page.getByTestId("sign-in-card").getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/dashboard/);
	await page.goto("/templates/create");
	const main = page.getByRole("tabpanel", { exact: true, name: "Template" });
	const editor = main.locator(".tiptap");

	for (const { from, to } of [
		{ from: 6, to: 6 },
		{ from: 3, to: 3 },
		{ from: 1, to: 4 },
	]) {
		await page.reload();
		await editor.evaluate(
			(element, selection) => {
				const { editor: tipTap } = element as HTMLElement & {
					editor: {
						commands: { setTextSelection: (range: { from: number; to: number }) => void };
						state: {
							doc: {
								descendants: (
									callback: (
										node: { isText: boolean; text?: string },
										pos: number,
									) => boolean | void,
								) => void;
							};
						};
					};
				};
				const clipboardData = new DataTransfer();
				clipboardData.setData("text/plain", "abcdef");
				(element as HTMLElement).focus();
				element.dispatchEvent(
					new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
				);
				let textPosition: number | null = null;
				tipTap.state.doc.descendants((node, pos) => {
					if (node.isText && node.text === "abcdef") {
						textPosition = pos;
						return false;
					}
				});
				if (textPosition === null) {
					throw new Error("Could not find inserted paragraph text");
				}
				tipTap.commands.setTextSelection({
					from: textPosition + selection.from,
					to: textPosition + selection.to,
				});
			},
			{ from, to },
		);
		await main.getByRole("button", { exact: true, name: "Details" }).click();
		await expect(main.locator("textarea[data-details-summary]:focus")).toHaveValue("");
	}

	await page.reload();
	await editor.evaluate((element) => {
		const { editor: tipTap } = element as HTMLElement & {
			editor: {
				commands: { setTextSelection: (range: { from: number; to: number }) => void };
				state: {
					doc: {
						descendants: (
							callback: (node: { isText: boolean; text?: string }, pos: number) => boolean | void,
						) => void;
					};
				};
			};
		};
		const clipboardData = new DataTransfer();
		clipboardData.setData(
			"text/plain",
			'abc\n{% details summary="Existing" %}\ndefghi\n{% /details %}',
		);
		(element as HTMLElement).focus();
		element.dispatchEvent(
			new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
		);
		let paragraphPosition: number | null = null;
		let detailsTextPosition: number | null = null;
		tipTap.state.doc.descendants((node, pos) => {
			if (node.isText && node.text === "abc") {
				paragraphPosition = pos;
			}
			if (node.isText && node.text === "defghi") {
				detailsTextPosition = pos;
			}
		});
		if (paragraphPosition === null || detailsTextPosition === null) {
			throw new Error("Could not find cross-block selection boundaries");
		}
		tipTap.commands.setTextSelection({
			from: paragraphPosition + 1,
			to: detailsTextPosition + 3,
		});
	});
	await main.getByRole("button", { exact: true, name: "Details" }).click();
	const focusedSummary = main.locator("textarea[data-details-summary]:focus");
	await expect(focusedSummary).toHaveValue("");
	await focusedSummary.fill("New wrapper");
	expect(
		await main
			.getByLabel("Beschriftung des Details-Abschnitts")
			.evaluateAll((elements) => elements.map((element) => (element as HTMLTextAreaElement).value)),
	).toEqual(["New wrapper", "Existing"]);
});

test("table toolbar prevents unsupported layouts and roundtrips native merged cells", async ({
	page,
}) => {
	await page.goto("/sign-in");
	await page.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
	await page.getByLabel("Passwort", { exact: true }).fill("password123");
	await page.getByTestId("sign-in-card").getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/dashboard/);
	await page.goto("/templates/create");
	const main = page.getByRole("tabpanel", { exact: true, name: "Template" });
	const editor = main.locator(".tiptap").first();
	await editor.click();
	await main.getByRole("button", { exact: true, name: "Tabelle" }).click();
	await page.getByRole("menuitem", { exact: true, name: "Tabelle einfügen" }).click();
	await expect(editor.locator("tr")).toHaveCount(3);
	await expect(editor.locator("th")).toHaveCount(3);

	const selectCells = (anchor: number, head: number) =>
		editor.evaluate(
			(element, indices) => {
				const { editor: tipTap } = element as HTMLElement & {
					editor: {
						commands: {
							setCellSelection: (selection: { anchorCell: number; headCell: number }) => void;
						};
						state: {
							doc: {
								descendants: (
									callback: (node: { type: { name: string } }, pos: number) => void,
								) => void;
							};
						};
					};
				};
				const cells: number[] = [];
				tipTap.state.doc.descendants((node, pos) => {
					if (node.type.name === "tableCell") {
						cells.push(pos);
					}
				});
				tipTap.commands.setCellSelection({
					anchorCell: cells[indices[0]],
					headCell: cells[indices[1]],
				});
			},
			[anchor, head],
		);
	await selectCells(0, 5);
	await main.getByRole("button", { exact: true, name: "Tabelle" }).click();
	await expect(
		page.getByRole("menuitem", { exact: true, name: "Zellen verbinden" }),
	).toBeDisabled();
	await expect(page.getByRole("menuitem", { name: "Kopfspalte umschalten" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(editor.locator("td")).toHaveCount(6);

	// Populated cells merge into one paragraph while preserving marks and breaks.
	await editor.locator("td p").nth(0).click();
	await main.getByRole("button", { exact: true, name: "Fett" }).click();
	await expect(editor).toBeFocused();
	await page.keyboard.type("First", { delay: 50 });
	await expect(editor.locator("td").nth(0)).toHaveText("First");
	await main.getByRole("button", { exact: true, name: "Fett" }).click();
	await editor.locator("td p").nth(3).click();
	await page.keyboard.type("Second", { delay: 50 });
	await expect(editor.locator("td").nth(3)).toHaveText("Second");
	await selectCells(0, 3);
	await main.getByRole("button", { exact: true, name: "Tabelle" }).click();
	await page.getByRole("menuitem", { exact: true, name: "Zellen verbinden" }).click();
	const merged = editor.locator('td[rowspan="2"]');
	await expect(merged).toHaveText("FirstSecond");
	await expect(merged.locator("p")).toHaveCount(1);
	await expect(merged.locator("strong")).toHaveText("First");
	await expect(merged.locator("br:not(.ProseMirror-trailingBreak)")).toHaveCount(1);
	await expect(editor.locator("tr").last().locator("td")).toHaveCount(2);
	await expect(main.getByRole("button", { name: "Überschrift 1" })).toBeDisabled();
	await expect(main.getByRole("button", { exact: true, name: "Details" })).toBeDisabled();
	await editor.evaluate((element) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData("text/html", "<p>Unsupported block one</p><p>Unsupported block two</p>");
		clipboardData.setData("text/plain", "Unsupported block one\nUnsupported block two");
		(element as HTMLElement).focus();
		element.dispatchEvent(
			new ClipboardEvent("paste", {
				bubbles: true,
				cancelable: true,
				clipboardData,
			}),
		);
	});
	await expect(merged).toHaveText("FirstSecond");
	await expect(merged.locator("p")).toHaveCount(1);

	// Column deletion must not remove the only originating cells in a covered row.
	await selectCells(3, 4);
	await main.getByRole("button", { exact: true, name: "Tabelle" }).click();
	await page.getByRole("menuitem", { exact: true, name: "Zellen verbinden" }).click();
	await expect(editor.locator('td[colspan="2"]')).toHaveCount(1);
	await main.getByRole("button", { exact: true, name: "Tabelle" }).click();
	await page.getByRole("menuitem", { exact: true, name: "Spalte löschen" }).click();
	await expect(editor.locator("tr").last().locator("td")).toHaveCount(1);
	await expect(editor.locator('td[colspan="2"]')).toHaveCount(1);

	await page.getByRole("textbox", { exact: true, name: "Name *" }).fill("Table regression");
	await page.getByRole("combobox").first().click();
	await page.getByRole("option", { exact: true, name: "Neue Kategorie hinzufügen" }).click();
	await page.getByRole("textbox", { exact: true, name: "Neue Kategorie *" }).fill("Table tests");
	let savedSource = "";
	await page.route("**/api/rpc/templates/create", async (route) => {
		const payload = route.request().postDataJSON();
		savedSource = payload.json.content;
		// Verify the real save payload without creating permanent test templates.
		await route.abort();
	});
	await page.getByRole("button", { exact: true, name: "Textbaustein speichern" }).click();
	await expect.poll(() => savedSource).toContain("{% table %}");
	expect(savedSource).toContain("rowspan=2");
	expect(savedSource).toContain("colspan=2");
	expect(savedSource).toContain("**First**");
	expect(savedSource).toContain("Second");
	expect(savedSource).not.toContain("layout=");
	expect(savedSource).not.toContain("<table");
	await page.reload();
	await editor.evaluate((element, source) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData("text/plain", source);
		(element as HTMLElement).focus();
		element.dispatchEvent(
			new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }),
		);
	}, savedSource);
	await expect(editor.locator("tr")).toHaveCount(3);
	await expect(editor.locator('td[rowspan="2"]')).toHaveText("FirstSecond");
	await expect(editor.locator('td[colspan="2"]')).toHaveCount(1);
	await editor.locator("td p").first().click();
	await main.getByRole("button", { exact: true, name: "Tabelle" }).click();
	await page.getByRole("menuitem", { exact: true, name: "Zelle teilen" }).click();
	await expect(editor.locator("td")).toHaveCount(5);
	await expect(editor.locator('td[rowspan="2"]')).toHaveCount(0);
});
