import { expect, test } from "@playwright/test";

test.describe("Landing Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("does not overflow the viewport horizontally", async ({ page }) => {
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
				),
			)
			.toBe(true);
	});

	test("presents the product, source and primary actions", async ({ page }) => {
		await expect(page).toHaveTitle(/Open Source für medizinische Dokumentation/i);
		await expect(
			page.getByRole("heading", { name: /Weniger tippen\. Mehr Medizin\./i }),
		).toBeVisible();
		await expect(page.locator("#primary-cta")).toBeVisible();
		await expect(page.getByRole("link", { name: /Quellcode ansehen/i })).toHaveAttribute(
			"href",
			"https://github.com/ekpah/mdscribe",
		);
		await expect(page.getByText("Open Source").first()).toBeVisible();
		await expect(page.getByText("Anpassbar", { exact: true })).toBeVisible();
		await expect(page.getByText("Selbst hostbar", { exact: true })).toHaveCount(0);
		await expect(page.getByText("OPEN SOURCE · SELF-HOSTING · FÜR MEDIZINER")).toHaveCount(0);
		await expect(page.getByText("Live-Vorschau", { exact: true })).toHaveCount(0);
		await expect(page.locator("main .font-serif, footer .font-serif")).toHaveCount(0);

		const scrollLink = page.getByRole("link", { name: /Scrollen, um MDScribe kennenzulernen/i });
		await expect(scrollLink).toHaveAttribute("href", "#markdown");
		await expect
			.poll(() => scrollLink.evaluate((element) => getComputedStyle(element).animationName))
			.not.toBe("none");
		await page.evaluate(() => {
			const testWindow = window as Window & {
				landingScrollOptions?: boolean | ScrollIntoViewOptions;
			};
			const nativeScrollIntoView = Element.prototype.scrollIntoView;
			Element.prototype.scrollIntoView = function scrollIntoView(options) {
				testWindow.landingScrollOptions = options;
				nativeScrollIntoView.call(this, options);
			};
		});
		await scrollLink.click();
		await expect(page).toHaveURL(/#markdown$/);
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						(
							window as Window & {
								landingScrollOptions?: boolean | ScrollIntoViewOptions;
							}
						).landingScrollOptions,
				),
			)
			.toMatchObject({ behavior: "smooth", block: "start" });
		await expect
			.poll(() =>
				page
					.locator("#markdown")
					.evaluate((element) => Math.round(element.getBoundingClientRect().top)),
			)
			.toBeLessThan(100);
	});

	test("shows the complete text block feature narrative", async ({ page }) => {
		await expect(
			page.getByRole("heading", { name: /Textbausteine, die im Klinikalltag mitdenken/i }),
		).toBeVisible();
		await expect(page.getByRole("link", { name: /markdoc-md auf npm/i })).toHaveCount(0);
		const markdownSection = page.locator("#feature-markdown");
		for (const pane of ["[data-markdown-source]", "[data-markdown-preview]"]) {
			await expect(markdownSection.locator(pane)).toContainText("San Francisco Syncope Rule");
			await expect(markdownSection.locator(pane)).toContainText("RR bei Triage XX/XX mmHg");
		}
		await expect(markdownSection.locator("[data-markdown-source]")).not.toContainText("## EKG");
		await expect(
			markdownSection.locator("[data-markdown-preview]").getByRole("heading", {
				exact: true,
				name: "EKG",
			}),
		).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: /Dokumentation beginnt mit passenden Textbausteinen/i }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Textbausteine passen sich deinen Angaben an/i }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Scores werden Teil der Dokumentation/i }),
		).toBeVisible();
		await expect(page.getByRole("heading", { name: /KI ergänzt den Workflow/i })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /PDF-Formulare ausfüllen, genau so leicht/i }),
		).toBeVisible();
		for (const [featureId, title] of [
			["markdown", "Synkope · Anamnese"],
			["template", "Vorhofflimmern · Kardioversion"],
			["score", "Vorhofflimmern · Diagnoseblock"],
			["ai", "Notaufnahme · Anamnese"],
			["document", "Rehabilitation · Antrag"],
		]) {
			await expect(page.locator(`#feature-${featureId}`)).toContainText(title);
		}
		await expect(page.locator("#markdown")).not.toContainText(/\.(?:md|pdf)\b/);
	});

	test("explains self-hosting and the available plans", async ({ page }) => {
		await expect(page.getByRole("heading", { name: /Open Source bis ins Detail/i })).toBeVisible();
		await expect(page.getByText("Lizenz: Apache-2.0")).toBeVisible();
		await expect(
			page.getByText(
				"Du kannst den Quelltext checken, MDScribe online nutzen oder ganz einfach in deinem Krankenhaus oder deiner Praxis selbst hosten.",
				{ exact: true },
			),
		).toBeVisible();
		await expect(page.getByText("Erweitere MDScribe wie du willst", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Betrieb auf der eigenen Infrastruktur", { exact: true }),
		).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "MDScribe Free" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "MDScribe Plus" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Self-Hosting" })).toBeVisible();
		await expect(page.getByText("Vorlagen aus der Community", { exact: true })).toBeVisible();
		await expect(page.getByText("Basis-Textbausteine", { exact: true })).toHaveCount(0);
		await expect(page.locator("footer")).toContainText(
			"Open-Source-Werkzeuge für bessere medizinische Dokumentation",
		);

		const sourceTerminalColors = await page
			.locator("[data-source-terminal], [data-source-terminal-bar], [data-source-terminal-body]")
			.evaluateAll((elements) =>
				elements.map((element) => getComputedStyle(element).backgroundColor),
			);
		expect(new Set(sourceTerminalColors).size).toBe(2);
		expect(sourceTerminalColors).not.toContain("rgba(0, 0, 0, 0)");
	});

	test("keeps the complete footer visible at the tablet breakpoint", async ({ page }) => {
		await page.setViewportSize({ height: 655, width: 814 });
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

		const tagline = page.getByText(
			"Open-Source-Werkzeuge für bessere medizinische Dokumentation.",
			{ exact: true },
		);
		await expect(tagline).toBeVisible();
		await expect
			.poll(() =>
				tagline.evaluate((element) => {
					const rect = element.getBoundingClientRect();
					return rect.top >= 0 && rect.bottom <= window.innerHeight;
				}),
			)
			.toBe(true);
	});
});

test.describe("Authenticated landing page", () => {
	test("keeps the header stable when the Avatar menu opens", async ({ page }) => {
		await page.goto("/sign-in");
		const signInCard = page.getByTestId("sign-in-card");
		await signInCard.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
		await signInCard.getByLabel("Passwort").fill("password123");
		await signInCard.getByRole("button", { name: "Anmelden" }).click();
		await page.waitForURL(/\/dashboard/);
		await page.goto("/");

		const avatarTrigger = page.locator("nav [data-slot='dropdown-menu-trigger']");
		await expect(avatarTrigger).toBeVisible();
		const initialPosition = await avatarTrigger.boundingBox();
		await avatarTrigger.click();

		await expect(page.getByRole("menu")).toBeVisible();
		expect(await avatarTrigger.boundingBox()).toEqual(initialPosition);
		expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
	});
});

test.describe("Landing Page Markdoc demos", () => {
	test.use({ viewport: { height: 900, width: 800 } });

	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("renders template variables into the document", async ({ page }) => {
		const templateSection = page.locator("#feature-template");
		await templateSection.scrollIntoViewIfNeeded();

		await templateSection.getByRole("textbox", { name: "Dosis Propofol" }).pressSequentially("60");
		await expect(templateSection).toContainText("60 mg");
		await templateSection
			.getByRole("textbox", { name: "Joule 1. Schock" })
			.pressSequentially("200");
		await expect(templateSection).toContainText("200 J");
		await templateSection.getByRole("button", { name: "Sinusrhythmus" }).click();

		await expect(
			templateSection.getByRole("textbox", {
				name: "Neurologische vorbestehende Auffälligkeiten",
			}),
		).toHaveCount(0);
		await expect(templateSection).toContainText("Erfolgreiche Konversion in den Sinusrhythmus");
		await expect
			.poll(() =>
				templateSection
					.locator("[data-template-demo], [data-template-input]")
					.evaluateAll((elements) => {
						const [demo, input] = elements.map((element) => element.getBoundingClientRect());
						return Math.round(Math.abs((demo?.bottom ?? 0) - (input?.bottom ?? 0)));
					}),
			)
			.toBeLessThanOrEqual(1);
	});

	test("calculates a score from structured inputs", async ({ page }) => {
		const scoreSection = page.locator("#feature-score");
		await scoreSection.scrollIntoViewIfNeeded();

		const scoreOutput = scoreSection.locator("[data-score-output]");
		await expect(scoreOutput).toContainText("0 Punkte");
		await expect(scoreSection.locator("[data-score-input] svg.lucide-bot")).toHaveCount(0);
		await expect(scoreSection.locator("[data-score-input]").getByRole("checkbox")).toHaveCount(5);
		await expect(scoreSection.getByText("CHA₂DS₂-VASc-Score", { exact: true })).toBeVisible();
		await expect(scoreSection.getByText("Berechnet", { exact: true })).toBeVisible();
		await expect(scoreSection.getByText("Alter", { exact: true })).toBeVisible();
		await expect(scoreSection.getByText("Geschlecht", { exact: true })).toBeVisible();
		await expect(scoreSection.getByText("Alter75", { exact: true })).toHaveCount(0);
		await expect(scoreSection.getByText("Alter65", { exact: true })).toHaveCount(0);
		const scoreInput = scoreSection.locator("[data-score-input]").getByRole("spinbutton");
		await expect(scoreInput).toHaveCount(1);
		await scoreInput.fill("");
		await expect(scoreInput).toHaveValue("");
		await scoreInput.fill("12");
		await expect(scoreOutput).toContainText("0 Punkte");
		await expect(
			scoreSection.getByRole("button", { name: "Berechneten Score wiederherstellen" }),
		).toHaveCount(0);
		await scoreInput.press("Tab");
		await expect(scoreOutput).toContainText("12 Punkte");
		await scoreSection.getByRole("button", { name: "Berechneten Score wiederherstellen" }).click();
		await expect(scoreOutput).toContainText("0 Punkte");
		await scoreInput.fill("0");
		await scoreInput.press("Tab");
		await expect(
			scoreSection.getByRole("button", { name: "Berechneten Score wiederherstellen" }),
		).toHaveCount(0);

		await scoreSection.getByRole("button", { exact: true, name: "≥ 75" }).click();
		await expect(scoreOutput).toContainText("2 Punkte");
		await scoreSection.getByRole("button", { exact: true, name: "Weiblich" }).click();
		await expect(scoreOutput).toContainText("3 Punkte");
		await scoreSection.getByRole("checkbox", { name: "Schlaganfall" }).check();
		await expect(scoreSection.getByRole("checkbox", { name: "Schlaganfall" })).toBeChecked();
		await expect(scoreOutput).toContainText("5 Punkte");
		await scoreSection.getByRole("checkbox", { name: "Schlaganfall" }).uncheck();
		await expect(scoreSection.getByRole("checkbox", { name: "Schlaganfall" })).not.toBeChecked();
		await expect(scoreOutput).toContainText("3 Punkte");
		await scoreSection.getByRole("checkbox", { name: "Diabetes" }).check();
		await expect(scoreOutput).toContainText("4 Punkte");
	});

	test("shows note, template and structured AI output side by side", async ({ page }) => {
		const aiSection = page.locator("#feature-ai");
		await aiSection.scrollIntoViewIfNeeded();

		const aiDemo = aiSection.locator("[data-ai-demo]");
		await expect(aiDemo).toContainText("110/80 96 38,9°C 99%");
		await expect(aiDemo).toContainText("# Anamnese Notaufnahme");
		await expect(aiDemo).toContainText(
			"(( Formuliere aus den Notizen eine strukturierte Anamnese. ))",
		);
		await expect(aiDemo).toContainText(/Vitalparameter bei Aufnahme am \d{2}\.\d{2}\./);
		await expect(aiDemo.locator("[data-ai-template-vitals]")).toContainText('RR {% info "RR"');
		await expect(aiDemo.locator("[data-ai-template-vitals]")).not.toContainText("**RR:**");
		const aiOutput = aiDemo.locator("[data-ai-output]");
		await expect(aiOutput.locator("ul")).toHaveCount(0);
		await expect(aiOutput).toContainText(
			"RR 110/80 mmHg, Puls 96/min, Temperatur 38,9 °C, SpO₂ 99 %.",
		);
		await expect
			.poll(() =>
				aiDemo
					.locator("[data-ai-template-vitals], [data-ai-output-vitals]")
					.evaluateAll((elements) => {
						const [templateVitals, outputVitals] = elements.map(
							(element) => element.getBoundingClientRect().top,
						);
						return Math.round(Math.abs((templateVitals ?? 0) - (outputVitals ?? 0)));
					}),
			)
			.toBeLessThanOrEqual(1);
		await expect
			.poll(() =>
				aiDemo.evaluate(
					(element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
				),
			)
			.toBe(3);
	});

	test("fills document fields into the PDF preview", async ({ page }) => {
		const documentSection = page.locator("#feature-document");
		await documentSection.scrollIntoViewIfNeeded();

		await documentSection.getByRole("textbox", { name: "Patientin/Patient" }).fill("Nora Weber");
		await documentSection
			.getByRole("textbox", { name: "Reha-Indikation" })
			.fill("Neurologische Rehabilitation");

		const preview = documentSection.locator("[data-document-preview]");
		await expect(preview).toContainText("Antrag auf medizinische Rehabilitation");
		await expect(preview).toContainText("Nora Weber");
		await expect(preview).toContainText("Neurologische Rehabilitation");
	});
});

test.describe("Landing Page desktop scroll visuals", () => {
	test.use({ viewport: { height: 655, width: 1414 } });

	test("keeps the right-hand visual synchronized with each feature", async ({ page }) => {
		await page.goto("/");
		const activeVisual = page.locator("[data-active-feature]");
		const progress = page.locator("[data-feature-progress]");
		await expect(progress).toBeVisible();
		const [visualBox, progressBox] = await Promise.all([
			activeVisual.boundingBox(),
			progress.boundingBox(),
		]);
		expect(progressBox?.x).toBeGreaterThan(visualBox?.x ? visualBox.x + visualBox.width : 0);
		expect(progressBox?.height).toBeGreaterThan(progressBox?.width ?? 0);

		await expect
			.poll(() =>
				page.locator("[data-feature-step]").evaluateAll((steps) =>
					steps.every((step) => {
						const stepRect = step.getBoundingClientRect();
						const copyStart = step.firstElementChild?.getBoundingClientRect();
						const copyEnd = step
							.querySelector<HTMLElement>("[data-feature-copy-end]")
							?.getBoundingClientRect();
						return (
							Math.abs(stepRect.top - (copyStart?.top ?? 0)) <= 1 &&
							Math.abs(stepRect.bottom - (copyEnd?.bottom ?? 0)) <= 1
						);
					}),
				),
			)
			.toBe(true);

		for (const featureId of ["score", "ai", "document"]) {
			await page
				.locator(`#feature-${featureId}`)
				.evaluate((element) => element.scrollIntoView({ block: "center" }));
			await expect(activeVisual).toHaveAttribute("data-active-feature", featureId);
		}

		for (const height of [655, 787]) {
			await page.setViewportSize({ height, width: 1414 });
			await page.goto("/");
			await page
				.locator("#feature-document")
				.evaluate((element) => element.scrollIntoView({ block: "center" }));

			const documentHeading = page.locator("#feature-document [data-feature-heading]");
			const documentCopyEnd = page.locator("#feature-document [data-feature-copy-end]");
			const documentPreview = page.locator('[data-active-feature="document"]');
			await expect(documentPreview).toBeVisible();
			await expect
				.poll(() =>
					documentPreview.evaluate((element) =>
						element.getAnimations().every((animation) => animation.playState === "finished"),
					),
				)
				.toBe(true);

			const [topAlignmentDistance, bottomAlignmentDistance] = await Promise.all([
				Promise.all([
					documentHeading.evaluate((element) => element.getBoundingClientRect().top),
					documentPreview.evaluate((element) => element.getBoundingClientRect().top),
				]).then(([headingTop, previewTop]) => headingTop - previewTop),
				Promise.all([
					documentCopyEnd.evaluate((element) => element.getBoundingClientRect().bottom),
					documentPreview.evaluate((element) => element.getBoundingClientRect().bottom),
				]).then(([copyBottom, previewBottom]) => copyBottom - previewBottom),
			]);
			const distanceToAlignment = Math.max(topAlignmentDistance, bottomAlignmentDistance);
			await page.evaluate((distance) => window.scrollBy(0, distance), distanceToAlignment);

			await expect
				.poll(async () => {
					const [headingTop, previewTop] = await Promise.all([
						documentHeading.evaluate((element) => element.getBoundingClientRect().top),
						documentPreview.evaluate((element) => element.getBoundingClientRect().top),
					]);
					return Math.round(Math.abs(headingTop - previewTop));
				})
				.toBeLessThanOrEqual(8);

			const previewTopBeforeScroll = await documentPreview.evaluate(
				(element) => element.getBoundingClientRect().top,
			);
			await page.evaluate(() => window.scrollBy(0, 20));
			await expect
				.poll(() =>
					documentPreview.evaluate(
						(element, previousTop) => Math.round(previousTop - element.getBoundingClientRect().top),
						previewTopBeforeScroll,
					),
				)
				.toBeGreaterThanOrEqual(18);
		}
	});
});
