import { PDFDocument, PDFName } from "pdf-lib";
import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

import {
	canonicalizeInputValue,
	matchesCondition,
	normalizeDocumentDefinition,
} from "./document-definition";
import type { DocumentDefinition, DocumentFieldMapping } from "./types";

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

const toCheckboxState = (value: string): boolean => ["true", "1", "yes", "ja"].includes(value.trim().toLowerCase());
const normalizePdfOption = (value: string): string => value.trim();
const toVariableKey = (variable: string): string => variable.trim().toLowerCase();

interface ResolvedMapping {
	inputTag: InputTagType | undefined;
	value: string;
}

const resolveMapping = (
	mappings: DocumentFieldMapping[],
	fieldValues: Record<string, unknown>,
	inputTagsByVariable: Map<string, InputTagType>,
): ResolvedMapping => {
	const getInputTag = (mapping: DocumentFieldMapping) =>
		inputTagsByVariable.get(toVariableKey(mapping.variable));
	const matchingConditional = mappings.find(
		(mapping) =>
			mapping.condition !== undefined &&
			matchesCondition(getInputTag(mapping), fieldValues[mapping.variable], mapping.condition),
	);
	const mapping = matchingConditional ?? mappings.find((current) => current.condition === undefined);
	if (!mapping) {
		return { inputTag: undefined, value: "" };
	}
	const inputTag = getInputTag(mapping);
	return {
		inputTag,
		value: mapping.value ?? canonicalizeInputValue(inputTag, fieldValues[mapping.variable]),
	};
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
	definition: DocumentDefinition,
): Promise<Uint8Array> => {
	const normalizedDefinition = normalizeDocumentDefinition(definition);
	const pdfDoc = await PDFDocument.load(new Uint8Array(file));
	const form = pdfDoc.getForm();
	const mappingsByFieldName = new Map<string, DocumentFieldMapping[]>();
	const inputTagsByVariable = new Map(
		normalizedDefinition.inputTags.map((inputTag) => [
			toVariableKey(inputTag.attributes.primary),
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
			const resolved = resolveMapping(mappings, fieldValues, inputTagsByVariable);
			fillMappedField(field, resolved.value, resolved.inputTag);
		} catch (error) {
			console.error(`Error filling field ${fieldName}:`, error);
		}
	}

	return pdfDoc.save();
};
