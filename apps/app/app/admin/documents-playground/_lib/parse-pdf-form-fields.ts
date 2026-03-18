import type {
	InfoInputTagType,
	InputTagType,
	SwitchInputTagType,
} from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { PDFDocument } from "pdf-lib";

export interface PDFField {
	name: string;
	label: string;
	type: "text" | "multiline" | "dropdown" | "checkbox" | "radio";
	value?: string;
	options?: string[];
	// [x1, y1, x2, y2]
	rect?: [number, number, number, number];
}

export interface FieldMapping {
	fieldName: string;
	label: string;
	description: string;
}

interface ParsePDFResult {
	fields: PDFField[];
}

// Type for PDF form field with unknown methods
interface PDFFormField {
	getAlternateName?: () => string;
	getTooltip?: () => string;
	getPartialName?: () => string;
	isMultiline?: () => boolean;
	getText?: () => string;
	getOptions?: () => string[];
	getSelected?: () => string | string[];
	isChecked?: () => boolean;
}

interface PdfLibFormField {
	getName: () => string;
	constructor: { name: string };
}

/**
 * Parses a text field from PDF form
 */
const parseTextField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField => {
	const isMultiline = pdfFormField.isMultiline?.() ?? false;
	return {
		label: fieldName,
		name: fieldName,
		type: isMultiline ? "multiline" : "text",
		value: pdfFormField.getText?.() || "",
	};
};

/**
 * Parses a dropdown field from PDF form
 */
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

/**
 * Parses a checkbox field from PDF form
 */
const parseCheckboxField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField => ({
		label: fieldName,
		name: fieldName,
		type: "checkbox",
		value: pdfFormField.isChecked?.() ? "true" : "false",
	});

/**
 * Parses a radio group field from PDF form
 */
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
	const pdfFormField = field as unknown as PDFFormField;
	const parser = pdfFieldParsers[fieldType];
	return parser
		? parser(pdfFormField, fieldName)
		: createFallbackTextField(fieldName);
};

/**
 * Parses a PDF file and extracts all fillable form fields
 * Similar to parseMarkdocToInputs but for PDF forms
 */
const parseFormFieldsFromPDF = async (
	file: Uint8Array,
): Promise<PDFField[]> => {
	// Always parse from a copied buffer to avoid mutating/detaching shared upload state.
	const stableBytes = new Uint8Array(file);
	const pdfDoc = await PDFDocument.load(stableBytes);
	const form = pdfDoc.getForm();

	return form.getFields().map((field) =>
		parseSingleFormField(field as unknown as PdfLibFormField),
	);
};

/**
 * Parses a PDF file and extracts all fillable form fields
 * and returns them in a format similar to parseMarkdocToInputs
 */
export const parsePDFFormFields = async (
	file: Uint8Array,
): Promise<ParsePDFResult> => {
	const fields = await parseFormFieldsFromPDF(file);
	return { fields };
};

const createCaseTag = (primary: string): InputTagType => ({
	$$mdtype: "Tag",
	attributes: {
		primary,
	},
	children: [],
	name: "Case" as const,
});

const createSwitchTag = (
	primary: string,
	options: string[],
): SwitchInputTagType => ({
	$$mdtype: "Tag",
	attributes: {
		primary,
	},
	children: options.map((option) => createCaseTag(option)),
	name: "Switch" as const,
});

const createInfoTag = (
	primary: string,
	description: string,
): InfoInputTagType => ({
	$$mdtype: "Tag",
	attributes: {
		description,
		primary,
		type: "string",
	},
	children: [],
	name: "Info" as const,
});

const toPrimaryLabel = (field: PDFField, mapping?: FieldMapping): string =>
	mapping?.label ? mapping.label.trim() : field.name;

const toSwitchOptions = (field: PDFField): string[] => {
	if (field.type === "checkbox") {
		return ["true", "false"];
	}

	return field.options || [];
};

const toInputTagFromPdfField = (
	field: PDFField,
	mapping?: FieldMapping,
): InputTagType => {
	const primary = toPrimaryLabel(field, mapping);
	if (field.type === "checkbox" || field.type === "dropdown" || field.type === "radio") {
		return createSwitchTag(primary, toSwitchOptions(field));
	}

	return createInfoTag(primary, mapping?.description || "");
};

/**
 * Converts PDF fields to InputTagType format, similar to how switch tags are parsed.
 * Dropdown and radio fields are converted to Switch tags with Case children,
 * similar to how switch tags work in parseMarkdocToInputs.
 * Checkbox fields are converted to Switch tags with Case children for "true" and "false".
 */
export const convertPDFFieldsToInputTags = (
	fields: PDFField[],
	fieldMapping: FieldMapping[],
): {
	inputTags: InputTagType[];
} => {
	const fieldMappingByName = new Map<string, FieldMapping>(
		fieldMapping.map((mapping) => [mapping.fieldName, mapping]),
	);
	const inputTags = fields.map((field) =>
		toInputTagFromPdfField(field, fieldMappingByName.get(field.name)),
	);
	return { inputTags };
};
