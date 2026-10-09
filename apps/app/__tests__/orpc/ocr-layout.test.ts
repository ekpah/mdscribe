import { expect, test } from "bun:test";

import { usageEvent } from "@repo/database";

import { aiMockState, ocrMockState } from "@/__tests__/preload";
import { createTestAiDefaults, createTestUser, startTestServer } from "@/__tests__/setup";
import { extractContextFiles } from "@/orpc/scribe/handlers/context-file-input";
import { resolveDefaultModel } from "@/orpc/scribe/providers";

// Deliberately asymmetric: leading indentation, an empty table cell, opposite
// selections and an uncertain mark must all survive without reflow or guessing.
const transcription =
	"    Aufnahme\n\nSeite     Ja     Nein\nLinks     [x]    [ ]\nRechts    [ ]    [x]\nUnklar    [?]\nWert             12\n\f\n    Verlauf\n";

test.each([
	{ invalidGeometry: false, zdr: false },
	{ invalidGeometry: true, zdr: false },
	{ invalidGeometry: false, zdr: true },
])(
	"preserves layout and selection states through OCR and usage logging %j",
	async ({ invalidGeometry, zdr }) => {
		const server = await startTestServer("ocr-layout");
		try {
			await createTestAiDefaults(server.db);
			const { user } = await createTestUser(server.db);
			const modelSelection = await resolveDefaultModel(server.db, "file-image", user.id);
			const outputPages = [
				{
					blocks: [
						{ box_2d: [60, 30, 150, 650], text: "Links     [x]    [ ]" },
						{ box_2d: [180, 30, 270, 650], text: "Rechts    [ ]    [x]" },
						{
							box_2d: [300, invalidGeometry ? -1 : 30, 390, 500],
							text: "Unklar    [?]",
						},
					],
					height: 64,
					pageNumber: 1,
					width: 64,
				},
				{ blocks: [], height: 64, pageNumber: 1, width: 64 },
			];
			ocrMockState.result = {
				pageErrors: [],
				pages: [
					{
						height: 842,
						markdown: "native",
						pageNum: 1,
						text: "native",
						textItems: [],
						width: 595,
					},
					{ height: 842, markdown: "", pageNum: 2, text: "", textItems: [], width: 595 },
				],
				text: "native",
				totalPages: 2,
			};
			const [firstText, secondText] = transcription.split("\f");
			aiMockState.nextOcrOutputs = [
				{ blocks: outputPages[0].blocks, text: firstText?.slice(0, -1) },
				{ blocks: outputPages[1].blocks, text: secondText?.slice(1) },
			];
			const result = await extractContextFiles({
				contextFiles: [
					{
						data: Buffer.from("test-pdf").toString("base64"),
						mimeType: "application/pdf",
						name: "form.pdf",
						size: 10,
					},
				],
				db: server.db,
				modelSelection,
				userId: user.id,
				zdr,
			});
			const expectedText = transcription;
			const [document] = JSON.parse(result.textContext.split("\n")[1]);
			expect(document).toMatchObject({ index: 1, name: "form.pdf" });
			expect(document).not.toHaveProperty("mimeType");
			expect(document.ocrResult.text).toBe(expectedText);
			expect(result.ocrResults[0].text).toBe(expectedText);
			if (invalidGeometry) {
				expect(result.ocrResults[0].pages).toBeUndefined();
				expect(document.ocrResult.pages).toBeUndefined();
			} else {
				expect(result.ocrResults[0].pages).toHaveLength(2);
				expect(document.ocrResult.pages[0].blocks[0]).toEqual({
					bbox: { height: 75.78, width: 368.9, x: 17.85, y: 50.52 },
					text: "Links     [x]    [ ]",
				});
			}
			const request = aiMockState.lastOcrGenerateTextOptions as {
				messages: { content: unknown }[];
			};
			const prompt = String(request.messages[0].content);
			expect(prompt).toContain("including empty cells");
			expect(prompt).toContain("[x] for visibly selected");
			expect(prompt).toContain("[ ] for visibly empty");
			expect(prompt).toContain("[?] for ambiguous marks");
			expect(prompt).toContain("both text and its block");
			const events = await server.db.select().from(usageEvent);
			expect(events).toHaveLength(3);
			const summary = events.find(
				(event) => (event.metadata as Record<string, unknown>)?.promptName === "ocr:document",
			);
			expect(summary?.result).toBe(zdr ? "[zdr - content redacted]" : expectedText);
			if (zdr) {
				expect(summary?.metadata).not.toHaveProperty("ocr");
			} else if (!invalidGeometry) {
				expect(summary?.metadata).toHaveProperty("ocr.pages");
			}
		} finally {
			await server.close();
		}
	},
);
