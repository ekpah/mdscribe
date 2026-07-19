import type {
	DocumentBinding,
	DocumentDefinition,
	DocumentInput,
	DocumentInputKind,
} from "./types";
import { isBooleanDocumentInput } from "./document-definition";
import type { PdfFormField } from "./parse-pdf-form-fields";

const toDocumentInputKind = (input: DocumentInput): DocumentInputKind => {
	if (input.name === "Info") {
		return "text";
	}
	return isBooleanDocumentInput(input) ? "boolean" : "choice";
};

const isUncheckedPdfValue = (value: string): boolean =>
	!value || ["0", "false", "off"].includes(value.toLowerCase());

const getDocumentInputValues = (input: DocumentInput): string[] => {
	if (isBooleanDocumentInput(input)) {
		return ["true", "false"];
	}
	if (input.name === "Switch") {
		return input.children.map((option) => option.attributes.primary);
	}
	return [];
};

const isChoiceBindingCompatible = (
	binding: DocumentBinding,
	field: PdfFormField,
	inputKind: DocumentInputKind,
	mappedValues: string[],
): boolean => {
	if (inputKind === "text" || (inputKind === "boolean" && !binding.valueMap)) {
		return false;
	}
	const pdfValues = new Set((field.optionMappings ?? []).map((option) => option.pdfValue));
	return mappedValues.every((value) => !value || pdfValues.has(value));
};

const isBooleanBindingCompatible = (
	binding: DocumentBinding,
	field: PdfFormField,
	inputKind: DocumentInputKind,
	mappedValues: string[],
): boolean => {
	if (inputKind === "text" || (inputKind === "choice" && !binding.valueMap)) {
		return false;
	}
	const checkedPdfValues = new Set(
		(field.optionMappings ?? []).map((option) => option.pdfValue),
	);
	if (
		checkedPdfValues.size > 0 &&
		!mappedValues.every(
			(value) => isUncheckedPdfValue(value) || checkedPdfValues.has(value),
		)
	) {
		return false;
	}
	if (inputKind === "boolean") {
		return (
			isUncheckedPdfValue(binding.valueMap?.false ?? "false") &&
			!isUncheckedPdfValue(binding.valueMap?.true ?? "true")
		);
	}
	return mappedValues.some((value) => !isUncheckedPdfValue(value));
};

const isBindingCompatibleWithPdfField = (
	binding: DocumentBinding,
	field: PdfFormField,
	input: DocumentInput,
): boolean => {
	const inputKind = toDocumentInputKind(input);
	if (field.type === "unsupported") {
		return false;
	}
	if (field.inputKind === "text") {
		return inputKind !== "boolean" || Boolean(binding.valueMap);
	}
	const inputValues = getDocumentInputValues(input);
	const mappedValues = inputValues.map(
		(inputValue) => binding.valueMap?.[inputValue] ?? inputValue,
	);

	if (field.inputKind === "choice") {
		return isChoiceBindingCompatible(binding, field, inputKind, mappedValues);
	}
	if (field.inputKind === "boolean") {
		return isBooleanBindingCompatible(binding, field, inputKind, mappedValues);
	}
	return false;
};

export const validateDocumentDefinitionAgainstPdfFields = (
	definition: DocumentDefinition,
	fields: PdfFormField[],
): void => {
	const fieldsByName = new Map(fields.map((field) => [field.name, field]));
	const inputsById = new Map(
		definition.inputs.map((input) => [input.attributes.primary.toLowerCase(), input]),
	);
	const enabledBindingCounts = new Map<string, number>();
	for (const binding of definition.bindings) {
		if (binding.isEnabled) {
			enabledBindingCounts.set(
				binding.fieldName,
				(enabledBindingCounts.get(binding.fieldName) ?? 0) + 1,
			);
		}
	}

	for (const binding of definition.bindings) {
		const field = fieldsByName.get(binding.fieldName);
		if (!field) {
			throw new Error(`PDF-Feld "${binding.fieldName}" wurde nicht gefunden.`);
		}
		if (!binding.isEnabled) {
			continue;
		}
		if (field.isReadOnly) {
			throw new Error(`PDF-Feld "${binding.fieldName}" ist schreibgeschützt.`);
		}
		if (field.type === "unsupported") {
			throw new Error(`PDF-Feld "${binding.fieldName}" wird nicht unterstützt.`);
		}
		if (
			(enabledBindingCounts.get(binding.fieldName) ?? 0) > 1 &&
			(field.type !== "checkbox" || field.widgetCount <= 1)
		) {
			throw new Error(`PDF-Feld "${binding.fieldName}" unterstützt nicht mehrere Eingaben.`);
		}
		const input = inputsById.get(binding.inputId.toLowerCase());
		if (!input) {
			throw new Error(`Eingabe "${binding.inputId}" wurde nicht gefunden.`);
		}
		if (!isBindingCompatibleWithPdfField(binding, field, input)) {
			throw new Error(
				`Eingabe "${binding.inputId}" passt nicht zum PDF-Feld "${binding.fieldName}".`,
			);
		}
	}
};

export const validateDocumentDefinitionPreservesPdfFields = (
	currentDefinition: DocumentDefinition,
	proposedDefinition: DocumentDefinition,
	fields: PdfFormField[],
): void => {
	const knownFieldNames = new Set(fields.map((field) => field.name));
	const currentFieldNames = new Set(currentDefinition.bindings.map((binding) => binding.fieldName));
	const proposedFieldNames = new Set(proposedDefinition.bindings.map((binding) => binding.fieldName));
	const currentEnabledFieldNames = new Set(
		currentDefinition.bindings
			.filter((binding) => binding.isEnabled)
			.map((binding) => binding.fieldName),
	);
	const proposedEnabledFieldNames = new Set(
		proposedDefinition.bindings
			.filter((binding) => binding.isEnabled)
			.map((binding) => binding.fieldName),
	);

	for (const fieldName of currentFieldNames) {
		if (!knownFieldNames.has(fieldName)) {
			throw new Error(`PDF-Feld "${fieldName}" wurde nicht gefunden.`);
		}
		if (!proposedFieldNames.has(fieldName)) {
			throw new Error(`Der KI-Vorschlag hat das PDF-Feld "${fieldName}" entfernt.`);
		}
		if (currentEnabledFieldNames.has(fieldName) !== proposedEnabledFieldNames.has(fieldName)) {
			throw new Error(`Der KI-Vorschlag hat die Aktivierung von "${fieldName}" verändert.`);
		}
	}

	for (const fieldName of proposedFieldNames) {
		if (!currentFieldNames.has(fieldName)) {
			throw new Error(`Der KI-Vorschlag hat das unbekannte PDF-Feld "${fieldName}" ergänzt.`);
		}
	}
};
