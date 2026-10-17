import { expect, test } from "@playwright/test";
import sharp from "sharp";

for (const turns of [1, 2, 3]) {
	test(`document keeps its ${turns * 90}° alignment after closing and starts OCR with rotated bytes`, async ({
		page,
	}) => {
		const requests: Buffer[] = [];
		await page.route("**/api/rpc/scribe/documentInputPolicy", (route) =>
			route.fulfill({
				json: { json: { ocrConfigured: true, supportsDocuments: false } },
			}),
		);
		await page.route("**/api/rpc/scribe/extractContextFile", async (route) => {
			const { file } = route.request().postDataJSON().json;
			requests.push(Buffer.from(file.data, "base64"));
			const { width, height } = await sharp(requests.at(-1)).metadata();
			await route.fulfill({
				json: {
					json: {
						result: {
							backend: "llm",
							pages: [{ blocks: [], height, pageNumber: 1, width }],
							text: "Rotation test",
						},
					},
				},
			});
		});
		await page.goto("/aiscribe/outpatient");
		await page.getByRole("button", { exact: true, name: "Dateien hinzufügen" }).click();
		const buffer = await sharp(
			Buffer.from(
				'<svg width="80" height="120"><path fill="red" d="M0 0h80v60H0z"/><path fill="blue" d="M0 60h80v60H0z"/></svg>',
			),
		)
			.png()
			.toBuffer();
		await page.locator('input[type="file"][accept="application/pdf,image/*"]').setInputFiles({
			buffer,
			mimeType: "image/png",
			name: "alignment.png",
		});
		await page.getByRole("button", { name: /alignment.png.*KB/ }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.locator("svg image")).toBeVisible();
		for (let index = 0; index < turns; index += 1) {
			await dialog.getByRole("button", { name: "Rechts drehen" }).click();
		}
		await dialog.getByRole("button", { exact: true, name: "Close" }).click();
		await expect(dialog).toHaveCount(0);
		await page.getByRole("button", { name: /alignment.png.*KB/ }).click();
		await expect(dialog.locator("svg g").first()).toHaveAttribute(
			"transform",
			new RegExp(`rotate\\(${turns * 90}\\)`),
		);
		expect(requests).toHaveLength(0);
		await dialog.getByRole("button", { exact: true, name: "Close" }).click();
		await page.getByRole("button", { exact: true, name: "OCR für alignment.png starten" }).click();
		await expect(page.getByLabel("OCR abgeschlossen")).toBeVisible();
		await expect(dialog).toHaveCount(0);
		expect(requests).toHaveLength(1);
		const { data, info } = await sharp(requests[0]).raw().toBuffer({ resolveWithObject: true });
		expect([info.width, info.height]).toEqual(turns === 2 ? [80, 120] : [120, 80]);
		// Top-left is blue at 90°/180°, but red at 270°: catches the wrong
		// direction as well as rotations that only change the preview.
		const pixel = (10 * info.width + 10) * info.channels;
		expect(data[pixel + (turns === 3 ? 0 : 2)]).toBeGreaterThan(230);
		expect(data[pixel + (turns === 3 ? 2 : 0)]).toBeLessThan(25);
		await page.getByRole("button", { name: /alignment.jpg.*KB/ }).click();
		await expect(dialog.locator("svg image")).toHaveAttribute("width", String(info.width));
		await expect(dialog.locator("svg image")).toHaveAttribute("height", String(info.height));
		await expect(dialog.locator("svg g[transform*='rotate']")).toHaveCount(0);
		await dialog.getByRole("button", { exact: true, name: "OCR erneut starten" }).click();
		await expect(page.getByLabel("OCR abgeschlossen")).toBeVisible();
		expect(requests).toHaveLength(2);
		expect(requests[1]).toEqual(requests[0]);
	});
}
