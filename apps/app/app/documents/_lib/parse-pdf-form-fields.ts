import { PDFDocument } from "pdf-lib";

import type { DocumentFieldDefinition, DocumentInputKind, DocumentPdfType } from "./types";

export interface PDFField {
	inputKind: DocumentInputKind;
	label: string;
	maxLength?: number;
	name: string;
	options?: string[];
	type: DocumentPdfType;
	value?: string;
}

interface PDFFormField {
	getMaxLength?: () => number | undefined;
	getOptions?: () => string[];
	getSelected?: () => string | string[];
	getText?: () => string;
	isChecked?: () => boolean;
	isMultiline?: () => boolean;
}

interface PdfLibFormField {
	acroField?: PdfLibAcroField;
	constructor: { name: string };
	getName: () => string;
	check?: () => void;
	select?: (value: string) => void;
	setText?: (value: string) => void;
	uncheck?: () => void;
}

interface PdfLibAcroField {
	getValue?: () => PdfLibName | undefined;
	getWidgets?: () => PdfLibWidget[];
}

interface PdfLibName {
	decodeText: () => string;
}

interface PdfLibWidget {
	getOnValue?: () => PdfLibName | undefined;
}

const parseTextField = (pdfFormField: PDFFormField, fieldName: string): PDFField => ({
	inputKind: "text",
	label: fieldName,
	maxLength: pdfFormField.getMaxLength?.(),
	name: fieldName,
	type: pdfFormField.isMultiline?.() ? "multiline" : "text",
	value: pdfFormField.getText?.() || "",
});

const getCheckboxWidgetOptions = (field: PdfLibFormField): string[] => {
	const widgets = field.acroField?.getWidgets?.() ?? [];
	const options: string[] = [];
	const seen = new Set<string>();

	for (const widget of widgets) {
		const option = widget.getOnValue?.()?.decodeText().trim();
		if (!option || option === "Off" || seen.has(option)) {
			continue;
		}
		seen.add(option);
		options.push(option);
	}

	return options;
};

const parseCheckboxField = (
	pdfFormField: PDFFormField,
	pdfLibFormField: PdfLibFormField,
	fieldName: string,
): PDFField => {
	const widgetOptions = getCheckboxWidgetOptions(pdfLibFormField);
	if (widgetOptions.length > 1) {
		return {
			inputKind: "choice",
			label: fieldName,
			name: fieldName,
			options: widgetOptions,
			type: "checkbox",
			value: pdfLibFormField.acroField?.getValue?.()?.decodeText() ?? "",
		};
	}

	return {
		inputKind: "boolean",
		label: fieldName,
		name: fieldName,
		options: ["true", "false"],
		type: "checkbox",
		value: pdfFormField.isChecked?.() ? "true" : "false",
	};
};

const parseSelectableField = (
	pdfFormField: PDFFormField,
	fieldName: string,
	type: "dropdown" | "radio",
): PDFField => {
	const options = pdfFormField.getOptions?.() ?? [];
	const selected = pdfFormField.getSelected?.();
	const selectedValue = Array.isArray(selected) ? selected[0] : selected;

	return {
		inputKind: "choice",
		label: fieldName,
		name: fieldName,
		options,
		type,
		value: selectedValue || "",
	};
};

const pdfFieldParsers: Partial<
	Record<
		string,
		(pdfFormField: PDFFormField, pdfLibFormField: PdfLibFormField, fieldName: string) => PDFField
	>
> = {
	PDFCheckBox: parseCheckboxField,
	PDFDropdown: (field, _pdfLibField, name) => parseSelectableField(field, name, "dropdown"),
	PDFRadioGroup: (field, _pdfLibField, name) => parseSelectableField(field, name, "radio"),
	PDFTextField: (field, _pdfLibField, name) => parseTextField(field, name),
};

const parseSingleFormField = (field: PdfLibFormField): PDFField => {
	const fieldName = field.getName();
	const fieldType = field.constructor.name;
	const parser = pdfFieldParsers[fieldType];
	const pdfFormField = field as unknown as PDFFormField;

	return parser
		? parser(pdfFormField, field, fieldName)
		: { inputKind: "text", label: fieldName, name: fieldName, type: "text", value: "" };
};

const parseFormFieldsFromPDF = async (file: Uint8Array): Promise<PDFField[]> => {
	const stableBytes = new Uint8Array(file);
	const pdfDoc = await PDFDocument.load(stableBytes);
	const form = pdfDoc.getForm();

	return form.getFields().map((field) => parseSingleFormField(field as unknown as PdfLibFormField));
};

export const parsePDFFormFields = async (file: Uint8Array): Promise<{ fields: PDFField[] }> => {
	const fields = await parseFormFieldsFromPDF(file);
	return { fields };
};

const inferOptions = (field: PDFField): string[] => {
	if (field.inputKind === "boolean") {
		return ["true", "false"];
	}
	return field.options || [];
};

export const buildDefaultFieldDefinitionsFromPdfFields = (
	fields: PDFField[],
): DocumentFieldDefinition[] =>
	fields.map((field) => ({
		description: "",
		fieldName: field.name,
		inputKind: field.inputKind,
		isEnabled: true,
		label: field.name,
		markdocType: field.inputKind === "text" ? "Info" : "Switch",
		maxLength: field.maxLength,
		options: inferOptions(field),
		pdfType: field.type,
		valueType: "string",
	}));
