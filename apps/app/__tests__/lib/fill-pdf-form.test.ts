import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";

import { fillPDFForm } from "@/lib/documents";
import type { DocumentFieldDefinition } from "@/lib/documents";

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

const createFieldDefinitions = (): DocumentFieldDefinition[] => [
	{
		description: "",
		fieldName: "name",
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
		isEnabled: true,
		label: "Prioritaet",
		markdocType: "Switch",
		options: ["low", "high"],
		pdfType: "radio",
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
});
