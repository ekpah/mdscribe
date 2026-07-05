import { PDFDocument, PDFName } from "pdf-lib";
import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

import { documentDefinitionFromLegacyFieldDefinitions, normalizeDocumentDefinition } from "./build-parsed-markdoc-from-field-definitions";
import type { DocumentDefinition, DocumentFieldDefinition, DocumentFieldMapping } from "./types";

interface PdfLibFormField {
	acroField?: {
		dict?: { set: (key: PDFName, value: PDFName) => void };
		getWidgets?: () => {
			getOnValue?: () => PDFName | undefined;
			setAppearanceState?: (value: PDFName) => void;
		}[];
	};
	check?: () => void;
	constructor: { name: string };
	select?: (value: string) => void;
	setText?: (value: string) => void;
	uncheck?: () => void;
}

const toStringValue = (value: unknown): string => (typeof value === "string" ? value : value?.toString() || "");
const toCheckboxState = (value: string): boolean => ["true", "1", "yes", "ja"].includes(value.trim().toLowerCase());
const normalizePdfOption = (value: string): string => value.trim();

const toDefinition = (definition: DocumentDefinition | DocumentFieldDefinition[]): DocumentDefinition =>
	normalizeDocumentDefinition(
		Array.isArray(definition) ? documentDefinitionFromLegacyFieldDefinitions(definition) : definition,
	);

const resolveMappingValue = (
	mappings: DocumentFieldMapping[],
	fieldValues: Record<string, unknown>,
): string => {
	const matchingConditional = mappings.find(
		(mapping) =>
			mapping.condition !== undefined && toStringValue(fieldValues[mapping.variable]) === mapping.condition,
	);
	const directMapping = mappings.find((mapping) => mapping.condition === undefined);
	const mapping = matchingConditional ?? directMapping;
	if (!mapping) {
		return "";
	}
	const inputValue = toStringValue(fieldValues[mapping.variable]);
	return mapping.value === undefined ? inputValue : mapping.value;
};

const setCheckboxValue = (
	field: PdfLibFormField,
	value: string,
	inputTag: InputTagType | undefined,
): void => {
	const widgets = field.acroField?.getWidgets?.() ?? [];
	if (widgets.length > 1) {
		const normalizedValue = normalizePdfOption(value);
		let selectedWidget = widgets.find(
			(widget) => normalizePdfOption(widget.getOnValue?.()?.decodeText() ?? "") === normalizedValue,
		);
		if (!selectedWidget && inputTag?.name === "Switch") {
			const selectedOptionIndex = inputTag.children
				.map((child) => normalizePdfOption(child.attributes.primary))
				.indexOf(normalizedValue);
			selectedWidget = widgets[selectedOptionIndex];
		}
		const selectedValue = selectedWidget?.getOnValue?.();
		if (!selectedValue) {
			console.warn(`Unknown checkbox option "${value}" for ${field.constructor.name}`);
			return;
		}
		field.acroField?.dict?.set(PDFName.of("V"), selectedValue);
		for (const widget of widgets) {
			widget.setAppearanceState?.(widget === selectedWidget ? selectedValue : PDFName.of("Off"));
		}
		return;
	}

	if (toCheckboxState(value)) {
		field.check?.();
	} else {
		field.uncheck?.();
	}
};

const fillMappedField = (
	field: PdfLibFormField,
	value: string,
	inputTag: InputTagType | undefined,
): void => {
	switch (field.constructor.name) {
		case "PDFCheckBox": {
			setCheckboxValue(field, value, inputTag);
			return;
		}
		case "PDFDropdown":
		case "PDFRadioGroup": {
			if (value) {
				field.select?.(value);
			}
			return;
		}
		case "PDFTextField": {
			field.setText?.(value);
			return;
		}
		default: {
			console.warn(`Unknown field type: ${field.constructor.name}`);
		}
	}
};

export const fillPDFForm = async (
	file: Uint8Array,
	fieldValues: Record<string, unknown>,
	definition: DocumentDefinition | DocumentFieldDefinition[],
): Promise<Uint8Array> => {
	const normalizedDefinition = toDefinition(definition);
	const pdfDoc = await PDFDocument.load(new Uint8Array(file));
	const form = pdfDoc.getForm();
	const mappingsByFieldName = new Map<string, DocumentFieldMapping[]>();
	const inputTagsByVariable = new Map(
		normalizedDefinition.inputTags.map((inputTag) => [
			inputTag.attributes.primary.trim().toLowerCase(),
			inputTag,
		]),
	);

	for (const mapping of normalizedDefinition.fieldMappings) {
		if (!mapping.isEnabled) {
			continue;
		}
		const current = mappingsByFieldName.get(mapping.fieldName) ?? [];
		current.push(mapping);
		mappingsByFieldName.set(mapping.fieldName, current);
	}

	for (const [fieldName, mappings] of mappingsByFieldName) {
		try {
			const field = form.getField(fieldName) as unknown as PdfLibFormField;
			const inputTag = inputTagsByVariable.get(mappings[0]?.variable.trim().toLowerCase() ?? "");
			fillMappedField(field, resolveMappingValue(mappings, fieldValues), inputTag);
		} catch (error) {
			console.error(`Error filling field ${fieldName}:`, error);
		}
	}

	return pdfDoc.save();
};
