import { PDFDocument } from "pdf-lib";

import type { DocumentFieldDefinition, DocumentPdfType } from "@/lib/documents/types";

export interface PDFField {
	label: string;
	name: string;
	options?: string[];
	type: DocumentPdfType;
	value?: string;
}

interface ParsePDFResult {
	fields: PDFField[];
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

const parseDropdownField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField => {
	const options = pdfFormField.getOptions?.() || [];
	const selected = pdfFormField.getSelected?.();
	const selectedValue = Array.isArray(selected) ? selected[0] : selected;

	return {
		label: fieldName,
		name: fieldName,
		options,
		type: "dropdown",
		value: selectedValue || "",
	};
};

const parseCheckboxField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField => ({
	label: fieldName,
	name: fieldName,
	type: "checkbox",
	value: pdfFormField.isChecked?.() ? "true" : "false",
});

const parseRadioGroupField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField => {
	const options = pdfFormField.getOptions?.() || [];
	const selected = pdfFormField.getSelected?.();
	const selectedValue = Array.isArray(selected) ? selected[0] : selected;

	return {
		label: fieldName,
		name: fieldName,
		options,
		type: "radio",
		value: selectedValue || "",
	};
};

const createFallbackTextField = (fieldName: string): PDFField => ({
	label: fieldName,
	name: fieldName,
	type: "text",
	value: "",
});

const pdfFieldParsers: Partial<
	Record<string, (pdfFormField: PDFFormField, fieldName: string) => PDFField>
> = {
	PDFCheckBox: parseCheckboxField,
	PDFDropdown: parseDropdownField,
	PDFRadioGroup: parseRadioGroupField,
	PDFTextField: parseTextField,
};

const parseSingleFormField = (field: PdfLibFormField): PDFField => {
	const fieldName = field.getName();
	const fieldType = field.constructor.name;
	const parser = pdfFieldParsers[fieldType];
	const pdfFormField = field as unknown as PDFFormField;

	return parser
		? parser(pdfFormField, fieldName)
		: createFallbackTextField(fieldName);
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
): Promise<ParsePDFResult> => {
	const fields = await parseFormFieldsFromPDF(file);
	return { fields };
};

const inferMarkdocType = (
	pdfType: DocumentPdfType,
): DocumentFieldDefinition["markdocType"] => {
	if (pdfType === "checkbox" || pdfType === "dropdown" || pdfType === "radio") {
		return "Switch";
	}
	return "Info";
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
		markdocType: inferMarkdocType(field.type),
		options: inferOptions(field),
		pdfType: field.type,
		valueType: "string",
	}));
};
