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

export interface ParsePDFResult {
	inputTags: InputTagType[];
	fieldMapping: Record<string, string>; // Maps label (primary) → field name
	fields: PDFField[];
}

// Regex for splitting field names into words
const FIELD_NAME_SPLIT_REGEX = /[._-]/;

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
 * Extracts a user-friendly label from a PDF form field.
 * Tries alternate name, tooltip, partial name, or formats the field name.
 */
function getFieldLabel(pdfField: PDFFormField, fieldName: string): string {
	// Try to get alternate name (often more user-friendly)
	const alternateName = pdfField.getAlternateName?.();
	if (alternateName?.trim()) {
		return alternateName.trim();
	}
	// Try to get tooltip
	const tooltip = pdfField.getTooltip?.();
	if (tooltip?.trim()) {
		return tooltip.trim();
	}
	// Try to get partial name (sometimes more readable)
	const partialName = pdfField.getPartialName?.();
	if (partialName?.trim()) {
		return partialName.trim();
	}
	// Fallback to field name, but try to make it more readable
	return fieldName
		.split(FIELD_NAME_SPLIT_REGEX)
		.map(
			(word: string) =>
				word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join(" ");
}

/**
 * Parses a PDF file and extracts all fillable form fields
 * and returns them in a format similar to parseMarkdocToInputs
 */
export async function parsePDFFormFields(file: File): Promise<ParsePDFResult> {
	const fields = await parseFormFieldsFromPDF(file);
	const { inputTags, fieldMapping } = convertPDFFieldsToInputTags(fields);
	return { inputTags, fieldMapping, fields };
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
		label: getFieldLabel(pdfFormField, fieldName),
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
		label: getFieldLabel(pdfFormField, fieldName),
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
		label: getFieldLabel(pdfFormField, fieldName),
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
		label: getFieldLabel(pdfFormField, fieldName),
		type: "radio",
		options,
		value: selectedValue || "",
	};
}

/**
 * Parses a PDF file and extracts all fillable form fields
 * Similar to parseMarkdocToInputs but for PDF forms
 */
export async function parseFormFieldsFromPDF(file: File): Promise<PDFField[]> {
	const arrayBuffer = await file.arrayBuffer();
	const pdfDoc = await PDFDocument.load(arrayBuffer);
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
					label: getFieldLabel(pdfFormField, fieldName),
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
export function convertPDFFieldsToInputTags(fields: PDFField[]): {
	inputTags: InputTagType[];
	fieldMapping: Record<string, string>;
} {
	const inputTags: InputTagType[] = [];
	const fieldMapping: Record<string, string> = {};

	for (const field of fields) {
		// Use label as primary, fallback to name if label is empty
		const primary = field.label.trim() || field.name;

		// Store mapping: label (primary) → field name (needed for filling PDF)
		fieldMapping[primary] = field.name;

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

	return { inputTags, fieldMapping };
}
