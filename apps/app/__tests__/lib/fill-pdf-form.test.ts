import { describe, expect, test } from "bun:test";

import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import type { PDFCheckBox } from "pdf-lib";

import { fillPDFForm } from "@/app/documents/_lib";
import type { DocumentFieldDefinition } from "@/app/documents/_lib";

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

const createFieldDefinitions = (): DocumentFieldDefinition[] => [
	{
		description: "",
		fieldName: "name",
		inputKind: "text",
		isEnabled: true,
		label: "Name",
		markdocType: "Info",
		options: [],
		pdfType: "text",
		valueType: "string",
	},
	{
		description: "",
		fieldName: "name_copy",
		inputKind: "text",
		isEnabled: true,
		label: "Name",
		markdocType: "Info",
		options: [],
		pdfType: "text",
		valueType: "string",
	},
	{
		description: "",
		fieldName: "notes",
		inputKind: "text",
		isEnabled: true,
		label: "Notizen",
		markdocType: "Info",
		options: [],
		pdfType: "multiline",
		valueType: "string",
	},
	{
		description: "",
		fieldName: "status",
		inputKind: "choice",
		isEnabled: true,
		label: "Status",
		markdocType: "Switch",
		options: ["open", "closed"],
		pdfType: "dropdown",
		valueType: "string",
	},
	{
		description: "",
		fieldName: "consent",
		inputKind: "boolean",
		isEnabled: true,
		label: "Einwilligung",
		markdocType: "Switch",
		options: ["true", "false"],
		pdfType: "checkbox",
		valueType: "string",
	},
	{
		description: "",
		fieldName: "priority",
		inputKind: "choice",
		isEnabled: true,
		label: "Prioritaet",
		markdocType: "Switch",
		options: ["low", "high"],
		pdfType: "radio",
		valueType: "string",
	},
];

const createChoiceCheckboxFieldDefinition = (): DocumentFieldDefinition[] => [
	{
		description: "",
		fieldName: "request_type",
		inputKind: "choice",
		isEnabled: true,
		label: "Antrag",
		markdocType: "Switch",
		options: ["Reha", "Teilhabe am Arbeitsleben (LTA)", "Sonstiges"],
		pdfType: "checkbox",
		valueType: "string",
	},
];

describe("fillPDFForm", () => {
	test("fills text, multiline, dropdown, checkbox and radio fields", async () => {
		const sourcePdf = await createFormPdf();
		const fieldDefinitions = createFieldDefinitions();

		const filledPdf = await fillPDFForm(
			sourcePdf,
			{
				Einwilligung: "true",
				Name: "Max Mustermann",
				Notizen: "Erste Zeile\nZweite Zeile",
				Prioritaet: "high",
				Status: "closed",
			},
			fieldDefinitions,
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
			createFieldDefinitions(),
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
			createFieldDefinitions(),
		);
		const uncheckedPdf = await fillPDFForm(
			sourcePdf,
			{
				Einwilligung: false,
			},
			createFieldDefinitions(),
		);

		const checkedDoc = await PDFDocument.load(checkedPdf);
		const uncheckedDoc = await PDFDocument.load(uncheckedPdf);
		expect(checkedDoc.getForm().getCheckBox("consent").isChecked()).toBe(true);
		expect(uncheckedDoc.getForm().getCheckBox("consent").isChecked()).toBe(false);
	});

	test("fills checkbox choice fields by selected widget option", async () => {
		const sourcePdf = await createChoiceCheckboxPdf();
		const filledPdf = await fillPDFForm(
			sourcePdf,
			{
				Antrag: "Teilhabe am Arbeitsleben (LTA)",
			},
			createChoiceCheckboxFieldDefinition(),
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
		const [definition] = createChoiceCheckboxFieldDefinition();
		if (!definition) {
			throw new Error("Expected choice checkbox definition");
		}

		const filledPdf = await fillPDFForm(
			sourcePdf,
			{
				Antrag: "LTA sichtbar umbenannt",
			},
			[
				{
					...definition,
					options: ["Medizinische Reha", "LTA sichtbar umbenannt", "Andere Leistung"],
				},
			],
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
			createChoiceCheckboxFieldDefinition(),
		);
		const secondFilledPdf = await fillPDFForm(
			firstFilledPdf,
			{
				Antrag: "Sonstiges",
			},
			createChoiceCheckboxFieldDefinition(),
		);

		const pdfDoc = await PDFDocument.load(secondFilledPdf);
		const checkbox = pdfDoc.getForm().getCheckBox("request_type");
		expect(checkbox.acroField.getValue().decodeText()).toBe("Sonstiges");
		expect(
			checkbox.acroField.getWidgets().map((widget) => widget.getAppearanceState()?.decodeText()),
		).toEqual(["Off", "Off", "Sonstiges"]);
	});
});
