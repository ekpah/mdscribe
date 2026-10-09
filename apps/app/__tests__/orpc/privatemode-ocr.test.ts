import { expect, mock, test } from "bun:test";

import { call } from "@orpc/server";
import { aiModel, eq } from "@repo/database";

import { ADMIN_EMAIL, createTestContext, createTestUser, startTestServer } from "@/__tests__/setup";

test("loading OCR handlers does not eagerly load the real Privatemode SDK", async () => {
	// Escape the suite's SDK mock: its Go bridge marks actual module evaluation.
	const child = Bun.spawn(
		[
			process.execPath,
			"--eval",
			`
		import assert from "node:assert/strict";
		assert.equal(globalThis.Go, undefined);
		const { createPrivatemodeOcrClient, parseDeepseekOcr } = await import("./orpc/scribe/ocr/adapters/privatemode");
		assert.equal(typeof parseDeepseekOcr, "function");
		assert.equal(globalThis.Go, undefined);
		await assert.rejects(createPrivatemodeOcrClient(undefined, "https://api.privatemode.ai"), /API key is required/);
		assert.equal(globalThis.Go, undefined);
		const client = await createPrivatemodeOcrClient("synthetic-key", "https://api.privatemode.ai");
		assert.equal(typeof globalThis.Go, "function");
		client.close();
		console.log("Lazy Privatemode SDK boundary: OK");
		`,
		],
		{ cwd: `${import.meta.dir}/../..`, stderr: "pipe", stdout: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
	expect(stdout).toContain("Lazy Privatemode SDK boundary: OK");
}, 30_000);

let closed = 0;
let fail = false;
let options: unknown;
let request: unknown;
const raw =
	'<|ref|>table<|/ref|><|det|>[[111,222,999,666],[0,666,333,999]]<|/det|><table><tr><td colspan="4">1–2 Hübe</td></tr></table>';
mock.module("privatemode-ai", () => ({
	PrivatemodeAI: class {
		constructor(config: unknown) {
			options = config;
		}
		models = { list: () => Promise.resolve({ data: [{ id: "deepseek-ocr-2" }, { id: "other" }] }) };
		chat = {
			completions: {
				create: (body: unknown) => {
					request = body;
					if (fail) {
						throw new Error("private document and key");
					}
					return Promise.resolve({
						choices: [{ finish_reason: "stop", message: { content: raw } }],
					});
				},
			},
		};
		close = mock(() => {
			closed += 1;
		});
	},
}));
const { parseDeepseekOcr } = await import("@/orpc/scribe/ocr/adapters/privatemode");
const { providersHandler } = await import("@/orpc/admin/providers");
const { resolveOcrSelection } = await import("@/orpc/scribe/providers");
const { extractOcrDocument } = await import("@/orpc/scribe/ocr");

test("DeepSeek preserves native HTML and associates every XYXY/999 region with its text", () => {
	const page = { height: 1800, markdown: "", pageNum: 3, text: "", textItems: [], width: 900 };
	const result = parseDeepseekOcr(raw, page);
	expect(result.text).toBe('<table><tr><td colspan="4">1–2 Hübe</td></tr></table>');
	expect(result.page?.blocks).toEqual([
		{ bbox: { height: 800, width: 800, x: 100, y: 400 }, text: result.text, type: "table" },
		{ bbox: { height: 600, width: 300, x: 0, y: 1200 }, text: result.text, type: "table" },
	]);
	const separate = parseDeepseekOcr(
		`${raw}\n<|ref|>text<|/ref|><|det|>[[0,0,999,111]]<|/det|>Note`,
		page,
	);
	expect(separate.page?.blocks.map((block) => block.text)).toEqual([
		result.text,
		result.text,
		"Note",
	]);
	for (const invalid of ["[[0,0,1000,999]]", "[[99,0,1,999]]", '__import__("os")']) {
		const output = parseDeepseekOcr(`<|ref|>text<|/ref|><|det|>${invalid}<|/det|>keep`, page);
		expect(output).toEqual({ text: "keep" });
	}
});

test("Privatemode settings resolve into the encrypted SDK OCR path and fail closed", async () => {
	const app = await startTestServer("privatemode-ocr");
	try {
		const { session } = await createTestUser(app.db, { email: ADMIN_EMAIL });
		const context = createTestContext({ db: app.db, session });
		const provider = await call(
			providersHandler.connections.create,
			{
				apiKey: "private-key",
				name: "Private OCR",
				protocol: "privatemode-ocr",
			},
			{ context },
		);
		const model = await app.db.query.aiModel.findFirst({
			where: eq(aiModel.providerId, provider.id),
		});
		expect(model?.modelId).toBe("deepseek-ocr-2");
		if (!model) {
			throw new Error("Expected synced OCR model");
		}
		await expect(
			call(providersHandler.defaults.set, { defaultType: "text", modelId: model.id }, { context }),
		).rejects.toThrow("nur als Dokumenten-Modell");
		await call(
			providersHandler.defaults.set,
			{ defaultType: "file-image", modelId: model.id },
			{ context },
		);
		const selection = await resolveOcrSelection(app.db);
		const result = await extractOcrDocument({
			data: Buffer.from("mock-pdf"),
			mimeType: "application/pdf",
			modelSelection: selection,
			userId: session.user.id,
		});
		expect(result.text).toContain('colspan="4"');
		expect(result.pages?.[0].blocks).toHaveLength(2);
		expect(options).toMatchObject({
			apiBaseURL: "https://api.privatemode.ai",
			apiKey: "private-key",
			enableWasmLogging: false,
			openAIOptions: { maxRetries: 0 },
		});
		expect(request).toMatchObject({
			messages: [
				{
					content: [
						{ type: "image_url" },
						{ text: "<|grounding|>Convert the document to markdown.", type: "text" },
					],
					role: "user",
				},
			],
			model: "deepseek-ocr-2",
		});
		expect(request).not.toHaveProperty("response_format");
		expect(request).not.toHaveProperty("temperature");
		const count = closed;
		fail = true;
		await expect(
			extractOcrDocument({
				data: Buffer.from("mock-pdf"),
				mimeType: "application/pdf",
				modelSelection: selection,
				userId: session.user.id,
			}),
		).rejects.toThrow("Die Privatemode-OCR-Anfrage ist fehlgeschlagen.");
		expect(closed).toBe(count + 1);
	} finally {
		fail = false;
		await app.close();
	}
});
