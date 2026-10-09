import { expect, test } from "bun:test";
import { execPath } from "node:process";

test("native PDF and image rendering feeds the OCR entry point with bounded, upright pages", async () => {
	// A separate process intentionally avoids preload's LiteParse/AI mocks.
	const process = Bun.spawn(
		[
			execPath,
			"--eval",
			`
		import assert from "node:assert/strict";
		import { LiteParse } from "@llamaindex/liteparse";
		import { PDFDocument, degrees } from "pdf-lib";
		const pdf = await PDFDocument.create();
		pdf.addPage([600, 800]).drawText("Native first page", { x: 30, y: 700 });
		const rotated = pdf.addPage([600, 800]);
		rotated.drawText("Native second page", { x: 40, y: 650 });
		rotated.setRotation(degrees(90));
		const bytes = Buffer.from(await pdf.save());
		const parser = new LiteParse({ ocrEnabled: false, quiet: true });
		try {
			const parsed = await parser.parse(bytes);
			assert.equal(parsed.totalPages, 2);
			assert.deepEqual(parsed.pages.map(p => p.pageNum), [1, 2]);
			assert.ok(parsed.text.includes("Native first page"));
			// Native layout extraction can insert spaces into rotated text.
			assert.equal(parsed.pages[1].text.replaceAll(" ", ""), "Nativesecondpage");
			assert.equal(parsed.pages[1].width, 800);
			assert.equal(parsed.pages[1].height, 600);
			for (const page of parsed.pages) {
				assert.ok(page.textItems.length > 0);
				for (const item of page.textItems) {
					assert.ok(item.x >= 0 && item.y >= 0);
					assert.ok(item.width > 0 && item.height > 0);
					assert.ok(item.x + item.width <= page.width + 1);
					assert.ok(item.y + item.height <= page.height + 1);
				}
			}
			// Exercise the actual app adapter with native rendering.
			// Only inference and provider options are mocked, not LiteParse or OCR code.
			const { mock } = await import("bun:test");
			let inferenceCalls = 0;
			let invalidGeometry = false;
			let invalidOutput = false;
			const rasterSizes = [];
			mock.module("@/orpc/scribe/providers", () => ({
				isOcrServiceSelection: () => false,
				buildProviderOptions: () => ({}),
			}));
			mock.module("ai", () => ({
				Output: { object: options => options },
				generateText: async options => {
					inferenceCalls++;
					const image = options.messages[1].content[0].image;
					const {width, height, format} = await (await import("sharp")).default(image).metadata();
					assert.equal(format, "jpeg");
					assert.equal(options.messages[1].content[0].mediaType, "image/jpeg");
					assert.ok(width <= 3000 && height <= 3000);
					assert.ok(width > 0 && height > 0);
					rasterSizes.push([width, height]);
					const output = { text: "[x] Ja    [ ] Nein", blocks: [{ text: "[x] Ja    [ ] Nein", box_2d: [200, invalidGeometry ? -1 : 100, 250, 350] }] };
					return {
						get output() {
							if (invalidOutput) throw new Error("private provider response");
							return output;
						},
						text: JSON.stringify(output), usage: {},
					};
				},
			}));
			const { extractOcrDocument } = await import("./orpc/scribe/ocr/index.ts");
			const selection = {model: {model: "test"}, slot: "file-image"};
			const result = await extractOcrDocument({data:bytes,mimeType:"application/pdf",modelSelection:selection,userId:"test"});
			assert.equal(inferenceCalls, 2);
			const reconstructedPages = result.text.split("\\n\\f\\n");
			assert.equal(reconstructedPages.length, 2);
			for (const text of reconstructedPages) {
				assert.match(text, /\\[x\\] Ja\\s+\\[ \\] Nein/);
			}
			assert.deepEqual(result.pages.map(p => [p.pageNumber,p.width,p.height]), [[1,600,800],[2,800,600]]);
			for (const page of result.pages) {
				const box = page.blocks[0].bbox;
				assert.ok(Math.abs(box.x - page.width / 10) < 2);
				assert.ok(Math.abs(box.y - page.height / 5) < 2);
				assert.ok(Math.abs(box.width - page.width / 4) < 2);
				assert.ok(Math.abs(box.height - page.height / 20) < 2);
			}
			// EXIF is baked into real pixels before the single model invocation.
			const sharp = (await import("sharp")).default;
			const jpeg = await sharp({create:{width:400,height:200,channels:3,background:"white"}})
				.withMetadata({orientation:6}).jpeg().toBuffer();
			rasterSizes.length = 0;
			const oriented = await extractOcrDocument({data:jpeg,mimeType:"image/jpeg",modelSelection:selection,userId:"test"});
			assert.equal(rasterSizes.length, 1);
			assert.equal(rasterSizes[0][1], rasterSizes[0][0] * 2);
			assert.equal(oriented.pages[0].rotation, undefined);
			assert.ok(Math.abs(oriented.pages[0].height - oriented.pages[0].width * 2) < 0.001);
			// Camera-sized input must not be sent as an unbounded inline PNG.
			const large = await sharp({create:{width:4200,height:5600,channels:3,background:"white"}}).png().toBuffer();
			rasterSizes.length = 0;
			const largeResult = await extractOcrDocument({data:large,mimeType:"image/png",modelSelection:selection,userId:"test"});
			assert.deepEqual(rasterSizes, [[2250, 3000]]);
			assert.ok(Math.abs(largeResult.pages[0].blocks[0].bbox.x / largeResult.pages[0].width - 0.1) < 0.001);
			invalidGeometry = true;
			const fallback = await extractOcrDocument({data:bytes,mimeType:"application/pdf",modelSelection:selection,userId:"test"});
			assert.equal(fallback.text, "[x] Ja    [ ] Nein\\n\\f\\n[x] Ja    [ ] Nein");
			assert.equal(fallback.pages, undefined);
			invalidOutput = true;
			await assert.rejects(
				extractOcrDocument({data:bytes,mimeType:"application/pdf",modelSelection:selection,userId:"test"}),
				{message: "Das OCR-Modell hat ein ungültiges Ergebnis zurückgegeben."},
			);
			await assert.rejects(parser.parse(Buffer.from("not a PDF")));
			console.log("Native PDF metadata, EXIF frame, bounded image rendering, malformed input: OK");
		} finally {
			parser.close();
		}
	`,
		],
		{ stderr: "pipe", stdout: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
	expect(stdout).toContain("bounded image rendering, malformed input: OK");
}, 30_000);
