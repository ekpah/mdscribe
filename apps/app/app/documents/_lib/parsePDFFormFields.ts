import type {
	InfoInputTagType,
	InputTagType,
	SwitchInputTagType,
} from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import { PDFDocument } from "pdf-lib";

export interface PDFField {
	name: string;
	label: string;
	type: "text" | "multiline" | "dropdown" | "checkbox" | "radio";
	value?: string;
	options?: string[];
	rect?: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface FieldMapping {
	fieldName: string;
	label: string;
	description: string;
}

export interface ParsePDFResult {
	fields: PDFField[];
}

// Type for PDF form field with unknown methods
type PDFFormField = {
	getAlternateName?: () => string;
	getTooltip?: () => string;
	getPartialName?: () => string;
	isMultiline?: () => boolean;
	getText?: () => string;
	getOptions?: () => string[];
	getSelected?: () => string | string[];
	isChecked?: () => boolean;
};

/**
 * Parses a PDF file and extracts all fillable form fields
 * and returns them in a format similar to parseMarkdocToInputs
 */
export async function parsePDFFormFields(
	file: Uint8Array,
): Promise<ParsePDFResult> {
	const fields = await parseFormFieldsFromPDF(file);
	return { fields };
}

/**
 * Parses a text field from PDF form
 */
function parseTextField(
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField {
	const isMultiline = pdfFormField.isMultiline?.() ?? false;
	return {
		name: fieldName,
		label: fieldName,
		type: isMultiline ? "multiline" : "text",
		value: pdfFormField.getText?.() || "",
	};
}

/**
 * Parses a dropdown field from PDF form
 */
function parseDropdownField(
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField {
	const options = pdfFormField.getOptions?.() || [];
	const selected = pdfFormField.getSelected?.();
	const selectedValue = Array.isArray(selected) ? selected[0] : selected;
	return {
		name: fieldName,
		label: fieldName,
		type: "dropdown",
		options,
		value: selectedValue || "",
	};
}

/**
 * Parses a checkbox field from PDF form
 */
function parseCheckboxField(
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField {
	return {
		name: fieldName,
		label: fieldName,
		type: "checkbox",
		value: pdfFormField.isChecked?.() ? "true" : "false",
	};
}

/**
 * Parses a radio group field from PDF form
 */
function parseRadioGroupField(
	pdfFormField: PDFFormField,
	fieldName: string,
): PDFField {
	const options = pdfFormField.getOptions?.() || [];
	const selected = pdfFormField.getSelected?.();
	const selectedValue = Array.isArray(selected) ? selected[0] : selected;
	return {
		name: fieldName,
		label: fieldName,
		type: "radio",
		options,
		value: selectedValue || "",
	};
}

/**
 * Parses a PDF file and extracts all fillable form fields
 * Similar to parseMarkdocToInputs but for PDF forms
 */
export async function parseFormFieldsFromPDF(
	file: Uint8Array,
): Promise<PDFField[]> {
	const pdfDoc = await PDFDocument.load(file);
	const form = pdfDoc.getForm();
	const fields: PDFField[] = [];

	const formFields = form.getFields();

	for (const field of formFields) {
		const fieldName = field.getName();
		const fieldType = field.constructor.name;
		const pdfFormField = field as unknown as PDFFormField;

		let pdfField: PDFField | null = null;

		switch (fieldType) {
			case "PDFTextField": {
				pdfField = parseTextField(pdfFormField, fieldName);
				break;
			}

			case "PDFDropdown": {
				pdfField = parseDropdownField(pdfFormField, fieldName);
				break;
			}

			case "PDFCheckBox": {
				pdfField = parseCheckboxField(pdfFormField, fieldName);
				break;
			}

			case "PDFRadioGroup": {
				pdfField = parseRadioGroupField(pdfFormField, fieldName);
				break;
			}

			default: {
				// Unknown field type, treat as text
				pdfField = {
					name: fieldName,
					label: fieldName,
					type: "text",
					value: "",
				};
			}
		}

		if (pdfField) {
			fields.push(pdfField);
		}
	}
	return fields;
}

/**
 * Converts PDF fields to InputTagType format, similar to how switch tags are parsed.
 * Dropdown and radio fields are converted to Switch tags with Case children,
 * similar to how switch tags work in parseMarkdocToInputs.
 * Checkbox fields are converted to Switch tags with Case children for "true" and "false".
 */
export function convertPDFFieldsToInputTags(
	fields: PDFField[],
	fieldMapping: FieldMapping[],
): {
	inputTags: InputTagType[];
} {
	const inputTags: InputTagType[] = [];

	for (const field of fields) {
		// Use label as primary, fallback to name if label is empty

		const mapping = fieldMapping.find((fm) => fm.fieldName === field.name);
		const primary = mapping?.label ? mapping.label.trim() : field.name;

		// Convert checkbox fields to Switch tags with Case children for "true" and "false"
		if (field.type === "checkbox") {
			const caseChildren: InputTagType[] = [
				{
					$$mdtype: "Tag",
					name: "Case" as const,
					attributes: {
						primary: "true",
					},
					children: [],
				} as InputTagType,
				{
					$$mdtype: "Tag",
					name: "Case" as const,
					attributes: {
						primary: "false",
					},
					children: [],
				} as InputTagType,
			];

			const switchTag: SwitchInputTagType = {
				$$mdtype: "Tag",
				name: "Switch" as const,
				attributes: {
					primary,
				},
				children: caseChildren,
			};

			inputTags.push(switchTag);
		}
		// Convert dropdown and radio fields to Switch tags with Case children
		else if (field.type === "dropdown" || field.type === "radio") {
			const caseChildren: InputTagType[] = (field.options || []).map(
				(option) =>
					({
						$$mdtype: "Tag",
						name: "Case" as const,
						attributes: {
							primary: option,
						},
						children: [],
					}) as InputTagType,
			);

			const switchTag: SwitchInputTagType = {
				$$mdtype: "Tag",
				name: "Switch" as const,
				attributes: {
					primary,
				},
				children: caseChildren,
			};

			inputTags.push(switchTag);
		}
		// Convert text and multiline fields to Info tags
		else {
			const infoTag: InfoInputTagType = {
				$$mdtype: "Tag",
				name: "Info" as const,
				attributes: {
					primary,
					type: "string",
				},
				children: [],
			};

			inputTags.push(infoTag);
		}
	}

	return { inputTags };
}
