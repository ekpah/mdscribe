import { describe, expect, test } from "bun:test";

import { PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFTextField } from "pdf-lib";

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
	name.setMaxLength(42);
	name.setText("Ada Lovelace");
	name.enableReadOnly();
	name.enableRequired();
	name.disableExporting();
	name.addToPage(page, { height: 20, width: 200, x: 40, y: 740 });

	const notes = form.createTextField("notes");
	notes.enableMultiline();
	notes.addToPage(page, { height: 60, width: 300, x: 40, y: 660 });

	const status = form.createDropdown("status");
	status.setOptions(["open", "closed"]);
	status.select("closed");
	status.addToPage(page, { height: 20, width: 200, x: 40, y: 620 });

	const roles = form.createOptionList("roles");
	roles.setOptions(["author", "reviewer", "signer"]);
	roles.enableMultiselect();
	roles.select(["author", "reviewer"]);
	roles.addToPage(page, { height: 50, width: 200, x: 340, y: 620 });

	const consent = form.createCheckBox("consent");
	consent.addToPage(page, { height: 16, width: 16, x: 40, y: 580 });
	consent.check();

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
	priority.select("high");

	form.createButton("submit_action");

	return pdfDoc.save();
};

describe("parsePDFFormFields", () => {
	test("classifies fields when minification changes pdf-lib constructor names", async () => {
		const pdfDoc = await PDFDocument.create();
		const page = pdfDoc.addPage([300, 300]);
		const form = pdfDoc.getForm();
		form.createTextField("name").addToPage(page);
		form.createCheckBox("consent").addToPage(page);
		const sourcePdf = await pdfDoc.save();

		const textFieldName = Object.getOwnPropertyDescriptor(PDFTextField, "name");
		const checkBoxName = Object.getOwnPropertyDescriptor(PDFCheckBox, "name");
		Object.defineProperty(PDFTextField, "name", { configurable: true, value: "a" });
		Object.defineProperty(PDFCheckBox, "name", { configurable: true, value: "b" });

		try {
			const { fields } = await parsePDFFormFields(sourcePdf);

			expect(fields.find((field) => field.name === "name")).toMatchObject({
				fieldType: "PDFTextField",
				type: "text",
			});
			expect(fields.find((field) => field.name === "consent")).toMatchObject({
				fieldType: "PDFCheckBox",
				type: "checkbox",
			});
		} finally {
			if (textFieldName) {
				Object.defineProperty(PDFTextField, "name", textFieldName);
			}
			if (checkBoxName) {
				Object.defineProperty(PDFCheckBox, "name", checkBoxName);
			}
		}
	});

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
		expect(fields.find((field) => field.name === "roles")).toMatchObject({
			fieldType: "PDFOptionList",
			inputKind: "text",
			type: "unsupported",
		});
		expect(fields.find((field) => field.name === "submit_action")).toMatchObject({
			fieldType: "PDFButton",
			inputKind: "text",
			type: "unsupported",
		});
	});

	test("preserves values and common pdf-lib field metadata", async () => {
		const { fields } = await parsePDFFormFields(await createMixedFormPdf());

		expect(fields.find((field) => field.name === "name")).toMatchObject({
			fieldType: "PDFTextField",
			isExported: false,
			isReadOnly: true,
			isRequired: true,
			maxLength: 42,
			value: "Ada Lovelace",
			widgetCount: 1,
		});
		expect(fields.find((field) => field.name === "status")?.value).toBe("closed");
		expect(fields.find((field) => field.name === "consent")?.value).toBe("true");
		expect(fields.find((field) => field.name === "priority")?.value).toBe("high");
	});

	test("classifies multi-widget checkbox fields as choices with decoded widget options", async () => {
		const { fields } = await parsePDFFormFields(await createMixedFormPdf());

		expect(fields.find((field) => field.name === "request_type")).toMatchObject({
			inputKind: "choice",
			optionMappings: [
				{ inputValue: "Reha", pdfValue: "Reha" },
				{
					inputValue: "Teilhabe am Arbeitsleben (LTA)",
					pdfValue: "Teilhabe am Arbeitsleben (LTA) ",
				},
				{ inputValue: "Sonstiges", pdfValue: "Sonstiges" },
			],
			options: ["Reha", "Teilhabe am Arbeitsleben (LTA)", "Sonstiges"],
			type: "checkbox",
		});
	});

	test("builds default inputs and bindings from parsed PDF fields", async () => {
		const { fields } = await parsePDFFormFields(await createMixedFormPdf());
		const definition = buildDefaultDocumentDefinitionFromPdfFields(fields);

		expect(definition.bindings.find((binding) => binding.fieldName === "consent")).toMatchObject({
			inputId: "consent",
			isEnabled: true,
			valueMap: { false: "", true: "Yes" },
		});
		expect(definition.bindings.find((binding) => binding.fieldName === "roles")).toMatchObject({
			isEnabled: false,
		});
		expect(
			definition.bindings.find((binding) => binding.fieldName === "submit_action"),
		).toMatchObject({ isEnabled: false });
		expect(definition.bindings.find((binding) => binding.fieldName === "name")).toMatchObject({
			inputId: "name",
			isEnabled: false,
		});
		expect(definition.inputs.find((input) => input.attributes.primary === "consent")).toMatchObject(
			{
				attributes: { primary: "consent", type: "boolean" },
				children: [
					{ attributes: { primary: "true" }, children: [], name: "Case" },
					{ attributes: { primary: "false" }, children: [], name: "Case" },
				],
				name: "Switch",
			},
		);
		expect(
			definition.inputs.find((input) => input.attributes.primary === "request_type"),
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
		expect(
			definition.bindings.find((binding) => binding.fieldName === "request_type")?.valueMap,
		).toEqual({
			Reha: "Reha",
			Sonstiges: "Sonstiges",
			"Teilhabe am Arbeitsleben (LTA)": "Teilhabe am Arbeitsleben (LTA) ",
		});
	});

	test("keeps repeated checkbox widgets with one export value as one boolean", async () => {
		const pdfDoc = await PDFDocument.create();
		const firstPage = pdfDoc.addPage([300, 300]);
		const secondPage = pdfDoc.addPage([300, 300]);
		const checkbox = pdfDoc.getForm().createCheckBox("consent_repeated");
		checkbox.addToPage(firstPage, { height: 16, width: 16, x: 20, y: 250 });
		checkbox.addToPage(secondPage, { height: 16, width: 16, x: 20, y: 250 });

		const { fields } = await parsePDFFormFields(await pdfDoc.save());

		expect(fields[0]).toMatchObject({
			inputKind: "boolean",
			optionMappings: [{ inputValue: "Yes", pdfValue: "Yes" }],
			type: "checkbox",
			widgetCount: 2,
		});
	});
});
