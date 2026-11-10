import { expect, test } from "@playwright/test";
import { degrees, PDFDocument, StandardFonts } from "pdf-lib";

test("PDF field targets stay aligned on normal and rotated pages after preview updates", async ({
	page,
}) => {
	await page.goto("/sign-in");
	const signInCard = page.getByTestId("sign-in-card");
	await signInCard.getByLabel("E-Mail oder Benutzername").fill("test@test.com");
	await signInCard.getByLabel("Passwort", { exact: true }).fill("password123");
	await signInCard.getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/dashboard/);
	await page.goto("/documents/create");

	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < 2; index += 1) {
		const pdfPage = pdf.addPage([600, 800]);
		pdfPage.setRotation(degrees(index * 90));
		pdfPage.drawText(`Preview page ${index + 1}`, { font, size: 20, x: 48, y: 740 });
		const field = pdf.getForm().createTextField(`Patient${index + 1}`);
		field.addToPage(pdfPage, { borderWidth: 0, height: 30, width: 260, x: 48, y: 610 });
	}
	await page.getByLabel("Datei hochladen", { exact: true }).setInputFiles({
		buffer: Buffer.from(await pdf.save()),
		mimeType: "application/pdf",
		name: "preview.pdf",
	});

	for (const [index, expected] of [
		[1, { height: 30, left: 48, top: 160, width: 260 }],
		[2, { height: 260, left: 610, top: 48, width: 30 }],
	] as const) {
		if (index === 2) {
			// Selecting the second editor field navigates to its rotated PDF page.
			await page
				.getByRole("textbox", { exact: true, name: "Hilfetext für das Eingabefeld" })
				.nth(1)
				.focus();
		}
		const target = page.getByRole("button", { name: `PDF-Feld Patient${index} auswählen` });
		await expect(target).toBeVisible();
		await expect(page.getByText(`Seite ${index} von 2`, { exact: true })).toBeVisible();
		await expect
			.poll(async () => {
				const pdfPage = page.locator(`.react-pdf__Page[data-page-number="${index}"]`);
				const canvasBox = await pdfPage.locator("canvas").boundingBox();
				const targetBox = await target.boundingBox();
				if (!canvasBox || !targetBox) {
					return Number.POSITIVE_INFINITY;
				}
				const scale = canvasBox.width / (index === 1 ? 600 : 800);
				return Math.max(
					Math.abs(targetBox.x - canvasBox.x - expected.left * scale),
					Math.abs(targetBox.y - canvasBox.y - expected.top * scale),
					Math.abs(targetBox.width - expected.width * scale),
					Math.abs(targetBox.height - expected.height * scale),
				);
			})
			.toBeLessThan(1);
		await target.click();
	}
});
