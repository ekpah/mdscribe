import { PDFDocument } from "pdf-lib";

import type { DocumentFieldDefinition, DocumentPdfType } from "./types";
import { isSwitchPdfType } from "./types";

export interface PDFField {
	label: string;
	name: string;
	options?: string[];
	type: DocumentPdfType;
	value?: string;
}

interface PDFFormField {
	getOptions?: () => string[];
	getSelected?: () => string | string[];
	getText?: () => string;
	isChecked?: () => boolean;
	isMultiline?: () => boolean;
}

interface PdfLibFormField {
	constructor: { name: string };
	getName: () => string;
	check?: () => void;
	select?: (value: string) => void;
	setText?: (value: string) => void;
	uncheck?: () => void;
}

const parseTextField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField => ({
	label: fieldName,
	name: fieldName,
	type: pdfFormField.isMultiline?.() ? "multiline" : "text",
	value: pdfFormField.getText?.() || "",
});

const parseCheckboxField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField => ({
	label: fieldName,
	name: fieldName,
	type: "checkbox",
	value: pdfFormField.isChecked?.() ? "true" : "false",
});

const parseSelectableField = (
	pdfFormField: PDFFormField,
	fieldName: string,
	type: "dropdown" | "radio",
): PDFField => {
	const options = pdfFormField.getOptions?.() ?? [];
	const selected = pdfFormField.getSelected?.();
	const selectedValue = Array.isArray(selected) ? selected[0] : selected;

	return {
		label: fieldName,
		name: fieldName,
		options,
		type,
		value: selectedValue || "",
	};
};

const pdfFieldParsers: Partial<
	Record<string, (pdfFormField: PDFFormField, fieldName: string) => PDFField>
> = {
	PDFCheckBox: parseCheckboxField,
	PDFDropdown: (field, name) => parseSelectableField(field, name, "dropdown"),
	PDFRadioGroup: (field, name) => parseSelectableField(field, name, "radio"),
	PDFTextField: parseTextField,
};

const parseSingleFormField = (field: PdfLibFormField): PDFField => {
	const fieldName = field.getName();
	const fieldType = field.constructor.name;
	const parser = pdfFieldParsers[fieldType];
	const pdfFormField = field as unknown as PDFFormField;

	return parser
		? parser(pdfFormField, fieldName)
		: { label: fieldName, name: fieldName, type: "text", value: "" };
};

const parseFormFieldsFromPDF = async (file: Uint8Array): Promise<PDFField[]> => {
	const stableBytes = new Uint8Array(file);
	const pdfDoc = await PDFDocument.load(stableBytes);
	const form = pdfDoc.getForm();

	return form.getFields().map((field) =>
		parseSingleFormField(field as unknown as PdfLibFormField),
	);
};

export const parsePDFFormFields = async (
	file: Uint8Array,
): Promise<{ fields: PDFField[] }> => {
	const fields = await parseFormFieldsFromPDF(file);
	return { fields };
};

const inferOptions = (field: PDFField): string[] => {
	if (field.type === "checkbox") {
		return ["true", "false"];
	}
	return field.options || [];
};

export const buildDefaultFieldDefinitionsFromPdfFields = (
	fields: PDFField[],
): DocumentFieldDefinition[] => {
	return fields.map((field) => ({
		description: "",
		fieldName: field.name,
		isEnabled: true,
		label: field.name,
		markdocType: isSwitchPdfType(field.type) ? "Switch" : "Info",
		options: inferOptions(field),
		pdfType: field.type,
		valueType: "string",
	}));
};
