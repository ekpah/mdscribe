import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { documentTemplate, eq, subscription } from "@repo/database";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import type { PDFCheckBox } from "pdf-lib";

import type { TestServer } from "@/__tests__/setup";
import {
	ADMIN_EMAIL,
	createMockSession,
	createTestContext,
	createTestSubscription,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { MAX_PDF_BASE64_LENGTH, normalizeDocumentDefinition } from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";
import { documentsHandler } from "@/orpc/documents";

const setCheckBoxWidgetOnValue = (checkbox: PDFCheckBox, widgetIndex: number, value: string) => {
	const widget = checkbox.acroField.getWidgets()[widgetIndex];
	const normalAppearance = widget?.getAppearances()?.normal;
	if (!(normalAppearance instanceof PDFDict)) {
		throw new Error("Expected checkbox widget normal appearance dictionary");
	}

	const yesName = PDFName.of("Yes");
	const nextName = PDFName.of(value);
	const yesAppearance = normalAppearance.get(yesName);
	if (!yesAppearance) {
		throw new Error("Expected checkbox widget Yes appearance");
	}

	normalAppearance.set(nextName, yesAppearance);
	normalAppearance.delete(yesName);
	widget.setAppearanceState(PDFName.of("Off"));
};

const createTestPdfBytes = async (title = "document-template-test"): Promise<Uint8Array> => {
	const pdf = await PDFDocument.create();
	pdf.setTitle(title);
	const page = pdf.addPage([500, 500]);
	const form = pdf.getForm();
	for (const [index, fieldName] of [
		"patient_name",
		"field_a",
		"field_b",
		"active",
		"inactive",
	].entries()) {
		form
			.createTextField(fieldName)
			.addToPage(page, { height: 16, width: 120, x: 20, y: 460 - index * 30 });
	}
	const dischargeMode = form.createDropdown("discharge_mode");
	dischargeMode.setOptions(["ambulant", "stationaer"]);
	dischargeMode.addToPage(page, { height: 16, width: 120, x: 180, y: 460 });
	for (const [index, fieldName] of ["check_a", "check_b"].entries()) {
		form
			.createCheckBox(fieldName)
			.addToPage(page, { height: 16, width: 16, x: 340, y: 460 - index * 30 });
	}
	const requestType = form.createCheckBox("request_type");
	for (const [index, option] of ["Reha", "LTA"].entries()) {
		requestType.addToPage(page, { height: 16, width: 16, x: 400, y: 460 - index * 30 });
		setCheckBoxWidgetOnValue(requestType, index, option);
	}
	return pdf.save();
};

const pdfBytes = await createTestPdfBytes();
const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

const createDocumentDefinition = (): DocumentDefinition => ({
	bindings: [
		{
			fieldName: "patient_name",
			inputId: "Patient",
			isEnabled: true,
		},
		{
			fieldName: "discharge_mode",
			inputId: "Entlassung",
			isEnabled: true,
			valueMap: { ambulant: "ambulant", stationaer: "stationaer" },
		},
	],
	inputs: [
		{
			attributes: {
				description: "Patientenname",
				primary: "Patient",
				type: "string",
			},
			children: [],
			name: "Info",
		},
		{
			attributes: { primary: "Entlassung" },
			children: [
				{ attributes: { primary: "ambulant" }, children: [], name: "Case" },
				{ attributes: { primary: "stationaer" }, children: [], name: "Case" },
			],
			name: "Switch",
		},
	],
});

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
				fieldDefinitions: createDocumentDefinition(),
				information: "Bitte Pflichtfelder zuerst ausfüllen.",
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
		expect(saved?.fieldDefinitions).toEqual(
			normalizeDocumentDefinition(createDocumentDefinition()),
		);
		expect(saved?.information).toBe("Bitte Pflichtfelder zuerst ausfüllen.");
		expect([...(saved?.pdfBytes ?? [])]).toEqual([...pdfBytes]);
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
					fieldDefinitions: createDocumentDefinition(),
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
				fieldDefinitions: createDocumentDefinition(),
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
				fieldDefinitions: createDocumentDefinition(),
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
				fieldDefinitions: createDocumentDefinition(),
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
				fieldDefinitions: createDocumentDefinition(),
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
				fieldDefinitions: createDocumentDefinition(),
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		const pdf = await call(documentsHandler.templates.getPdf, { id: created.id }, { context });
		expect(pdf).not.toBeNull();
		const decoded = new Uint8Array(Buffer.from(pdf?.pdfBase64 ?? "", "base64"));
		expect([...decoded]).toEqual([...pdfBytes]);
	});

	test("getPdf returns distinct bytes per document", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const firstPdfBytes = await createTestPdfBytes("first");
		const secondPdfBytes = await createTestPdfBytes("second");

		const first = await call(
			documentsHandler.templates.create,
			{
				category: "A",
				fieldDefinitions: createDocumentDefinition(),
				pdfBase64: Buffer.from(firstPdfBytes).toString("base64"),
				title: "Erstes Dokument",
			},
			{ context },
		);

		const second = await call(
			documentsHandler.templates.create,
			{
				category: "B",
				fieldDefinitions: createDocumentDefinition(),
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
		expect([...Buffer.from(firstPdf?.pdfBase64 ?? "", "base64")]).toEqual([...firstPdfBytes]);
		expect([...Buffer.from(secondPdf?.pdfBase64 ?? "", "base64")]).toEqual([...secondPdfBytes]);
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
				fieldDefinitions: createDocumentDefinition(),
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
				fieldDefinitions: createDocumentDefinition(),
				id: created.id,
				information: "Neue Ausfüllhinweise",
				title: "Aufnahmeformular",
			},
			{ context },
		);

		const [afterUpdate] = await server.db
			.select()
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		expect([...(afterUpdate?.pdfBytes ?? [])]).toEqual([...(beforeUpdate?.pdfBytes ?? [])]);
		expect(afterUpdate?.information).toBe("Neue Ausfüllhinweise");
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
				fieldDefinitions: createDocumentDefinition(),
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
					fieldDefinitions: createDocumentDefinition(),
					id: created.id,
					title: "Nicht erlaubt",
				},
				{ context: otherContext },
			),
		).rejects.toThrow();
	});

	test("delete removes an authored document and its stored PDF", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createDocumentDefinition(),
				pdfBase64,
				title: "Zu löschendes Formular",
			},
			{ context },
		);

		expect(await call(documentsHandler.templates.delete, { id: created.id }, { context })).toEqual({
			success: true,
		});
		expect(
			await server.db.query.documentTemplate.findFirst({
				where: eq(documentTemplate.id, created.id),
			}),
		).toBeUndefined();
	});

	test("delete rejects non-authors without removing the document", async () => {
		const { user: owner } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const { user: other } = await createTestUser(server.db, { email: "delete-other@test.com" });
		const ownerContext = createTestContext({
			db: server.db,
			session: createMockSession(owner),
		});
		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: createDocumentDefinition(),
				pdfBase64,
				title: "Geschütztes Formular",
			},
			{ context: ownerContext },
		);

		await expect(
			call(
				documentsHandler.templates.delete,
				{ id: created.id },
				{
					context: createTestContext({
						db: server.db,
						session: createMockSession(other),
					}),
				},
			),
		).rejects.toThrow("Dokument wurde nicht gefunden");
		expect(
			await server.db.query.documentTemplate.findFirst({
				where: eq(documentTemplate.id, created.id),
			}),
		).toBeDefined();
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
				fieldDefinitions: createDocumentDefinition(),
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
					fieldDefinitions: createDocumentDefinition(),
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
				fieldDefinitions: createDocumentDefinition(),
				id: created.id,
				title: "Jetzt öffentlich",
				visibility: "public",
			},
			{ context },
		);

		expect(publicResult.visibility).toBe("public");
	});

	test("multiple PDF fields can map to one input variable", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const sharedVariableDefinition: DocumentDefinition = {
			bindings: [
				{ fieldName: "field_a", inputId: "Duplikat", isEnabled: true },
				{ fieldName: "field_b", inputId: "Duplikat", isEnabled: true },
			],
			inputs: [
				{
					attributes: { description: "gleich", primary: "Duplikat", type: "string" },
					children: [],
					name: "Info",
				},
			],
		};

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: sharedVariableDefinition,
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		const [saved] = await server.db
			.select({ fieldDefinitions: documentTemplate.fieldDefinitions })
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		const { inputs } = normalizeDocumentDefinition(saved?.fieldDefinitions as DocumentDefinition);
		expect(inputs).toHaveLength(1);
		expect(inputs[0]?.attributes.primary).toBe("Duplikat");
	});

	test("accepts grouped and split PDF checkbox bindings from the editor", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const checkboxDefinition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "check_a",
					inputId: "Gruppe",
					isEnabled: true,
					valueMap: { A: "Yes", B: "" },
				},
				{
					fieldName: "check_b",
					inputId: "Gruppe",
					isEnabled: true,
					valueMap: { A: "", B: "Yes" },
				},
				{
					fieldName: "request_type",
					inputId: "Reha",
					isEnabled: true,
					valueMap: { false: "", true: "Reha" },
				},
				{
					fieldName: "request_type",
					inputId: "LTA",
					isEnabled: true,
					valueMap: { false: "", true: "LTA" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Gruppe" },
					children: ["A", "B"].map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
				...["Reha", "LTA"].map((primary) => ({
					attributes: { primary, type: "boolean" as const },
					children: [],
					name: "Switch" as const,
				})),
			],
		};

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: checkboxDefinition,
				pdfBase64,
				title: "Checkbox-Zuordnungen",
			},
			{ context },
		);
		const [saved] = await server.db
			.select({ fieldDefinitions: documentTemplate.fieldDefinitions })
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		expect(saved?.fieldDefinitions).toEqual(normalizeDocumentDefinition(checkboxDefinition));
	});

	test("enabled bindings must reference defined inputs", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const invalidDefinition: DocumentDefinition = {
			bindings: [{ fieldName: "field_a", inputId: "Fehlt", isEnabled: true }],
			inputs: [],
		};

		await expect(
			call(
				documentsHandler.templates.create,
				{
					category: "Entlassung",
					fieldDefinitions: invalidDefinition,
					pdfBase64,
					title: "Entlassformular",
				},
				{ context },
			),
		).rejects.toThrow();
	});

	test("enabled bindings must reference fields in the uploaded PDF", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const definition = createDocumentDefinition();
		const [firstBinding, ...remainingBindings] = definition.bindings;
		if (!firstBinding) {
			throw new Error("Expected a document binding fixture");
		}
		definition.bindings = [
			{ ...firstBinding, fieldName: "missing_pdf_field" },
			...remainingBindings,
		];

		await expect(
			call(
				documentsHandler.templates.create,
				{
					category: "Entlassung",
					fieldDefinitions: definition,
					pdfBase64,
					title: "Entlassformular",
				},
				{ context },
			),
		).rejects.toThrow('PDF-Feld "missing_pdf_field" wurde nicht gefunden');
	});

	test("rejects choice mappings that the PDF field cannot represent", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});
		const definition = createDocumentDefinition();
		const dischargeBinding = definition.bindings.find(
			(binding) => binding.fieldName === "discharge_mode",
		);
		if (!dischargeBinding) {
			throw new Error("Expected discharge mode binding fixture");
		}
		dischargeBinding.valueMap = { ambulant: "unknown", stationaer: "stationaer" };

		await expect(
			call(
				documentsHandler.templates.create,
				{
					category: "Entlassung",
					fieldDefinitions: definition,
					pdfBase64,
					title: "Ungültige Auswahlwerte",
				},
				{ context },
			),
		).rejects.toThrow('Eingabe "Entlassung" passt nicht zum PDF-Feld "discharge_mode"');
	});

	test("rejects enabled bindings to unsupported PDF fields", async () => {
		const pdf = await PDFDocument.create();
		pdf.addPage([300, 300]);
		pdf.getForm().createButton("submit_action");
		const unsupportedPdfBase64 = Buffer.from(await pdf.save()).toString("base64");
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		await expect(
			call(
				documentsHandler.templates.create,
				{
					category: "Entlassung",
					fieldDefinitions: {
						bindings: [
							{
								fieldName: "submit_action",
								inputId: "Aktion",
								isEnabled: true,
							},
						],
						inputs: [
							{
								attributes: { primary: "Aktion", type: "string" },
								children: [],
								name: "Info",
							},
						],
					},
					pdfBase64: unsupportedPdfBase64,
					title: "Nicht unterstütztes Feld",
				},
				{ context },
			),
		).rejects.toThrow('PDF-Feld "submit_action" wird nicht unterstützt');
	});

	test("rejects PDFs larger than the server-side upload limit", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		await expect(
			call(
				documentsHandler.templates.create,
				{
					category: "Entlassung",
					fieldDefinitions: createDocumentDefinition(),
					pdfBase64: "A".repeat(MAX_PDF_BASE64_LENGTH + 4),
					title: "Zu großes PDF",
				},
				{ context },
			),
		).rejects.toThrow();
	});

	test("persists disabled bindings with their defined inputs", async () => {
		const { user } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		const context = createTestContext({
			db: server.db,
			session: createMockSession(user),
		});

		const definition: DocumentDefinition = {
			bindings: [
				{ fieldName: "active", inputId: "Aktiv", isEnabled: true },
				{ fieldName: "inactive", inputId: "Inaktiv", isEnabled: false },
			],
			inputs: [
				{
					attributes: { description: "Aktiv", primary: "Aktiv", type: "string" },
					children: [],
					name: "Info",
				},
				{
					attributes: { primary: "Inaktiv", type: "string" },
					children: [],
					name: "Info",
				},
			],
		};

		const created = await call(
			documentsHandler.templates.create,
			{
				category: "Entlassung",
				fieldDefinitions: definition,
				pdfBase64,
				title: "Entlassformular",
			},
			{ context },
		);

		const [saved] = await server.db
			.select({ fieldDefinitions: documentTemplate.fieldDefinitions })
			.from(documentTemplate)
			.where(eq(documentTemplate.id, created.id));

		const normalized = normalizeDocumentDefinition(saved?.fieldDefinitions as DocumentDefinition);
		expect(normalized.inputs).toHaveLength(2);
		expect(normalized.bindings.find((binding) => binding.fieldName === "inactive")).toMatchObject({
			inputId: "Inaktiv",
			isEnabled: false,
		});
	});
});
