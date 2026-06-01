import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { documentTemplate, eq, subscription } from "@repo/database";

import type { TestServer } from "@/__tests__/setup";
import {
	ADMIN_EMAIL,
	createMockSession,
	createTestContext,
	createTestSubscription,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import {
	buildParsedMarkdocFromFieldDefinitions,
	type DocumentFieldDefinition,
} from "@/app/documents/_lib";
import { documentsHandler } from "@/orpc/documents";

const pdfBytes = new Uint8Array([1, 2, 3, 4, 5, 250, 255]);
const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

const createFieldDefinitions = (): DocumentFieldDefinition[] => [
	{
		description: "Patientenname",
		fieldName: "patient_name",
		inputKind: "text",
		isEnabled: true,
		label: "Patient",
		markdocType: "Info",
		options: [],
		pdfType: "text",
		valueType: "string",
	},
	{
		description: "Entlassung",
		fieldName: "discharge_mode",
		inputKind: "choice",
		isEnabled: true,
		label: "Entlassung",
		markdocType: "Switch",
		options: ["ambulant", "stationaer"],
		pdfType: "dropdown",
		valueType: "string",
	},
];

describe("documents.templates handlers", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("documents-templates");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("create persists pdfBytes and fieldDefinitions", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const result = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		expect(result.id).toBeDefined();
		const [saved] = await server.db
			.select()
			.from(documentTemplate)
			.where(eq(documentTemplate.id, result.id));

		expect(saved).toBeDefined();
		expect(saved?.fieldDefinitions).toBeArray();
		expect(Array.from(saved?.pdfBytes ?? [])).toEqual(Array.from(pdfBytes));
		expect(saved?.visibility).toBe("public");
	});

	test("requires plus to create private documents", async () => {
		const { user } = await createTestUser(server.db, { email: "free@test.com" });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		await expect(
			call(
				documentsHandler.templates.create,
				{
					category: "Entlassung",
					fieldDefinitions: createFieldDefinitions(),
					pdfBase64,
					title: "Privates Formular",
					visibility: "private",
				},
				{ context },
			),
		).rejects.toThrow();
	});

	test("allows plus users to create private documents", async () => {
		const { user } = await createTestUser(server.db, { email: "plus@test.com" });
		await createTestSubscription(server.db, user.id);
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const result = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Privates Formular",
				visibility: "private",
			},
			{ context },
		);

		expect(result.visibility).toBe("private");
	});

	test("list and get exclude raw pdf bytes", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const authedContext = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Entlassformular",
			},
			{ context: authedContext },
		);

		const list = await call(documentsHandler.templates.list, undefined, {
			context: authedContext,
		});
		const foundInList = list.find((item) => item.id === created.id);
		expect(foundInList).toBeDefined();
		expect("pdfBytes" in (foundInList as Record<string, unknown>)).toBe(false);
		expect("email" in ((foundInList?.author ?? {}) as Record<string, unknown>)).toBe(false);

		const detail = await call(
			documentsHandler.templates.get,
			{ id: created.id },
			{ context: authedContext },
		);
		expect(detail).not.toBeNull();
		expect("pdfBytes" in (detail as Record<string, unknown>)).toBe(false);
		expect("email" in ((detail?.author ?? {}) as Record<string, unknown>)).toBe(false);
	});

	test("private documents are only visible to their author", async () => {
		const { user: author } = await createTestUser(server.db, {
			email: "document-author@test.com",
		});
		const { user: other } = await createTestUser(server.db, {
			email: "document-other@test.com",
		});
		await createTestSubscription(server.db, author.id);
		const authorContext = createTestContext({
			db: server.db,
			session: createMockSession(author),
		});
		const otherContext = createTestContext({
			db: server.db,
			session: createMockSession(other),
		});
		const anonymousContext = createTestContext({ db: server.db });

		const privateDocument = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Privates Formular",
				visibility: "private",
			},
			{ context: authorContext },
		);
		const publicDocument = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Öffentliches Formular",
			},
			{ context: authorContext },
		);

		expect(
			await call(
				documentsHandler.templates.get,
				{ id: privateDocument.id },
				{ context: anonymousContext },
			),
		).toBeNull();
		expect(
			await call(
				documentsHandler.templates.get,
				{ id: privateDocument.id },
				{ context: otherContext },
			),
		).toBeNull();
		expect(
			await call(
				documentsHandler.templates.getPdf,
				{ id: privateDocument.id },
				{ context: otherContext },
			),
		).toBeNull();
		expect(
			await call(
				documentsHandler.templates.get,
				{ id: privateDocument.id },
				{ context: authorContext },
			),
		).not.toBeNull();

		const anonymousList = await call(documentsHandler.templates.list, undefined, {
			context: anonymousContext,
		});
		expect(anonymousList.map((item) => item.id)).toEqual([publicDocument.id]);
	});

	test("getPdf returns decodable base64", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		const pdf = await call(documentsHandler.templates.getPdf, { id: created.id }, { context });
		expect(pdf).not.toBeNull();
		const decoded = new Uint8Array(Buffer.from(pdf?.pdfBase64 ?? "", "base64"));
		expect(Array.from(decoded)).toEqual(Array.from(pdfBytes));
	});

	test("getPdf returns distinct bytes per document", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const firstPdfBytes = new Uint8Array([11, 12, 13, 14]);
		const secondPdfBytes = new Uint8Array([21, 22, 23, 24, 25]);

		const first = await call(
			documentsHandler.templates.create,
			{
				category: "A",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64: Buffer.from(firstPdfBytes).toString("base64"),
				title: "Erstes Dokument",
			},
			{ context },
		);

		const second = await call(
			documentsHandler.templates.create,
			{
				category: "B",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64: Buffer.from(secondPdfBytes).toString("base64"),
				title: "Zweites Dokument",
			},
			{ context },
		);

		const firstPdf = await call(documentsHandler.templates.getPdf, { id: first.id }, { context });
		const secondPdf = await call(documentsHandler.templates.getPdf, { id: second.id }, { context });

		expect(firstPdf).not.toBeNull();
		expect(secondPdf).not.toBeNull();
		expect(firstPdf?.id).toBe(first.id);
		expect(secondPdf?.id).toBe(second.id);
		expect(Array.from(Buffer.from(firstPdf?.pdfBase64 ?? "", "base64"))).toEqual(
			Array.from(firstPdfBytes),
		);
		expect(Array.from(Buffer.from(secondPdf?.pdfBase64 ?? "", "base64"))).toEqual(
			Array.from(secondPdfBytes),
		);
	});

	test("update preserves pdf when no replacement is sent", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		const [beforeUpdate] = await server.db
			.select()
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		await call(
			documentsHandler.templates.update,
			{
				category: "Aufnahme",
				fieldDefinitions: createFieldDefinitions(),
				id: created.id,
				title: "Aufnahmeformular",
			},
			{ context },
		);

		const [afterUpdate] = await server.db
			.select()
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		expect(Array.from(afterUpdate?.pdfBytes ?? [])).toEqual(
			Array.from(beforeUpdate?.pdfBytes ?? []),
		);
	});

	test("update rejects non-authors", async () => {
		const { user: owner } = await createTestUser(server.db, {
			email: ADMIN_EMAIL,
		});
		const { user: other } = await createTestUser(server.db, {
			email: "other@test.com",
		});

		const ownerContext = createTestContext({
			db: server.db,
			session: createMockSession(owner),
		});

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Entlassformular",
			},
			{ context: ownerContext },
		);

		const otherContext = createTestContext({
			db: server.db,
			session: createMockSession(other),
		});

		await expect(
			call(
				documentsHandler.templates.update,
				{
					category: "Aufnahme",
					fieldDefinitions: createFieldDefinitions(),
					id: created.id,
					title: "Nicht erlaubt",
				},
				{ context: otherContext },
			),
		).rejects.toThrow();
	});

	test("requires plus to keep documents private on update", async () => {
		const { user } = await createTestUser(server.db, { email: "owner@test.com" });
		await createTestSubscription(server.db, user.id);
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createFieldDefinitions(),
				pdfBase64,
				title: "Privates Formular",
				visibility: "private",
			},
			{ context },
		);

		await server.db.delete(subscription);

		await expect(
			call(
				documentsHandler.templates.update,
				{
					category: "Aufnahme",
					fieldDefinitions: createFieldDefinitions(),
					id: created.id,
					title: "Weiter privat",
					visibility: "private",
				},
				{ context },
			),
		).rejects.toThrow();

		const publicResult = await call(
			documentsHandler.templates.update,
			{
				category: "Aufnahme",
				fieldDefinitions: createFieldDefinitions(),
				id: created.id,
				title: "Jetzt öffentlich",
				visibility: "public",
			},
			{ context },
		);

		expect(publicResult.visibility).toBe("public");
	});

	test("duplicate labels are allowed when configuration matches", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const duplicateLabelDefinitions: DocumentFieldDefinition[] = [
			{
				description: "gleich",
				fieldName: "field_a",
				inputKind: "text",
				isEnabled: true,
				label: "Duplikat",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
			{
				description: "gleich",
				fieldName: "field_b",
				inputKind: "text",
				isEnabled: true,
				label: "Duplikat",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
		];

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: duplicateLabelDefinitions,
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		const [saved] = await server.db
			.select({ fieldDefinitions: documentTemplate.fieldDefinitions })
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		const normalizedFieldDefinitions = Array.isArray(saved?.fieldDefinitions)
			? (saved.fieldDefinitions as DocumentFieldDefinition[])
			: [];
		const { inputTags } = buildParsedMarkdocFromFieldDefinitions(normalizedFieldDefinitions);
		expect(inputTags).toHaveLength(1);
		expect(inputTags[0]?.attributes.primary).toBe("Duplikat");
	});

	test("duplicate labels with conflicting configuration are rejected", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const duplicateLabelDefinitions: DocumentFieldDefinition[] = [
			{
				description: "eins",
				fieldName: "field_a",
				inputKind: "text",
				isEnabled: true,
				label: "Duplikat",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
			{
				description: "zwei",
				fieldName: "field_b",
				inputKind: "choice",
				isEnabled: true,
				label: "Duplikat",
				markdocType: "Switch",
				options: ["ja", "nein"],
				pdfType: "dropdown",
				valueType: "string",
			},
		];

		await expect(
			call(
				documentsHandler.templates.create,
				{
					category: "Entlassung",
					fieldDefinitions: duplicateLabelDefinitions,
					pdfBase64,
					title: "Entlassformular",
				},
				{ context },
			),
		).rejects.toThrow();
	});

	test("disabled fields are omitted from derived parsedMarkdoc", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const fieldDefinitions: DocumentFieldDefinition[] = [
			{
				description: "Aktiv",
				fieldName: "active",
				inputKind: "text",
				isEnabled: true,
				label: "Aktiv",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
			{
				description: "Inaktiv",
				fieldName: "inactive",
				inputKind: "text",
				isEnabled: false,
				label: "Inaktiv",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
		];

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions,
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		const [saved] = await server.db
			.select({ fieldDefinitions: documentTemplate.fieldDefinitions })
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		const normalizedFieldDefinitions = Array.isArray(saved?.fieldDefinitions)
			? (saved.fieldDefinitions as DocumentFieldDefinition[])
			: [];
		const { inputTags } = buildParsedMarkdocFromFieldDefinitions(normalizedFieldDefinitions);
		expect(inputTags).toHaveLength(1);
		expect(inputTags[0]?.attributes.primary).toBe("Aktiv");
	});
});
