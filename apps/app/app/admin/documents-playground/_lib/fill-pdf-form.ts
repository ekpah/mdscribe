import { PDFDocument } from "pdf-lib";
import type { FieldMapping } from "./parse-pdf-form-fields";

// Type for PDF form field with unknown methods
interface PDFFormField {
	setText?: (value: string) => void;
	select?: (value: string) => void;
	check?: () => void;
	uncheck?: () => void;
}

interface PdfFormWithFields {
	getField: (fieldName: string) => { constructor: { name: string } };
}

const toStringValue = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}

	return value?.toString() || "";
};

const createFieldNameByLabelMap = (fieldMapping: FieldMapping[]) =>
	new Map(fieldMapping.map((mapping) => [mapping.label, mapping.fieldName]));

const fieldValueHandlers: Partial<
	Record<string, (field: PDFFormField, value: string) => void>
> = {
	PDFCheckBox: (field, value) => {
		if (value === "true") {
			field.check?.();
			return;
		}
		field.uncheck?.();
	},
	PDFDropdown: (field, value) => {
		if (value) {
			field.select?.(value);
		}
	},
	PDFRadioGroup: (field, value) => {
		if (value) {
			field.select?.(value);
		}
	},
	PDFTextField: (field, value) => {
		field.setText?.(value);
	},
};

const applyFieldValue = (
	field: PDFFormField,
	fieldType: string,
	value: string,
	fieldName: string,
) => {
	const handler = fieldValueHandlers[fieldType];
	if (!handler) {
		console.warn(`Unknown field type: ${fieldType} for ${fieldName}`);
		return;
	}
	handler(field, value);
};

const fillMappedFieldValue = (
	form: PdfFormWithFields,
	fieldNameByLabel: Map<string, string>,
	label: string,
	fieldValue: unknown,
) => {
	const fieldName = fieldNameByLabel.get(label);
	if (!fieldName) {
		console.warn(`No field mapping found for label: ${label}`);
		return;
	}

	try {
		const field = form.getField(fieldName);
		const fieldType = field.constructor.name;
		const pdfFormField = field as unknown as PDFFormField;
		applyFieldValue(pdfFormField, fieldType, toStringValue(fieldValue), fieldName);
	} catch (error) {
		console.error(`Error filling field ${fieldName} (label: ${label}):`, error);
	}
};

/**
 * Fills a PDF form with the provided field values
 * Maps from label (primary) back to field name using the fieldMapping
 * Returns the filled PDF as a Uint8Array
 */
export const fillPDFForm = async (
	file: Uint8Array,
	fieldValues: Record<string, unknown>,
	fieldMapping: FieldMapping[],
): Promise<Uint8Array> => {
	// Load from a copy so callers can safely keep using their original upload bytes.
	const stableBytes = new Uint8Array(file);
	const pdfDoc = await PDFDocument.load(stableBytes);
	const form = pdfDoc.getForm() as unknown as PdfFormWithFields;
	const fieldNameByLabel = createFieldNameByLabelMap(fieldMapping);

	// Iterate through all form field values (using labels as keys)
	for (const [label, fieldValue] of Object.entries(fieldValues)) {
		fillMappedFieldValue(form, fieldNameByLabel, label, fieldValue);
	}

	// Flatten the form to make the filled values permanent (optional)
	// form.flatten();

	return pdfDoc.save();
};
