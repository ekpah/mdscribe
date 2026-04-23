import { PDFDocument } from "pdf-lib";

import type { DocumentFieldDefinition } from "@/lib/documents/types";

interface PDFFormField {
	check?: () => void;
	select?: (value: string) => void;
	setText?: (value: string) => void;
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

const toCheckboxState = (value: string): boolean => {
	const normalized = value.trim().toLowerCase();
	return (
		normalized === "true" ||
		normalized === "1" ||
		normalized === "yes" ||
		normalized === "ja"
	);
};

const toLabelKey = (label: string): string => label.trim().toLowerCase();

const createFieldNamesByLabelMap = (
	fieldDefinitions: DocumentFieldDefinition[],
) => {
	const map = new Map<string, string[]>();
	for (const definition of fieldDefinitions) {
		const key = toLabelKey(definition.label);
		const current = map.get(key) ?? [];
		current.push(definition.fieldName);
		map.set(key, current);
	}
	return map;
};

const fieldValueHandlers: Partial<
	Record<string, (field: PDFFormField, value: string) => void>
> = {
	PDFCheckBox: (field, value) => {
		if (toCheckboxState(value)) {
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
	fieldNamesByLabel: Map<string, string[]>,
	label: string,
	fieldValue: unknown,
) => {
	const fieldNames = fieldNamesByLabel.get(toLabelKey(label));
	if (!fieldNames || fieldNames.length === 0) {
		return;
	}

	for (const fieldName of fieldNames) {
		try {
			const field = form.getField(fieldName);
			const fieldType = field.constructor.name;
			const pdfFormField = field as unknown as PDFFormField;
			applyFieldValue(pdfFormField, fieldType, toStringValue(fieldValue), fieldName);
		} catch (error) {
			console.error(`Error filling field ${fieldName} (label: ${label}):`, error);
		}
	}
};

export const fillPDFForm = async (
	file: Uint8Array,
	fieldValues: Record<string, unknown>,
	fieldDefinitions: DocumentFieldDefinition[],
): Promise<Uint8Array> => {
	const stableBytes = new Uint8Array(file);
	const pdfDoc = await PDFDocument.load(stableBytes);
	const form = pdfDoc.getForm() as unknown as PdfFormWithFields;
	const fieldNamesByLabel = createFieldNamesByLabelMap(fieldDefinitions);

	for (const [label, fieldValue] of Object.entries(fieldValues)) {
		fillMappedFieldValue(form, fieldNamesByLabel, label, fieldValue);
	}

	return pdfDoc.save();
};
