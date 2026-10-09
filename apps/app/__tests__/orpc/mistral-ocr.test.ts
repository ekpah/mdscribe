import { expect, test } from "bun:test";

import { call } from "@orpc/server";
import { aiModel, eq, usageEvent } from "@repo/database";

import { ADMIN_EMAIL, createTestContext, createTestUser, startTestServer } from "@/__tests__/setup";
import { providersHandler } from "@/orpc/admin/providers";
import { extractContextFiles } from "@/orpc/scribe/handlers/context-file-input";
import { extractOcrDocument } from "@/orpc/scribe/ocr";
import { createMistralOcrAdapter } from "@/orpc/scribe/ocr/adapters/mistral";
import { resolveOcrSelection } from "@/orpc/scribe/providers";

test("native Mistral provider validates credentials, stays document-only, and preserves document content and geometry", async () => {
	const dbServer = await startTestServer("mistral-ocr");
	const requests: { path: string; body?: Record<string, unknown>; authorization: string | null }[] =
		[];
	const page = {
		blocks: [
			{
				bottom_right_x: 600,
				bottom_right_y: 300,
				content: "[x] Yes  [ ] No",
				top_left_x: 100,
				top_left_y: 50,
				type: "text",
			},
		],
		dimensions: { dpi: 200, height: 2200, width: 1700 },
		index: 0,
		markdown: "[x] Yes  [ ] No\n\n| Value | Result |\n|---|---|\n| RA | 19 |",
	};
	let response: unknown = {
		pages: [page, { ...page, blocks: [], index: 1, markdown: "Second page" }],
		usage_info: { pages_processed: 2 },
	};
	let status = 200;
	let malformedJson = false;
	const server = Bun.serve({
		async fetch(request) {
			const path = new URL(request.url).pathname;
			requests.push({
				authorization: request.headers.get("authorization"),
				body: request.method === "POST" ? await request.json() : undefined,
				path,
			});
			if (malformedJson) {
				return new Response("PRIVATE DOCUMENT CONTENT", {
					headers: { "Content-Type": "application/json" },
				});
			}
			return Response.json(
				path === "/v1/models"
					? { data: [{ id: "mistral-ocr-4-0" }, { id: "mistral-small" }] }
					: response,
				{ status },
			);
		},
		hostname: "127.0.0.1",
		port: 0,
	});
	try {
		const { session, user } = await createTestUser(dbServer.db, { email: ADMIN_EMAIL });
		const context = createTestContext({ db: dbServer.db, session });
		await expect(
			call(
				providersHandler.connections.create,
				{ baseUrl: server.url.toString(), name: "Mistral", protocol: "mistral-ocr" },
				{ context },
			),
		).rejects.toThrow("API-Key");
		const created = await call(
			providersHandler.connections.create,
			{
				apiKey: "synthetic-key",
				baseUrl: server.url.toString(),
				name: "Mistral",
				protocol: "mistral-ocr",
			},
			{ context },
		);
		expect(created.modelCount).toBe(1);
		expect(JSON.stringify(created)).not.toContain("synthetic-key");
		const [model] = await dbServer.db
			.select()
			.from(aiModel)
			.where(eq(aiModel.providerId, created.id));
		await expect(
			call(providersHandler.defaults.set, { defaultType: "text", modelId: model.id }, { context }),
		).rejects.toThrow("Dokumenten-Modell");
		await call(
			providersHandler.defaults.set,
			{ defaultType: "file-image", modelId: model.id },
			{ context },
		);
		const selection = await resolveOcrSelection(dbServer.db, user.id);
		expect(selection.model.providerProtocol).toBe("mistral-ocr");
		const input = {
			data: Buffer.from("%PDF-synthetic"),
			mimeType: "application/pdf",
			modelSelection: selection,
			userId: user.id,
		};
		const result = await extractOcrDocument(input);
		expect(requests.at(-1)).toMatchObject({
			authorization: "Bearer synthetic-key",
			body: {
				document: {
					document_url: `data:application/pdf;base64,${input.data.toString("base64")}`,
					type: "document_url",
				},
				include_blocks: true,
				model: "mistral-ocr-4-0",
				table_format: "html",
			},
			path: "/v1/ocr",
		});
		expect(result.text).toBe(`${page.markdown}\n\f\nSecond page`);
		expect(result.usage).toEqual({ pages: 2 });
		expect(result.pages?.[0]).toEqual({
			blocks: [
				{ bbox: { height: 90, width: 180, x: 36, y: 18 }, text: "[x] Yes  [ ] No", type: "text" },
			],
			height: 792,
			pageNumber: 1,
			width: 612,
		});
		for (const zdr of [false, true]) {
			await extractContextFiles({
				contextFiles: [
					{
						data: input.data.toString("base64"),
						mimeType: "application/pdf",
						name: "synthetic.pdf",
						size: input.data.length,
					},
				],
				db: dbServer.db,
				modelSelection: selection,
				userId: user.id,
				zdr,
			});
		}
		const events = await dbServer.db.select().from(usageEvent);
		expect(events).toHaveLength(2);
		const visible = events.find((event) => event.result === result.text);
		const redacted = events.find((event) => event.result === "[zdr - content redacted]");
		expect(visible?.model).toBe("mistral-ocr-4-0");
		expect(visible?.metadata).toMatchObject({
			billingUnit: "page",
			ocrBackend: "mistral-ocr",
			pagesProcessed: 2,
		});
		expect(visible?.metadata).toHaveProperty("ocr.pages");
		expect(redacted?.result).toBe("[zdr - content redacted]");
		expect(redacted?.metadata).not.toHaveProperty("ocr");
		response = {
			pages: [{ ...page, blocks: [{ ...page.blocks[0], bottom_right_x: 1701 }] }],
			usage_info: { pages_processed: 1 },
		};
		const image = await extractOcrDocument({ ...input, mimeType: "image/jpeg" });
		expect(requests.at(-1)?.body?.document).toEqual({
			image_url: `data:image/jpeg;base64,${input.data.toString("base64")}`,
			type: "image_url",
		});
		expect(image.text).toBe(page.markdown);
		expect(image.pages?.[0].blocks).toEqual([]);
		response = { pages: [page], usage_info: { pages_processed: 2 } };
		await expect(extractOcrDocument(input)).rejects.toThrow("Incomplete");
		status = 429;
		response = { error: "PRIVATE DOCUMENT CONTENT" };
		const callsBeforeLimit = requests.length;
		await expect(extractOcrDocument(input)).rejects.toThrow("Anbieterlimits abgelehnt (HTTP 429)");
		expect(requests).toHaveLength(callsBeforeLimit + 1);
		status = 500;
		await expect(extractOcrDocument(input)).rejects.toThrow("Mistral OCR failed: HTTP 500");
		malformedJson = true;
		await expect(extractOcrDocument(input)).rejects.toThrow(/^Invalid Mistral OCR response$/);
	} finally {
		server.stop(true);
		await dbServer.close();
	}
});

test("native Mistral HTML tables are resolved per page verbatim, never from boxes", async () => {
	const html =
		'<table><tr><td rowspan="2">$& tbl-1.html</td><td></td><td colspan="4">0,5 l<br>[x]</td></tr></table>';
	const second = "<table><tr><td>Second page</td></tr></table>";
	const page = {
		blocks: [
			{
				bottom_right_x: 10,
				bottom_right_y: 10,
				content: "BOX CONTENT MUST NOT BECOME TEXT",
				top_left_x: 0,
				top_left_y: 0,
				type: "table",
			},
		],
		dimensions: { dpi: 200, height: 2200, width: 1700 },
		index: 0,
		markdown: "Before\n\ntbl-0.html\n\nAfter !img-0.jpeg",
		tables: [{ content: html, format: "html", id: "tbl-0.html" }],
	};
	let response: unknown = {
		pages: [
			page,
			{
				...page,
				index: 1,
				markdown: "[tbl-0.html](tbl-0.html)",
				tables: [{ content: second, format: "html", id: "tbl-0.html" }],
			},
		],
		usage_info: { pages_processed: 2 },
	};
	const server = Bun.serve({
		async fetch(request) {
			const body = await request.json();
			expect(body.table_format).toBe("html");
			return Response.json(response);
		},
		hostname: "127.0.0.1",
		port: 0,
	});
	try {
		const adapter = createMistralOcrAdapter({
			apiKey: "synthetic-key",
			credentialSource: "operator",
			endpoint: server.url.toString(),
			modelName: "mistral-ocr-4-0",
			providerId: "test",
			providerProtocol: "mistral-ocr",
		});
		if (adapter.kind !== "document") {
			throw new Error("Expected document adapter");
		}
		const recognize = () => adapter.recognizeDocument(Buffer.from("synthetic"), "application/pdf");
		const resolved = await recognize();
		expect(resolved.text).toBe(`Before\n\n${html}\n\nAfter !img-0.jpeg\n\f\n${second}`);
		response = { pages: [{ ...page, markdown: "No marker" }], usage_info: { pages_processed: 1 } };
		const unreferenced = await recognize();
		expect(unreferenced.text).toBe(`No marker\n\n${html}`);
		for (const tables of [null, [], undefined]) {
			response = {
				pages: [{ ...page, markdown: second, tables }],
				usage_info: { pages_processed: 1 },
			};
			const inline = await recognize();
			expect(inline.text).toBe(second);
		}
		for (const tables of [
			[],
			[...page.tables, ...page.tables],
			[{ ...page.tables[0], content: 42 }],
			[{ ...page.tables[0], format: "markdown" }],
		]) {
			response = { pages: [{ ...page, tables }], usage_info: { pages_processed: 1 } };
			await expect(recognize()).rejects.toThrow(/^(Invalid|Incomplete) Mistral OCR response$/);
		}
	} finally {
		server.stop(true);
	}
});
