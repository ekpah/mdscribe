import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

import type { DocumentDefinition } from "./types";

const toVariableKey = (variable: string): string => variable.trim().toLowerCase();

const cloneInputTag = (inputTag: InputTagType): InputTagType => {
	if (inputTag.name === "Info") {
		return { ...inputTag, attributes: { ...inputTag.attributes }, children: [] };
	}
	if (inputTag.name === "Switch") {
		return {
			...inputTag,
			attributes: { ...inputTag.attributes },
			children: inputTag.children.map(cloneInputTag),
		};
	}
	if (inputTag.name === "Case") {
		return {
			...inputTag,
			attributes: { ...inputTag.attributes },
			children: inputTag.children.map(cloneInputTag),
		};
	}
	return {
		...inputTag,
		attributes: { ...inputTag.attributes },
		children: inputTag.children.map(cloneInputTag),
	};
};

const normalizeInputTag = (inputTag: InputTagType): InputTagType => {
	if (inputTag.name === "Info") {
		return {
			...inputTag,
			attributes: {
				...inputTag.attributes,
				description: inputTag.attributes.description?.trim() || undefined,
				primary: inputTag.attributes.primary.trim(),
			},
		};
	}

	if (inputTag.name === "Switch") {
		return {
			...inputTag,
			attributes: { ...inputTag.attributes, primary: inputTag.attributes.primary.trim() },
			children: inputTag.children.map(cloneInputTag),
		};
	}

	return cloneInputTag(inputTag);
};

const validateDocumentDefinition = (definition: DocumentDefinition): void => {
	const variables = new Set<string>();
	for (const [index, inputTag] of definition.inputTags.entries()) {
		if (inputTag.name !== "Info" && inputTag.name !== "Switch") {
			throw new Error(`Eingabe ${index + 1}: Nur Info- und Switch-Tags sind für PDFs erlaubt.`);
		}
		const variable = inputTag.attributes.primary.trim();
		if (!variable) {
			throw new Error(`Eingabe ${index + 1}: Variable darf nicht leer sein.`);
		}
		const key = toVariableKey(variable);
		if (variables.has(key)) {
			throw new Error(`Eingabe ${index + 1}: Variable "${variable}" ist mehrfach vorhanden.`);
		}
		variables.add(key);
		if (
			inputTag.name === "Switch" &&
			inputTag.attributes.type !== "boolean" &&
			inputTag.children.length === 0
		) {
			throw new Error(`Eingabe ${index + 1}: Auswahl benötigt mindestens eine Option.`);
		}
	}

	for (const [index, mapping] of definition.fieldMappings.entries()) {
		if (!mapping.fieldName.trim()) {
			throw new Error(`Zuordnung ${index + 1}: PDF-Feldname darf nicht leer sein.`);
		}
		if (mapping.isEnabled && !variables.has(toVariableKey(mapping.variable))) {
			throw new Error(
				`Zuordnung ${index + 1}: Variable "${mapping.variable}" ist nicht als Eingabe definiert.`,
			);
		}
	}
};

export const normalizeDocumentDefinition = (definition: DocumentDefinition): DocumentDefinition => {
	const inputTags = definition.inputTags.map(normalizeInputTag);
	const inputVariables = new Map(
		inputTags.map((inputTag) => [toVariableKey(inputTag.attributes.primary), inputTag.attributes.primary]),
	);
	const fieldMappings = definition.fieldMappings.map((mapping) => ({
		...mapping,
		condition: mapping.condition?.trim() || undefined,
		fieldName: mapping.fieldName.trim(),
		value: mapping.value === undefined ? undefined : mapping.value,
		variable: inputVariables.get(toVariableKey(mapping.variable)) ?? mapping.variable.trim(),
	}));
	const normalized = { fieldMappings, inputTags, version: 2 as const };
	validateDocumentDefinition(normalized);
	return normalized;
};

const toCheckboxState = (value: string): boolean =>
	["true", "1", "yes", "ja"].includes(value.trim().toLowerCase());

const toInputValueString = (value: unknown): string =>
	typeof value === "string" ? value : value?.toString() || "";

/**
 * Canonicalizes a runtime input value for condition matching and PDF output.
 * Boolean switch values normalize to "true"/"false" so tolerant user input
 * ("ja", "1", true) compares reliably against stored mapping conditions.
 */
export const canonicalizeInputValue = (
	inputTag: InputTagType | undefined,
	value: unknown,
): string => {
	const stringValue = toInputValueString(value);
	if (inputTag?.name === "Switch" && inputTag.attributes.type === "boolean") {
		return toCheckboxState(stringValue) ? "true" : "false";
	}
	return stringValue;
};

export const matchesCondition = (
	inputTag: InputTagType | undefined,
	value: unknown,
	condition: string,
): boolean => canonicalizeInputValue(inputTag, value) === condition;
