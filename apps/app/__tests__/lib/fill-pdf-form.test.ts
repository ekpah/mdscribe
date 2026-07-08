import { describe, expect, test } from "bun:test";

import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import type { PDFCheckBox } from "pdf-lib";

import { fillPDFForm } from "@/app/documents/_lib";
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

const createChoiceCheckboxPdf = async (): Promise<Uint8Array> => {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([600, 800]);
	const form = pdfDoc.getForm();
	const checkbox = form.createCheckBox("request_type");
	const options = ["Reha", "Teilhabe am Arbeitsleben (LTA) ", "Sonstiges"];

	for (const [index, option] of options.entries()) {
		checkbox.addToPage(page, {
			height: 16,
			width: 16,
			x: 40,
			y: 720 - index * 30,
		});
		setCheckBoxWidgetOnValue(checkbox, index, option);
	}

	return pdfDoc.save();
};

const createDocumentDefinition = (): DocumentDefinition => ({
	fieldMappings: [
		{ fieldName: "name", isEnabled: true, pdfType: "text", variable: "Name" },
		{ fieldName: "name_copy", isEnabled: true, pdfType: "text", variable: "Name" },
		{ fieldName: "notes", isEnabled: true, pdfType: "multiline", variable: "Notizen" },
		{ fieldName: "status", isEnabled: true, pdfType: "dropdown", variable: "Status" },
		{ fieldName: "consent", isEnabled: true, pdfType: "checkbox", variable: "Einwilligung" },
		{ fieldName: "priority", isEnabled: true, pdfType: "radio", variable: "Prioritaet" },
	],
	inputTags: [
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
	version: 2,
});

const createChoiceCheckboxDefinition = (
	options = ["Reha", "Teilhabe am Arbeitsleben (LTA)", "Sonstiges"],
): DocumentDefinition => ({
	fieldMappings: [
		{ fieldName: "request_type", isEnabled: true, pdfType: "checkbox", variable: "Antrag" },
	],
	inputTags: [
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
	version: 2,
});

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
			fieldMappings: [
				{
					condition: "true",
					fieldName: "name",
					isEnabled: true,
					pdfType: "text",
					value: "X",
					variable: "Visuelle Checkbox",
				},
			],
			inputTags: [
				{
					attributes: { primary: "Visuelle Checkbox", type: "boolean" },
					children: [
						{ attributes: { primary: "true" }, children: [], name: "Case" },
						{ attributes: { primary: "false" }, children: [], name: "Case" },
					],
					name: "Switch",
				},
			],
			version: 2,
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
});
