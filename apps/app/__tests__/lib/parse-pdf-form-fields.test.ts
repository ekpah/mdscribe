import { describe, expect, test } from "bun:test";

import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import type { PDFCheckBox } from "pdf-lib";

import {
	buildDefaultDocumentDefinitionFromPdfFields,
	parsePDFFormFields,
} from "@/app/documents/_lib";

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

const createMixedFormPdf = async (): Promise<Uint8Array> => {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([600, 800]);
	const form = pdfDoc.getForm();

	const name = form.createTextField("name");
	name.addToPage(page, { height: 20, width: 200, x: 40, y: 740 });

	const notes = form.createTextField("notes");
	notes.enableMultiline();
	notes.addToPage(page, { height: 60, width: 300, x: 40, y: 660 });

	const status = form.createDropdown("status");
	status.setOptions(["open", "closed"]);
	status.addToPage(page, { height: 20, width: 200, x: 40, y: 620 });

	const consent = form.createCheckBox("consent");
	consent.addToPage(page, { height: 16, width: 16, x: 40, y: 580 });

	const requestType = form.createCheckBox("request_type");
	const requestOptions = ["Reha", "Teilhabe am Arbeitsleben (LTA) ", "Sonstiges"];
	for (const [index, option] of requestOptions.entries()) {
		requestType.addToPage(page, {
			height: 16,
			width: 16,
			x: 40,
			y: 540 - index * 30,
		});
		setCheckBoxWidgetOnValue(requestType, index, option);
	}

	const priority = form.createRadioGroup("priority");
	priority.addOptionToPage("low", page, { height: 16, width: 16, x: 40, y: 420 });
	priority.addOptionToPage("high", page, { height: 16, width: 16, x: 120, y: 420 });

	return pdfDoc.save();
};

describe("parsePDFFormFields", () => {
	test("classifies text, dropdown, radio and boolean checkbox fields", async () => {
		const { fields } = await parsePDFFormFields(await createMixedFormPdf());

		expect(fields.find((field) => field.name === "name")).toMatchObject({
			inputKind: "text",
			type: "text",
		});
		expect(fields.find((field) => field.name === "notes")).toMatchObject({
			inputKind: "text",
			type: "multiline",
		});
		expect(fields.find((field) => field.name === "status")).toMatchObject({
			inputKind: "choice",
			options: ["open", "closed"],
			type: "dropdown",
		});
		expect(fields.find((field) => field.name === "consent")).toMatchObject({
			inputKind: "boolean",
			options: ["true", "false"],
			type: "checkbox",
		});
		expect(fields.find((field) => field.name === "priority")).toMatchObject({
			inputKind: "choice",
			options: ["low", "high"],
			type: "radio",
		});
	});

	test("classifies multi-widget checkbox fields as choices with decoded widget options", async () => {
		const { fields } = await parsePDFFormFields(await createMixedFormPdf());

		expect(fields.find((field) => field.name === "request_type")).toMatchObject({
			inputKind: "choice",
			options: ["Reha", "Teilhabe am Arbeitsleben (LTA)", "Sonstiges"],
			type: "checkbox",
		});
	});

	test("builds default v2 document definitions from parsed input kinds", async () => {
		const { fields } = await parsePDFFormFields(await createMixedFormPdf());
		const definition = buildDefaultDocumentDefinitionFromPdfFields(fields);

		expect(definition.fieldMappings.find((field) => field.fieldName === "consent")).toMatchObject({
			pdfType: "checkbox",
			variable: "consent",
		});
		expect(definition.inputTags.find((tag) => tag.attributes.primary === "consent")).toMatchObject({
			attributes: { primary: "consent", type: "boolean" },
			children: [
				{ attributes: { primary: "true" }, children: [], name: "Case" },
				{ attributes: { primary: "false" }, children: [], name: "Case" },
			],
			name: "Switch",
		});
		expect(
			definition.inputTags.find((tag) => tag.attributes.primary === "request_type"),
		).toMatchObject({
			children: [
				{ attributes: { primary: "Reha" }, children: [], name: "Case" },
				{
					attributes: { primary: "Teilhabe am Arbeitsleben (LTA)" },
					children: [],
					name: "Case",
				},
				{ attributes: { primary: "Sonstiges" }, children: [], name: "Case" },
			],
			name: "Switch",
		});
	});
});
