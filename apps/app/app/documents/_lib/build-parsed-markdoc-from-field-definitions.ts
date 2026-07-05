import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

import type { DocumentDefinition, DocumentFieldDefinition, DocumentFieldMapping } from "./types";

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

const toLegacyInputTag = (field: DocumentFieldDefinition): InputTagType => {
	if (field.inputKind === "text") {
		return {
			attributes: {
				primary: field.label.trim(),
				type: field.valueType,
				...(field.description.trim() ? { description: field.description.trim() } : {}),
			},
			children: [],
			name: "Info",
		};
	}

	return {
		attributes: {
			primary: field.label.trim(),
			...(field.inputKind === "boolean" ? { type: "boolean" as const } : {}),
		},
		children: (field.inputKind === "boolean" ? ["true", "false"] : field.options)
			.map((option) => option.trim())
			.filter(Boolean)
			.map((option) => ({ attributes: { primary: option }, children: [], name: "Case" as const })),
		name: "Switch",
	};
};

const normalizeLegacyFieldDefinition = (field: DocumentFieldDefinition): DocumentFieldDefinition => {
	const { inputKind } = field;
	let options: string[] = [];
	if (inputKind === "boolean") {
		options = ["true", "false"];
	} else if (inputKind === "choice") {
		options = field.options.map((option) => option.trim()).filter(Boolean);
	}
	return {
		...field,
		description: field.description.trim(),
		label: field.label.trim(),
		markdocType: inputKind === "text" ? "Info" : "Switch",
		options,
		valueType: inputKind === "text" ? field.valueType : "string",
	};
};

const validateLegacyFieldDefinitions = (fields: DocumentFieldDefinition[]): void => {
	const signaturesByLabel = new Map<string, string>();
	for (const [index, field] of fields.entries()) {
		if (!field.fieldName) {
			throw new Error(`Feld ${index + 1}: fieldName ist leer.`);
		}
		if (!field.label) {
			throw new Error(`Feld ${index + 1}: Label darf nicht leer sein.`);
		}
		if (field.inputKind === "choice" && field.options.length === 0) {
			throw new Error(`Feld ${index + 1}: Auswahlfelder benötigen mindestens eine Option.`);
		}
		if (!field.isEnabled) {
			continue;
		}
		const key = toVariableKey(field.label);
		const signature = JSON.stringify([
			field.description,
			field.inputKind,
			field.options,
			field.pdfType,
			field.valueType,
		]);
		const existingSignature = signaturesByLabel.get(key);
		if (existingSignature && existingSignature !== signature) {
			throw new Error(
				`Feld ${index + 1}: Label "${field.label}" ist mehrfach vorhanden, aber die Konfiguration weicht ab.`,
			);
		}
		signaturesByLabel.set(key, signature);
	}
};

export const documentDefinitionFromLegacyFieldDefinitions = (
	fields: DocumentFieldDefinition[],
): DocumentDefinition => {
	const normalizedFields = fields.map(normalizeLegacyFieldDefinition);
	validateLegacyFieldDefinitions(normalizedFields);
	const inputTags: InputTagType[] = [];
	const seenVariables = new Set<string>();
	const fieldMappings: DocumentFieldMapping[] = [];

	for (const field of normalizedFields) {
		const variable = field.label.trim() || field.fieldName;
		const key = toVariableKey(variable);
		if (field.isEnabled && !seenVariables.has(key)) {
			seenVariables.add(key);
			inputTags.push(toLegacyInputTag({ ...field, label: variable }));
		}

		const isTextCheckbox = field.pdfType === "text" && field.inputKind === "boolean";
		fieldMappings.push({
			...(isTextCheckbox ? { condition: "true", value: field.textCheckboxValue?.trim() || "x" } : {}),
			fieldName: field.fieldName,
			isEnabled: field.isEnabled,
			pdfType: field.pdfType,
			variable,
		});
	}

	return normalizeDocumentDefinition({ fieldMappings, inputTags, version: 2 });
};

export const buildParsedMarkdocFromDocumentDefinition = (
	definition: DocumentDefinition,
): { inputTags: InputTagType[]; normalizedDefinition: DocumentDefinition } => {
	const normalizedDefinition = normalizeDocumentDefinition(definition);
	return { inputTags: normalizedDefinition.inputTags, normalizedDefinition };
};

// Kept for callers and persisted records that still use the legacy array format.
export const buildParsedMarkdocFromFieldDefinitions = (fieldDefinitions: DocumentFieldDefinition[]) => {
	const normalizedFieldDefinitions = fieldDefinitions.map(normalizeLegacyFieldDefinition);
	const normalizedDefinition = documentDefinitionFromLegacyFieldDefinitions(normalizedFieldDefinitions);
	return {
		inputTags: normalizedDefinition.inputTags,
		normalizedFieldDefinitions,
	};
};
