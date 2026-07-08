import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";

import type { TestServer } from "@/__tests__/setup";
import {
	ADMIN_EMAIL,
	createTestAiDefaults,
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { documentsHandler } from "@/orpc/documents";

const samplePdfPath = new URL("../documents/S0051.pdf", import.meta.url);

describe("documents.parseForm", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("documents-parse-form");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("parses the sample PDF form and returns field mappings", async () => {
		const { session } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		await createTestAiDefaults(server.db);

		const pdfBytes = await Bun.file(samplePdfPath).arrayBuffer();
		const result = (await call(
			documentsHandler.parseForm,
			{
				fieldMappings: [],
				fileBase64: Buffer.from(pdfBytes).toString("base64"),
			},
			{
				context: createTestContext({ db: server.db, session }),
			},
		)) as {
			fieldMapping: {
				description: string;
				fieldName: string;
				label: string;
			}[];
		};

		expect(result.fieldMapping).toBeArray();
		expect(result.fieldMapping.length).toBeGreaterThan(0);
		expect(result.fieldMapping[0]).toMatchObject({
			description: expect.any(String),
			fieldName: expect.any(String),
			label: expect.any(String),
		});
	});
});
