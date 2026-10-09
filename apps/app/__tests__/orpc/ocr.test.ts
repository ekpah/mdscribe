import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { ParsedPage } from "@llamaindex/liteparse";
import { eq, usageEvent } from "@repo/database";

import { aiMockState, ocrMockState } from "@/__tests__/preload";
import { createTestUser, startTestServer } from "@/__tests__/setup";
import { AI_SCRIBE_OCR_EVENT_NAME } from "@/lib/usage-event-names";
import { extractContextFileText } from "@/orpc/scribe/handlers/context-file-input";
import { extractOcrDocument } from "@/orpc/scribe/ocr";
import { createHttpOcrAdapter } from "@/orpc/scribe/ocr/adapters/ocr-http";
import type {
	ResolvedDefaultModelSelection,
	ResolvedOcrServiceSelection,
} from "@/orpc/scribe/providers";

const modelSelection: ResolvedDefaultModelSelection = {
	defaultTemperature: null,
	model: {
		credentialSource: "operator",
		isOpenRouter: false,
		model: "test-ocr",
		modelName: "test-ocr",
		openRouterRoutingMode: "default",
		providerId: "test",
		providerProtocol: "openai-compatible",
		supportedParameters: [],
		supportsReasoning: false,
	},
	reasoningEffort: "none",
	slot: "file-image",
};

const input = {
	data: Buffer.from("private-file-bytes"),
	mimeType: "application/pdf",
	modelSelection,
	userId: "test",
};

const httpSelection: ResolvedOcrServiceSelection = {
	kind: "ocr-service",
	model: {
		apiKey: "private-token",
		credentialSource: "operator",
		endpoint: "http://paddle:8829/ocr",
		modelName: "Paddle/ocr",
		providerId: "paddle",
		providerProtocol: "ocr-http",
	},
	slot: "file-image",
};

const nativePage = (pageNum: number, text: string): ParsedPage => ({
	height: 800,
	markdown: text,
	pageNum,
	text,
	textItems: [{ height: 15, text, width: 100, x: 10, y: 20 }],
	width: 600,
});

const useNativePages = () => {
	ocrMockState.result = {
		pageErrors: [],
		pages: [nativePage(1, "Befund A"), nativePage(2, "Befund B")],
		text: "Befund A\n\nBefund B",
		totalPages: 2,
	};
	return ocrMockState.result;
};

const reset = () => {
	ocrMockState.closed = 0;
	delete ocrMockState.config;
	delete ocrMockState.error;
	delete ocrMockState.result;
	delete aiMockState.lastGenerateTextOptions;
	delete aiMockState.nextGenerateTextText;
	delete aiMockState.nextOcrOutput;
	delete aiMockState.nextOcrOutputs;
};
let endpoint: ReturnType<typeof Bun.serve>;
let requests: Request[];
let nativeText: string | undefined;
beforeEach(() => {
	reset();
	requests = [];
	nativeText = undefined;
	endpoint = Bun.serve({
		fetch(request) {
			requests.push(request.clone());
			const text = requests.length % 2 ? "Befund A" : "Befund B";
			return Response.json({
				results: [{ bbox: [1, 2, 11, 4], confidence: 0.9, text }],
				text: nativeText ?? text,
			});
		},
		hostname: "127.0.0.1",
		port: 0,
	});
	httpSelection.model.endpoint = `${endpoint.url}ocr`;
});
afterEach(() => {
	endpoint.stop(true);
	reset();
});

describe("OCR module", () => {
	test.each([undefined, 0, 90, 180, 270])(
		"HTTP boxes use the supplied frame and reject automatic correction (rotation=%s)",
		async (rotation) => {
			const service = Bun.serve({
				fetch: () =>
					Response.json({
						results: [{ bbox: [10, 100, 30, 150], confidence: 1, text: "dose" }],
						rotation,
						text: "dose",
					}),
				hostname: "127.0.0.1",
				port: 0,
			});
			try {
				const adapter = createHttpOcrAdapter({
					...httpSelection.model,
					endpoint: `${service.url}ocr`,
				});
				if (adapter.kind !== "page") {
					throw new Error("expected a page adapter");
				}
				const recognize = () =>
					adapter.recognizePage({
						image: Buffer.from("raster"),
						imageHeight: 160,
						imageWidth: 80,
						page: { height: 800, pageNum: 1, width: 600 },
					});
				if (rotation) {
					await expect(recognize()).rejects.toThrow("OCR-Service-Anfrage ist fehlgeschlagen");
					return;
				}
				const result = await recognize();
				expect(result.page).toEqual({
					blocks: [{ bbox: { height: 250, width: 150, x: 75, y: 500 }, text: "dose" }],
					height: 800,
					pageNumber: 1,
					width: 600,
				});
			} finally {
				service.stop(true);
			}
		},
	);

	test("preserves native HTTP HTML and empty cells instead of line reflow", async () => {
		nativeText =
			'<table><tr><td rowspan="2">A</td><td></td><td colspan="4">bei Bedarf</td></tr></table>';
		const result = await extractOcrDocument({ ...input, modelSelection: httpSelection });
		expect(result.text).toBe(nativeText);
		expect(result.pages?.[0].blocks[0].text).toBe("Befund A");
		nativeText = "";
		const empty = await extractOcrDocument({ ...input, modelSelection: httpSelection });
		expect(empty.text).toBe("");
	});

	test("returns text and direct-frame boxes in one call without requesting orientation", async () => {
		aiMockState.nextOcrOutputs = [
			{
				blocks: [{ box_2d: [100, 200, 300, 500], text: "cell" }],
				text: "upright",
			},
		];
		const usages: string[] = [];
		const result = await extractOcrDocument({
			...input,
			onModelUsage: ({ text }) => usages.push(text),
		});
		expect(usages).toHaveLength(1);
		expect(result.text).toBe("upright");
		expect(result.pages?.[0]).toEqual({
			blocks: [
				{
					bbox: { height: 160, width: 180, x: 120, y: 80 },
					text: "cell",
				},
			],
			height: 800,
			pageNumber: 1,
			width: 600,
		});
		const request = aiMockState.lastGenerateTextOptions as { messages: { content: unknown }[] };
		expect(request.messages[0].content).toContain(
			"Do not detect, infer or correct its orientation",
		);
		expect(ocrMockState.closed).toBe(1);
	});

	test("normalizes HTTP OCR geometry without calling an LLM", async () => {
		useNativePages();
		delete aiMockState.lastGenerateTextOptions;
		const result = await extractOcrDocument({ ...input, modelSelection: httpSelection });
		expect(result.text).toBe("Befund A\n\f\nBefund B");
		expect(result.pages?.map((page) => page.pageNumber)).toEqual([1, 2]);
		expect(result.pages?.[0]).toEqual({
			blocks: [{ bbox: { height: 25, width: 93.75, x: 9.375, y: 25 }, text: "Befund A" }],
			height: 800,
			pageNumber: 1,
			width: 600,
		});
		expect(ocrMockState.config).toMatchObject({
			ocrEnabled: false,
		});
		expect(aiMockState.lastGenerateTextOptions).toBeUndefined();
		expect(ocrMockState.closed).toBe(1);
	});

	test("calls the selected vision model directly and maps normalized boxes to page points", async () => {
		aiMockState.nextGenerateTextText = "  LLM OCR text  ";
		const result = await extractOcrDocument({ ...input, zdr: true });
		expect(result).toMatchObject({ backend: "llm", text: "  LLM OCR text  " });
		expect(result.pages?.[0].blocks).toEqual([
			{
				bbox: { height: 175, width: 553.125, x: 9.375, y: 12.5 },
				text: "  LLM OCR text  ",
			},
		]);
		const request = aiMockState.lastGenerateTextOptions as {
			messages: { role: string; content: unknown }[];
			output: unknown;
		};
		expect(request.messages).toHaveLength(2);
		expect(request.messages[0].content).toContain("[ymin, xmin, ymax, xmax]");
		expect(request.output).toBeDefined();
		expect(JSON.stringify(request)).not.toContain("private-file-bytes");
		expect(ocrMockState.closed).toBe(1);
	});

	test("preserves document table markup instead of reconstructing it from citation boxes", async () => {
		aiMockState.nextGenerateTextText =
			"| Side | Selected |\n| --- | --- |\n| Left | [x] |\n| Right | [ ] |";
		const result = await extractOcrDocument(input);
		expect(result.text).toBe("| Side | Selected |\n| --- | --- |\n| Left | [x] |\n| Right | [ ] |");
		expect(ocrMockState.config?.ocrEnabled).toBe(false);
	});

	test("preserves text while omitting invalid LLM geometry", async () => {
		aiMockState.nextOcrOutput = {
			blocks: [{ box_2d: [20, -1, 100, 200], text: "Invalid" }],
			text: "  still useful  ",
		};
		const result = await extractOcrDocument(input);
		expect(result).toEqual({ backend: "llm", text: "  still useful  " });
		expect(ocrMockState.closed).toBe(1);
	});

	test.each([
		[20, 10, 10, 50],
		[0, 0, 1001, 80],
		[0, 0, 10],
	])("omits reversed, out-of-range or incomplete boxes: %j", async (...box) => {
		aiMockState.nextOcrOutput = { blocks: [{ box_2d: box, text: "cell" }], text: "preserved" };
		expect(await extractOcrDocument(input)).toEqual({ backend: "llm", text: "preserved" });
	});

	test("ignores empty labels without discarding valid citation boxes", async () => {
		aiMockState.nextOcrOutput = {
			blocks: [
				{ box_2d: [0, 0, 0, 0], text: "  " },
				{ box_2d: [10, 20, 30, 40], text: "cell" },
			],
			text: "cell",
		};
		const result = await extractOcrDocument(input);
		expect(result.pages?.[0].blocks.map((block) => block.text)).toEqual(["cell"]);
	});

	test("does not expose malformed provider content in validation errors", async () => {
		aiMockState.nextOcrOutput = { blocks: "not an array", text: "private medical content" };
		await expect(extractOcrDocument(input)).rejects.toThrow("ungültiges Ergebnis");
		expect(ocrMockState.closed).toBe(1);
	});

	test("inspects every page and maps each rendered box to its original page", async () => {
		ocrMockState.result = {
			pageErrors: [],
			pages: [
				{ ...nativePage(3, "Native text must not skip OCR"), height: 800, width: 600 },
				{ ...nativePage(7, ""), height: 400, textItems: [], width: 1000 },
			],
			text: "Native text must not skip OCR",
			totalPages: 2,
		};
		aiMockState.nextOcrOutputs = [
			{
				blocks: [{ box_2d: [31.25, 62.5, 156.25, 312.5], text: "First" }],
				text: "First",
			},
			{
				blocks: [{ box_2d: [250, 500, 312.5, 625], text: "Second" }],
				text: "Second",
			},
		];
		const result = await extractOcrDocument(input);
		expect(result.text).toBe("First\n\f\nSecond");
		expect(result.pages).toEqual([
			{
				blocks: [{ bbox: { height: 100, width: 150, x: 37.5, y: 25 }, text: "First" }],
				height: 800,
				pageNumber: 3,
				width: 600,
			},
			{
				blocks: [{ bbox: { height: 25, width: 125, x: 500, y: 100 }, text: "Second" }],
				height: 400,
				pageNumber: 7,
				width: 1000,
			},
		]);
		expect(aiMockState.nextOcrOutputs).toBeUndefined();
	});

	test("passes the selected HTTP provider endpoint and bearer token directly to the service", async () => {
		useNativePages();
		const result = await extractOcrDocument({ ...input, modelSelection: httpSelection });
		expect(result.backend).toBe("ocr-http");
		expect(requests).toHaveLength(2);
		expect(requests[0].headers.get("authorization")).toBe("Bearer private-token");
		expect(requests[0].url).toBe(httpSelection.model.endpoint);
		expect(aiMockState.lastGenerateTextOptions).toBeUndefined();
		expect(JSON.stringify(result)).not.toContain("private-token");
	});

	test("closes the parser after errors and does not silently fall back", async () => {
		ocrMockState.error = new Error("invalid PDF");
		await expect(extractOcrDocument(input)).rejects.toThrow("invalid PDF");
		expect(ocrMockState.closed).toBe(1);
	});

	test("rejects partial parsing", async () => {
		useNativePages().totalPages = 3;
		await expect(extractOcrDocument(input)).rejects.toThrow("vollständig");
		expect(ocrMockState.closed).toBe(1);
	});
});

describe("Scribe OCR adapter", () => {
	test.each([false, true])(
		"logs geometry only without ZDR (zdr=%s), while supplying document text and boxes",
		async (zdr) => {
			const server = await startTestServer(`ocr-geometry-${zdr}`);
			try {
				const { user } = await createTestUser(server.db);
				useNativePages();
				const text = await extractContextFileText({
					contextFiles: ["one.pdf", "two.pdf"].map((name) => ({
						data: input.data.toString("base64"),
						mimeType: "application/pdf",
						name,
						size: input.data.length,
					})),
					db: server.db,
					modelSelection: httpSelection,
					userId: user.id,
					zdr,
				});
				const documents = JSON.parse(text.split("\n")[1]);
				expect(
					documents.map((document: { index: number; name: string }) => ({
						index: document.index,
						name: document.name,
					})),
				).toEqual([
					{ index: 1, name: "one.pdf" },
					{ index: 2, name: "two.pdf" },
				]);
				for (const document of documents) {
					expect(document.ocrResult.text).toBe("Befund A\n\f\nBefund B");
					expect(document.ocrResult.pages).toHaveLength(2);
				}
				expect(text).toContain("bbox");
				const events = await server.db
					.select()
					.from(usageEvent)
					.where(eq(usageEvent.name, AI_SCRIBE_OCR_EVENT_NAME));
				expect(events).toHaveLength(2);
				for (const event of events) {
					expect(event.model).toBe("Paddle/ocr");
					expect(event.metadata).toMatchObject({ promptName: "ocr:document" });
					expect(event.inputTokens).toBeNull();
					expect(event.result).toBe(zdr ? "[zdr - content redacted]" : "Befund A\n\f\nBefund B");
					const metadata = event.metadata as Record<string, unknown>;
					if (zdr) {
						expect(metadata.ocr).toBeUndefined();
						expect(JSON.stringify(event)).not.toContain("Befund A");
					} else {
						expect(metadata.ocr).toMatchObject({
							coordinateSystem: "page-relative-top-left",
							pages: [{ pageNumber: 1 }, { pageNumber: 2 }],
						});
					}
					expect(JSON.stringify(event)).not.toContain(input.data.toString("base64"));
					expect(JSON.stringify(event)).not.toContain("private-file-bytes");
				}
				expect(
					events
						.map(
							(event) =>
								(event.inputData as { contextFiles: { index: number }[] }).contextFiles[0].index,
						)
						.toSorted(),
				).toEqual([1, 2]);
			} finally {
				await server.close();
			}
		},
	);
});
