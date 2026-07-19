import { describe, expect, test } from "bun:test";

import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import type { PDFCheckBox } from "pdf-lib";

import { DocumentFillError, fillPDFForm } from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";

const createFormPdf = async (): Promise<Uint8Array> => {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([600, 800]);
	const form = pdfDoc.getForm();

	const textField = form.createTextField("name");
	textField.addToPage(page, { height: 20, width: 200, x: 40, y: 740 });
	const textFieldCopy = form.createTextField("name_copy");
	textFieldCopy.addToPage(page, { height: 20, width: 200, x: 260, y: 740 });

	const multilineField = form.createTextField("notes");
	multilineField.enableMultiline();
	multilineField.addToPage(page, { height: 60, width: 300, x: 40, y: 660 });

	const dropdown = form.createDropdown("status");
	dropdown.setOptions(["open", "closed"]);
	dropdown.addToPage(page, { height: 20, width: 200, x: 40, y: 620 });

	const checkbox = form.createCheckBox("consent");
	checkbox.addToPage(page, { height: 16, width: 16, x: 40, y: 580 });

	const radio = form.createRadioGroup("priority");
	radio.addOptionToPage("low", page, { height: 16, width: 16, x: 40, y: 540 });
	radio.addOptionToPage("high", page, { height: 16, width: 16, x: 120, y: 540 });

	return pdfDoc.save();
};

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

const createChoiceCheckboxPdfWithOptions = async (options: string[]): Promise<Uint8Array> => {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([600, 800]);
	const form = pdfDoc.getForm();
	const checkbox = form.createCheckBox("request_type");

	for (const [index, option] of options.entries()) {
		checkbox.addToPage(page, {
			height: 16,
			width: 16,
			x: 40,
			y: 720 - index * 30,
		});
		setCheckBoxWidgetOnValue(checkbox, index, option);
	}
	form.createCheckBox("urgent").addToPage(page, { height: 16, width: 16, x: 120, y: 720 });

	return pdfDoc.save();
};

const createChoiceCheckboxPdf = (): Promise<Uint8Array> =>
	createChoiceCheckboxPdfWithOptions([
		"Reha",
		"Teilhabe am Arbeitsleben (LTA) ",
		"Sonstiges",
	]);

const createDocumentDefinition = (): DocumentDefinition => ({
	bindings: [
		{ fieldName: "name", inputId: "Name", isEnabled: true },
		{ fieldName: "name_copy", inputId: "Name", isEnabled: true },
		{ fieldName: "notes", inputId: "Notizen", isEnabled: true },
		{ fieldName: "status", inputId: "Status", isEnabled: true },
		{ fieldName: "consent", inputId: "Einwilligung", isEnabled: true },
		{ fieldName: "priority", inputId: "Prioritaet", isEnabled: true },
	],
	inputs: [
		{ attributes: { primary: "Name", type: "string" }, children: [], name: "Info" },
		{ attributes: { primary: "Notizen", type: "string" }, children: [], name: "Info" },
		{
			attributes: { primary: "Status" },
			children: [
				{ attributes: { primary: "open" }, children: [], name: "Case" },
				{ attributes: { primary: "closed" }, children: [], name: "Case" },
			],
			name: "Switch",
		},
		{
			attributes: { primary: "Einwilligung", type: "boolean" },
			children: [
				{ attributes: { primary: "true" }, children: [], name: "Case" },
				{ attributes: { primary: "false" }, children: [], name: "Case" },
			],
			name: "Switch",
		},
		{
			attributes: { primary: "Prioritaet" },
			children: [
				{ attributes: { primary: "low" }, children: [], name: "Case" },
				{ attributes: { primary: "high" }, children: [], name: "Case" },
			],
			name: "Switch",
		},
	],
});

const createChoiceCheckboxDefinition = (
	options = ["Reha", "Teilhabe am Arbeitsleben (LTA)", "Sonstiges"],
): DocumentDefinition => ({
	bindings: [
		{
			fieldName: "request_type",
			inputId: "Antrag",
			isEnabled: true,
			valueMap: Object.fromEntries(
				options.map((option, index) => [
					option,
					["Reha", "Teilhabe am Arbeitsleben (LTA) ", "Sonstiges"][index] ?? option,
				]),
			),
		},
	],
	inputs: [
		{
			attributes: { primary: "Antrag" },
			children: options.map((option) => ({
				attributes: { primary: option },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		},
	],
});

const createSplitChoiceCheckboxDefinition = (): DocumentDefinition => ({
	bindings: [
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
			valueMap: { false: "", true: "Teilhabe am Arbeitsleben (LTA) " },
		},
		{
			fieldName: "request_type",
			inputId: "Sonstiges",
			isEnabled: true,
			valueMap: { false: "", true: "Sonstiges" },
		},
	],
	inputs: ["Reha", "LTA", "Sonstiges"].map((primary) => ({
		attributes: { primary, type: "boolean" as const },
		children: [],
		name: "Switch" as const,
	})),
});

const createGroupedCheckboxPdf = async (): Promise<Uint8Array> => {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([600, 800]);
	const form = pdfDoc.getForm();
	for (const [index, name] of ["reha", "lta", "other"].entries()) {
		form
			.createCheckBox(name)
			.addToPage(page, { height: 16, width: 16, x: 40, y: 720 - index * 30 });
	}
	return pdfDoc.save();
};

const createGroupedCheckboxDefinition = (): DocumentDefinition => {
	const options = ["Reha", "LTA", "Sonstiges"];
	return {
		bindings: ["reha", "lta", "other"].map((fieldName, selectedIndex) => ({
			fieldName,
			inputId: "Antragstyp",
			isEnabled: true,
			valueMap: Object.fromEntries(
				options.map((option, optionIndex) => [option, String(optionIndex === selectedIndex)]),
			),
		})),
		inputs: [
			{
				attributes: { primary: "Antragstyp" },
				children: options.map((primary) => ({
					attributes: { primary },
					children: [],
					name: "Case" as const,
				})),
				name: "Switch",
			},
		],
	};
};

describe("fillPDFForm", () => {
	test("fills text, multiline, dropdown, checkbox and radio fields", async () => {
		const sourcePdf = await createFormPdf();
		const definition = createDocumentDefinition();

		const filledPdf = await fillPDFForm(
			sourcePdf,
			{
				Einwilligung: "true",
				Name: "Max Mustermann",
				Notizen: "Erste Zeile\nZweite Zeile",
				Prioritaet: "high",
				Status: "closed",
			},
			definition,
		);

		const pdfDoc = await PDFDocument.load(filledPdf);
		const form = pdfDoc.getForm();

		expect(form.getTextField("name").getText()).toBe("Max Mustermann");
		expect(form.getTextField("name_copy").getText()).toBe("Max Mustermann");
		expect(form.getTextField("notes").getText()).toBe("Erste Zeile\nZweite Zeile");
		expect(form.getDropdown("status").getSelected()[0]).toBe("closed");
		expect(form.getCheckBox("consent").isChecked()).toBe(true);
		expect(form.getRadioGroup("priority").getSelected()).toBe("high");
	});

	test("maps checkbox false value to unchecked", async () => {
		const sourcePdf = await createFormPdf();
		const filledPdf = await fillPDFForm(
			sourcePdf,
			{
				Einwilligung: "false",
			},
			createDocumentDefinition(),
		);

		const pdfDoc = await PDFDocument.load(filledPdf);
		const form = pdfDoc.getForm();
		expect(form.getCheckBox("consent").isChecked()).toBe(false);
	});

	test("fills every repeated checkbox widget that shares one export value", async () => {
		const pdfDoc = await PDFDocument.create();
		const firstPage = pdfDoc.addPage([300, 300]);
		const secondPage = pdfDoc.addPage([300, 300]);
		const checkbox = pdfDoc.getForm().createCheckBox("consent_repeated");
		checkbox.addToPage(firstPage, { height: 16, width: 16, x: 20, y: 250 });
		checkbox.addToPage(secondPage, { height: 16, width: 16, x: 20, y: 250 });
		const sourcePdf = await pdfDoc.save();
		const definition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "consent_repeated",
					inputId: "Einwilligung",
					isEnabled: true,
					valueMap: { false: "", true: "Yes" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Einwilligung", type: "boolean" },
					children: [],
					name: "Switch",
				},
			],
		};

		const filledPdf = await fillPDFForm(sourcePdf, { Einwilligung: true }, definition);
		const filledDocument = await PDFDocument.load(filledPdf);
		const filledCheckbox = filledDocument.getForm().getCheckBox("consent_repeated");

		expect(filledCheckbox.isChecked()).toBe(true);
		expect(
			filledCheckbox.acroField
				.getWidgets()
				.map((widget) => widget.getAppearanceState()?.decodeText()),
		).toEqual(["Yes", "Yes"]);
	});

	test("ignores disabled unsupported PDF fields", async () => {
		const pdfDoc = await PDFDocument.create();
		pdfDoc.addPage([300, 300]);
		pdfDoc.getForm().createButton("submit_action");
		const sourcePdf = await pdfDoc.save();

		const filledPdf = await fillPDFForm(
			sourcePdf,
			{},
			{
				bindings: [
					{
						fieldName: "submit_action",
						inputId: "submit_action",
						isEnabled: false,
					},
				],
				inputs: [
					{
						attributes: { primary: "submit_action", type: "string" },
						children: [],
						name: "Info",
					},
				],
			},
		);

		expect(filledPdf.byteLength).toBeGreaterThan(0);
	});

	test("accepts boolean checkbox values directly", async () => {
		const sourcePdf = await createFormPdf();
		const checkedPdf = await fillPDFForm(
			sourcePdf,
			{
				Einwilligung: true,
			},
			createDocumentDefinition(),
		);
		const uncheckedPdf = await fillPDFForm(
			sourcePdf,
			{
				Einwilligung: false,
			},
			createDocumentDefinition(),
		);

		const checkedDoc = await PDFDocument.load(checkedPdf);
		const uncheckedDoc = await PDFDocument.load(uncheckedPdf);
		expect(checkedDoc.getForm().getCheckBox("consent").isChecked()).toBe(true);
		expect(uncheckedDoc.getForm().getCheckBox("consent").isChecked()).toBe(false);
	});

	test("fills text-backed checkbox fields with the configured display value", async () => {
		const sourcePdf = await createFormPdf();
		const definition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "name",
					inputId: "Visuelle Checkbox",
					isEnabled: true,
					valueMap: { false: "", true: "X" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Visuelle Checkbox", type: "boolean" },
					children: [
						{ attributes: { primary: "true" }, children: [], name: "Case" },
						{ attributes: { primary: "false" }, children: [], name: "Case" },
					],
					name: "Switch",
				},
			],
		};

		const checkedPdf = await fillPDFForm(
			sourcePdf,
			{
				"Visuelle Checkbox": true,
			},
			definition,
		);
		const uncheckedPdf = await fillPDFForm(
			checkedPdf,
			{
				"Visuelle Checkbox": false,
			},
			definition,
		);

		const checkedDoc = await PDFDocument.load(checkedPdf);
		const uncheckedDoc = await PDFDocument.load(uncheckedPdf);
		expect(checkedDoc.getForm().getTextField("name").getText()).toBe("X");
		expect(uncheckedDoc.getForm().getTextField("name").getText() ?? "").toBe("");
	});

	test("fills text fields from a choice input", async () => {
		const sourcePdf = await createFormPdf();
		const definition: DocumentDefinition = {
			bindings: [{ fieldName: "name", inputId: "Anrede", isEnabled: true }],
			inputs: [
				{
					attributes: { primary: "Anrede" },
					children: ["Frau", "Herr", "Divers"].map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
			],
		};

		const filledPdf = await fillPDFForm(sourcePdf, { Anrede: "Frau" }, definition);
		const pdfDoc = await PDFDocument.load(filledPdf);
		expect(pdfDoc.getForm().getTextField("name").getText()).toBe("Frau");
	});

	test("fills grouped visual checkboxes backed by separate PDF text fields", async () => {
		const sourcePdf = await createFormPdf();
		const options = ["Erste", "Zweite"];
		const definition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "name",
					inputId: "Auswahl",
					isEnabled: true,
					valueMap: { Erste: "x", Zweite: "" },
				},
				{
					fieldName: "name_copy",
					inputId: "Auswahl",
					isEnabled: true,
					valueMap: { Erste: "", Zweite: "x" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Auswahl" },
					children: options.map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
			],
		};

		const filledPdf = await fillPDFForm(sourcePdf, { Auswahl: "Zweite" }, definition);
		const pdfDoc = await PDFDocument.load(filledPdf);
		const form = pdfDoc.getForm();
		expect(form.getTextField("name").getText() ?? "").toBe("");
		expect(form.getTextField("name_copy").getText()).toBe("x");
	});

	test("fills checkbox choice fields by selected widget option", async () => {
		const sourcePdf = await createChoiceCheckboxPdf();
		const filledPdf = await fillPDFForm(
			sourcePdf,
			{
				Antrag: "Teilhabe am Arbeitsleben (LTA)",
			},
			createChoiceCheckboxDefinition(),
		);

		const pdfDoc = await PDFDocument.load(filledPdf);
		const checkbox = pdfDoc.getForm().getCheckBox("request_type");
		expect(checkbox.acroField.getValue().decodeText()).toBe("Teilhabe am Arbeitsleben (LTA) ");
		expect(
			checkbox.acroField.getWidgets().map((widget) => widget.getAppearanceState()?.decodeText()),
		).toEqual(["Off", "Teilhabe am Arbeitsleben (LTA) ", "Off"]);
	});

	test("fills checkbox choice fields when visible option labels were edited", async () => {
		const sourcePdf = await createChoiceCheckboxPdf();
		const filledPdf = await fillPDFForm(
			sourcePdf,
			{
				Antrag: "LTA sichtbar umbenannt",
			},
			createChoiceCheckboxDefinition([
				"Medizinische Reha",
				"LTA sichtbar umbenannt",
				"Andere Leistung",
			]),
		);

		const pdfDoc = await PDFDocument.load(filledPdf);
		const checkbox = pdfDoc.getForm().getCheckBox("request_type");
		expect(checkbox.acroField.getValue().decodeText()).toBe("Teilhabe am Arbeitsleben (LTA) ");
		expect(
			checkbox.acroField.getWidgets().map((widget) => widget.getAppearanceState()?.decodeText()),
		).toEqual(["Off", "Teilhabe am Arbeitsleben (LTA) ", "Off"]);
	});

	test("changing checkbox choice selection clears the previous widget state", async () => {
		const sourcePdf = await createChoiceCheckboxPdf();
		const firstFilledPdf = await fillPDFForm(
			sourcePdf,
			{
				Antrag: "Reha",
			},
			createChoiceCheckboxDefinition(),
		);
		const secondFilledPdf = await fillPDFForm(
			firstFilledPdf,
			{
				Antrag: "Sonstiges",
			},
			createChoiceCheckboxDefinition(),
		);

		const pdfDoc = await PDFDocument.load(secondFilledPdf);
		const checkbox = pdfDoc.getForm().getCheckBox("request_type");
		expect(checkbox.acroField.getValue().decodeText()).toBe("Sonstiges");
		expect(
			checkbox.acroField.getWidgets().map((widget) => widget.getAppearanceState()?.decodeText()),
		).toEqual(["Off", "Off", "Sonstiges"]);
	});

	test("uses one choice for multi-widget options and a separate PDF checkbox", async () => {
		const definition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "request_type",
					inputId: "Antrag",
					isEnabled: true,
					valueMap: {
						Dringend: "",
						LTA: "Teilhabe am Arbeitsleben (LTA) ",
						Reha: "Reha",
					},
				},
				{
					fieldName: "urgent",
					inputId: "Antrag",
					isEnabled: true,
					valueMap: { Dringend: "true", LTA: "false", Reha: "false" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Antrag" },
					children: ["Reha", "LTA", "Dringend"].map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
			],
		};

		const filledPdf = await fillPDFForm(
			await createChoiceCheckboxPdf(),
			{ Antrag: "Dringend" },
			definition,
		);
		const pdfDoc = await PDFDocument.load(filledPdf);
		const form = pdfDoc.getForm();
		expect(form.getCheckBox("request_type").isChecked()).toBe(false);
		expect(form.getCheckBox("urgent").isChecked()).toBe(true);
	});

	test("fills a multi-widget PDF checkbox from split boolean inputs", async () => {
		const sourcePdf = await createChoiceCheckboxPdf();
		const filledPdf = await fillPDFForm(
			sourcePdf,
			{ LTA: true, Reha: false, Sonstiges: false },
			createSplitChoiceCheckboxDefinition(),
		);

		const pdfDoc = await PDFDocument.load(filledPdf);
		const checkbox = pdfDoc.getForm().getCheckBox("request_type");
		expect(
			checkbox.acroField.getWidgets().map((widget) => widget.getAppearanceState()?.decodeText()),
		).toEqual(["Off", "Teilhabe am Arbeitsleben (LTA) ", "Off"]);
	});

	test("fills a split option whose multi-widget PDF export value is true", async () => {
		const definition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "request_type",
					inputId: "Antragstyp",
					isEnabled: true,
					valueMap: { Andere: "Andere" },
				},
				{
					fieldName: "request_type",
					inputId: "Zustimmung",
					isEnabled: true,
					valueMap: { false: "", true: "true" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Antragstyp" },
					children: [{ attributes: { primary: "Andere" }, children: [], name: "Case" }],
					name: "Switch",
				},
				{
					attributes: { primary: "Zustimmung", type: "boolean" },
					children: [],
					name: "Switch",
				},
			],
		};

		const filledPdf = await fillPDFForm(
			await createChoiceCheckboxPdfWithOptions(["true", "Andere"]),
			{ Zustimmung: true },
			definition,
		);
		const pdfDoc = await PDFDocument.load(filledPdf);
		const checkbox = pdfDoc.getForm().getCheckBox("request_type");

		expect(checkbox.acroField.getValue().decodeText()).toBe("true");
		expect(
			checkbox.acroField.getWidgets().map((widget) => widget.getAppearanceState()?.decodeText()),
		).toEqual(["true", "Off"]);
	});

	test("rejects conflicting split boolean selections for one PDF checkbox", async () => {
		await expect(
			fillPDFForm(
				await createChoiceCheckboxPdf(),
				{ LTA: true, Reha: true, Sonstiges: false },
				createSplitChoiceCheckboxDefinition(),
			),
		).rejects.toThrow(DocumentFillError);
	});

	test("rejects repeated bindings for a simple PDF checkbox", async () => {
		const definition = createDocumentDefinition();
		definition.bindings.push({
			fieldName: "consent",
			inputId: "Zweite Einwilligung",
			isEnabled: true,
		});
		definition.inputs.push({
			attributes: { primary: "Zweite Einwilligung", type: "boolean" },
			children: [],
			name: "Switch",
		});

		await expect(
			fillPDFForm(
				await createFormPdf(),
				{ Einwilligung: false, "Zweite Einwilligung": false },
				definition,
			),
		).rejects.toThrow(DocumentFillError);
	});

	test("fills multiple PDF checkboxes from one shared choice input", async () => {
		const filledPdf = await fillPDFForm(
			await createGroupedCheckboxPdf(),
			{ Antragstyp: "LTA" },
			createGroupedCheckboxDefinition(),
		);
		const pdfDoc = await PDFDocument.load(filledPdf);
		const form = pdfDoc.getForm();
		expect(form.getCheckBox("reha").isChecked()).toBe(false);
		expect(form.getCheckBox("lta").isChecked()).toBe(true);
		expect(form.getCheckBox("other").isChecked()).toBe(false);
	});
});
