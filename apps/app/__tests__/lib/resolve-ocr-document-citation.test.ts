import { describe, expect, test } from "bun:test";

import { resolveCitation } from "markdoc-md/citations";

import { resolveOcrDocumentCitation } from "@/lib/citations/resolve-ocr-document-citation";

describe("OCR document citation adapter", () => {
	test("uses supplied OCR geometry and renders only the cited page", async () => {
		const location = {
			bounds: { height: 5, width: 10, x: 2, y: 3 },
			imageBase64: "page-image",
			pageHeight: 100,
			pageNumber: 1,
			pageWidth: 100,
			quote: "Alpha",
		};
		const result = await resolveOcrDocumentCitation(
			new File(["document"], "report.pdf", { type: "application/pdf" }),
			"Alpha",
			{
				matcher: () => ({ ...location, strategy: "test-fallback" }),
				ocrResult: {
					backend: "llm",
					pages: [
						{
							blocks: [{ bbox: location.bounds, text: "Alpha" }],
							height: 100,
							pageNumber: 1,
							width: 100,
						},
					],
					text: "Alpha",
				},
				renderPage: (file, pageNumber) => {
					expect(file.name).toBe("report.pdf");
					expect(pageNumber).toBe(1);
					return Promise.resolve("page-image");
				},
			},
		);

		expect(result).toEqual(location);
	});

	test("keeps source opening available when supplied OCR has no match", async () => {
		let rendered = false;
		const result = await resolveOcrDocumentCitation(new File(["image"], "scan.png"), "Missing", {
			ocrResult: { backend: "llm", text: "Missing" },
			renderPage: () => {
				rendered = true;
				return Promise.resolve("page-image");
			},
		});

		expect(result).toBeNull();
		expect(rendered).toBe(false);
	});

	test("opens the original source when rendering fails and preserves cancellation", async () => {
		const file = new File(["document"], "scan.pdf", { type: "application/pdf" });
		const options = {
			ocrResult: {
				backend: "ocr-http" as const,
				pages: [
					{
						blocks: [
							{ bbox: { height: 20, width: 90, x: 40, y: 100 }, text: "Alpha" },
							{ bbox: { height: 15, width: 110, x: 45, y: 124 }, text: "Beta" },
						],
						height: 800,
						pageNumber: 2,
						width: 600,
					},
				],
				text: "Alpha Beta",
			},
			renderPage: () => Promise.reject(new Error("Renderer unavailable")),
		};
		const resolution = await resolveCitation(
			{ quote: "Alpha Beta", source: "mdscribe://file/scan" },
			{
				createFileUrl: () => "blob:original",
				documentResolver: (document, quote) => resolveOcrDocumentCitation(document, quote, options),
				files: new Map([["scan", file]]),
			},
		);
		expect(resolution).toMatchObject({
			kind: "document",
			location: undefined,
			url: "blob:original",
		});

		const location = await resolveOcrDocumentCitation(file, "Alpha Beta", {
			...options,
			renderPage: () => Promise.resolve("page-image"),
		});
		expect(location).toMatchObject({
			bounds: { height: 39, width: 115, x: 40, y: 100 },
			pageNumber: 2,
		});

		const controller = new AbortController();
		controller.abort();
		await expect(
			resolveOcrDocumentCitation(file, "Alpha Beta", { ...options, signal: controller.signal }),
		).rejects.toMatchObject({ name: "AbortError" });
	});
});
