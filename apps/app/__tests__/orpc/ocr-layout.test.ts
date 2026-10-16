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

test.each([{ zdr: false }, { zdr: true }])(
	"preserves layout and selection states through OCR and usage logging %j",
	async ({ zdr }) => {
		const server = await startTestServer("ocr-layout");
		try {
			await createTestAiDefaults(server.db);
			const { user } = await createTestUser(server.db);
			const modelSelection = await resolveDefaultModel(server.db, "file-image", user.id);
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
				{ text: firstText?.slice(0, -1) },
				{ text: secondText?.slice(1) },
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
			expect(document.text).toBe(expectedText);
			expect(document).not.toHaveProperty("ocrResult");
			expect(result.textContext).not.toContain('"bbox"');
			expect(result.ocrResults[0].text).toBe(expectedText);
			expect(result.ocrResults[0].pages).toBeUndefined();
			const request = aiMockState.lastOcrGenerateTextOptions as {
				messages: { content: unknown }[];
			};
			const prompt = String(request.messages[0].content);
			expect(prompt).toContain("including empty cells");
			expect(prompt).toContain("[x] for visibly selected");
			expect(prompt).toContain("[ ] for visibly empty");
			expect(prompt).toContain("[?] for ambiguous marks");
			const events = await server.db.select().from(usageEvent);
			expect(events).toHaveLength(3);
			const summary = events.find(
				(event) => (event.metadata as Record<string, unknown>)?.promptName === "ocr:document",
			);
			expect(summary?.result).toBe(zdr ? "[zdr - content redacted]" : expectedText);
			if (zdr) {
				expect(summary?.metadata).not.toHaveProperty("ocr");
			} else {
				expect(summary?.metadata).not.toHaveProperty("ocr.pages");
			}
		} finally {
			await server.close();
		}
	},
);
