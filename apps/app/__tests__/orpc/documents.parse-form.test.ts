import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { eq, usageEvent } from "@repo/database";
import { PDFDocument } from "pdf-lib";

import type { TestServer } from "@/__tests__/setup";
import { aiMockState } from "@/__tests__/preload";
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

describe("documents.enhanceDefinition", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("documents-enhance-definition");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("lets an authenticated non-admin improve the complete validated definition", async () => {
		const { session } = await createTestUser(server.db, { email: "document-author@test.com" });
		await createTestAiDefaults(server.db);
		const pdf = await PDFDocument.create();
		const page = pdf.addPage([300, 300]);
		pdf
			.getForm()
			.createTextField("patient_name")
			.addToPage(page, { height: 20, width: 180, x: 30, y: 240 });
		const pdfBytes = await pdf.save();

		const result = await call(
			documentsHandler.enhanceDefinition,
			{
				fieldDefinitions: {
					bindings: [
						{ fieldName: "patient_name", inputId: "patient_name", isEnabled: true },
					],
					inputs: [
						{
							attributes: { primary: "patient_name", type: "string" },
							children: [],
							name: "Info",
						},
					],
				},
				fileBase64: Buffer.from(pdfBytes).toString("base64"),
			},
			{ context: createTestContext({ db: server.db, session }) },
		);
		const generationOptions = aiMockState.lastGenerateObjectOptions as {
			messages?: { content?: { mediaType?: string; type?: string }[] }[];
			output?: string;
			schema?: unknown;
		};
		expect(generationOptions.output).toBe("no-schema");
		expect("schema" in generationOptions).toBe(false);
		expect(generationOptions.messages?.[1]?.content?.[0]).toMatchObject({
			mediaType: "application/pdf",
			type: "file",
		});

		expect(result.fieldDefinitions).toMatchObject({
			bindings: [{ fieldName: "patient_name", inputId: "Patient", isEnabled: true }],
			inputs: [
				{
					attributes: {
						description: "Vollständiger Name der Patientin oder des Patienten",
						primary: "Patient",
					},
					name: "Info",
				},
			],
		});
		const [logged] = await server.db
			.select()
			.from(usageEvent)
			.where(eq(usageEvent.name, "ai_pdf_document_enhancement"));
		expect(logged?.userId).toBe(session.user.id);
	});
});
