import { describe, expect, test } from "bun:test";

import {
	createOcrQuoteMatcher,
	matchOcrQuote,
	unionOcrCitationBounds,
} from "@/lib/citations/ocr-quote-matcher";

const document = {
	pages: [
		{
			blocks: [
				{
					bbox: { height: 12, width: 80, x: 20, y: 30 },
					text: "Diagnose: arterielle",
				},
				{
					bbox: { height: 12, width: 90, x: 20, y: 46 },
					text: "Hypertonie Grad II",
				},
				{
					bbox: { height: 12, width: 60, x: 20, y: 70 },
					text: "Nebendiagnose",
				},
			],
			height: 800,
			pageNumber: 2,
			width: 600,
		},
	],
};

describe("OCR quote matching", () => {
	test("unions the smallest contiguous block run containing a split quote", () => {
		expect(matchOcrQuote(document, "arterielle Hypertonie Grad II")).toEqual({
			bounds: { height: 28, width: 90, x: 20, y: 30 },
			pageHeight: 800,
			pageNumber: 2,
			pageWidth: 600,
			quote: "arterielle Hypertonie Grad II",
			strategy: "contiguous-blocks",
		});
	});

	test("normalizes OCR whitespace and letter case", () => {
		expect(matchOcrQuote(document, "HYPERTONIE   grad ii")).toMatchObject({
			bounds: { height: 12, width: 90, x: 20, y: 46 },
			pageNumber: 2,
		});
	});

	test("selects the occurrence spanning the fewest OCR blocks", () => {
		expect(
			matchOcrQuote(
				{
					pages: [
						{
							blocks: [
								{ bbox: { height: 10, width: 30, x: 10, y: 10 }, text: "Alpha" },
								{ bbox: { height: 10, width: 30, x: 45, y: 10 }, text: "Beta" },
								{
									bbox: { height: 10, width: 70, x: 10, y: 30 },
									text: "Alpha Beta",
								},
							],
							height: 100,
							pageNumber: 1,
							width: 100,
						},
					],
				},
				"Alpha Beta",
			),
		).toMatchObject({ bounds: { height: 10, width: 70, x: 10, y: 30 } });
	});

	test("returns null for missing text or unusable geometry", () => {
		expect(matchOcrQuote(document, "Diabetes mellitus")).toBeNull();
		expect(
			matchOcrQuote(
				{
					pages: [
						{
							blocks: [
								{
									bbox: { height: 10, width: 50, x: 580, y: 0 },
									text: "outside page",
								},
							],
							height: 800,
							pageNumber: 1,
							width: 600,
						},
					],
				},
				"outside page",
			),
		).toBeNull();
	});

	test("runs additional strategies in declared fallback order", () => {
		const matcher = createOcrQuoteMatcher([
			{ find: () => null, name: "strict" },
			{
				find: ({ quote }) => ({
					bounds: { height: 5, width: 10, x: 2, y: 3 },
					pageHeight: 100,
					pageNumber: 1,
					pageWidth: 100,
					quote,
					strategy: "ignored",
				}),
				name: "legal-text-fallback",
			},
		]);

		expect(matcher({}, "Section 12")).toMatchObject({
			quote: "Section 12",
			strategy: "legal-text-fallback",
		});
	});

	test("unions asymmetric boxes independently of input order", () => {
		expect(
			unionOcrCitationBounds([
				{ height: 8, width: 20, x: 40, y: 12 },
				{ height: 20, width: 10, x: 5, y: 4 },
			]),
		).toEqual({ height: 20, width: 55, x: 5, y: 4 });
	});

	test("maps a table row in visual order without including the preceding row", () => {
		const page = {
			...document.pages[0],
			blocks: [
				{ bbox: { height: 15, width: 130, x: 250, y: 100 }, text: "52 / 26 (36)" },
				{ bbox: { height: 15, width: 360, x: 20, y: 80 }, text: "RA mmHg 6" },
				{ bbox: { height: 15, width: 100, x: 20, y: 100 }, text: "PAP mmHg" },
			],
		};
		expect(matchOcrQuote({ pages: [page] }, "PAP mmHg | 52 / 26 (36)")).toMatchObject({
			bounds: { height: 15, width: 360, x: 20, y: 100 },
			pageNumber: 2,
		});
	});

	test("locates quotes with table markup, joined cells and label punctuation without changing numbers", () => {
		const page = {
			...document.pages[0],
			blocks: [
				{ bbox: { height: 15, width: 80, x: 20, y: 100 }, text: "HF bpm" },
				{ bbox: { height: 25, width: 30, x: 120, y: 100 }, text: "83" },
				{ bbox: { height: 15, width: 80, x: 20, y: 140 }, text: "AF" },
				{ bbox: { height: 25, width: 30, x: 120, y: 140 }, text: "15" },
				{ bbox: { height: 15, width: 250, x: 20, y: 180 }, text: "Untersuchungsnr. 343 2026" },
			],
		};
		const ocr = { pages: [page] };
		expect(matchOcrQuote(ocr, "HF bpm</td><td>83")).toMatchObject({
			bounds: { height: 25, width: 130, x: 20, y: 100 },
			pageNumber: 2,
		});
		expect(matchOcrQuote(ocr, "AF15")).toMatchObject({
			bounds: { height: 25, width: 130, x: 20, y: 140 },
		});
		expect(matchOcrQuote(ocr, "Untersuchungsnr.: 343 2026")).toMatchObject({
			bounds: { height: 15, width: 250, x: 20, y: 180 },
		});
		expect(matchOcrQuote(ocr, "HF bpm</td><td>85")).toBeNull();
		expect(matchOcrQuote(ocr, "AF5")).toBeNull();
	});

	test("locates a table cell across an interleaved side table, not a value on another row", () => {
		const page = {
			...document.pages[0],
			blocks: [
				{ bbox: { height: 20, width: 80, x: 300, y: 100 }, text: "SV02 %" },
				{ bbox: { height: 15, width: 80, x: 20, y: 108 }, text: "WEDGE" },
				{ bbox: { height: 25, width: 30, x: 450, y: 110 }, text: "71" },
				{ bbox: { height: 25, width: 30, x: 450, y: 200 }, text: "97" },
			],
		};
		expect(matchOcrQuote({ pages: [page] }, "SV02 % 71")).toMatchObject({
			bounds: { height: 35, width: 180, x: 300, y: 100 },
			strategy: "spatial-row",
		});
		expect(matchOcrQuote({ pages: [page] }, "SV02 % 97")).toBeNull();
		expect(matchOcrQuote({ pages: [page, { ...page, pageNumber: 3 }] }, "SV02 % 71")).toBeNull();
		expect(
			matchOcrQuote(
				{
					pages: [
						{
							...page,
							blocks: [
								...page.blocks,
								{ bbox: { height: 15, width: 30, x: 390, y: 110 }, text: "anderer Wert" },
							],
						},
					],
				},
				"SV02 % 71",
			),
		).toBeNull();
		expect(
			matchOcrQuote(
				{
					pages: [
						{
							...page,
							blocks: [
								...page.blocks,
								{ bbox: { height: 15, width: -30, x: 390, y: 110 }, text: "ungültig" },
							],
						},
					],
				},
				"SV02 % 71",
			),
		).toBeNull();
	});

	test("rejects corrected or misspelled quotes, even when only one location is close", () => {
		expect(matchOcrQuote(document, "arterielle Hypertonle Grad II")).toBeNull();
		expect(
			matchOcrQuote(
				{ pages: [...document.pages, { ...document.pages[0], pageNumber: 3 }] },
				"arterielle Hypertonle Grad II",
			),
		).toBeNull();
	});

	test.each([
		["[ ] Penicillinallergie bekannt", "[x] Penicillinallergie bekannt"],
		["CRP Konzentration <5 mg/l", "CRP Konzentration >5 mg/l"],
		["Pleuraerguss nicht nachweisbar", "Pleuraerguss nachweisbar"],
		["Pleuraerguss nachweisbar", "Pleuraerguss nicht nachweisbar"],
		["HZV l/min 4,78", "HZV l/min 4.78"],
	])("requires literal clinical content from %s, not %s", (text, changedQuote) => {
		const ocr = {
			pages: [
				{
					...document.pages[0],
					blocks: [{ bbox: { height: 12, width: 80, x: 20, y: 30 }, text }],
				},
			],
		};
		expect(matchOcrQuote(ocr, text)).toMatchObject({
			bounds: { height: 12, width: 80, x: 20, y: 30 },
			pageNumber: 2,
		});
		expect(matchOcrQuote(ocr, changedQuote)).toBeNull();
	});

	test("exact and substring matching cannot change clinical numbers", () => {
		const page = {
			...document.pages[0],
			blocks: [
				{
					bbox: { height: 15, width: 360, x: 20, y: 100 },
					text: "Sauerstoffsättigung unter Raumluft: 92 %",
				},
			],
		};
		expect(matchOcrQuote({ pages: [page] }, "Sauerstoffsättlgung unter Raumluft: 92 %")).toBeNull();
		expect(matchOcrQuote({ pages: [page] }, "Sauerstoffsättigung unter Raumluft: 97 %")).toBeNull();
		for (const text of ["PAWP 16", "PAWP 6.9", "PAWP -6"]) {
			expect(
				matchOcrQuote({ pages: [{ ...page, blocks: [{ ...page.blocks[0], text }] }] }, "6"),
			).toBeNull();
		}
		expect(
			matchOcrQuote(
				{ pages: [{ ...page, blocks: [{ ...page.blocks[0], text: "RA 6 ZVD 6" }] }] },
				"6",
			),
		).toBeNull();
	});
});
