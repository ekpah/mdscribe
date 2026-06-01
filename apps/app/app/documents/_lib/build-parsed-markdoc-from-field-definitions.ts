import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";

import type { DocumentFieldDefinition } from "./types";

const normalizeFieldDefinition = (field: DocumentFieldDefinition): DocumentFieldDefinition => {
	const trimmedOptions = field.options.map((o) => o.trim()).filter((o) => o.length > 0);
	const isSwitch = field.inputKind !== "text";
	let options: string[] = [];
	if (field.inputKind === "boolean") {
		options = ["true", "false"];
	} else if (isSwitch) {
		options = trimmedOptions;
	}

	return {
		...field,
		description: field.description.trim(),
		label: field.label.trim(),
		markdocType: isSwitch ? "Switch" : "Info",
		options,
		textCheckboxValue:
			field.pdfType === "text" && field.inputKind === "boolean"
				? field.textCheckboxValue?.trim() || "x"
				: field.textCheckboxValue,
		valueType: isSwitch ? "string" : field.valueType,
	};
};

// --- Validation ---

const validateFieldDefinitions = (fields: DocumentFieldDefinition[]): string[] => {
	const errors: string[] = [];

	for (const [index, field] of fields.entries()) {
		if (!field.fieldName.trim()) {
			errors.push(`Feld ${index + 1}: fieldName ist leer.`);
		}
		if (!field.label) {
			errors.push(`Feld ${index + 1}: Label darf nicht leer sein.`);
		}
		if (field.inputKind === "choice" && field.options.length === 0) {
			errors.push(`Feld ${index + 1}: Auswahlfelder benötigen mindestens eine Option.`);
		}
	}

	// Conflicting duplicate labels among enabled fields only.
	// Disabled fields generate no tags, so they cannot conflict.
	const enabledByLabel = new Map<string, { index: number; signature: string }>();
	for (const [index, field] of fields.entries()) {
		if (!field.isEnabled) {
			continue;
		}

		const key = field.label.toLowerCase();
		const signature = JSON.stringify([
			field.description,
			field.inputKind,
			field.markdocType,
			field.textCheckboxValue,
			field.valueType,
			field.pdfType,
			field.options,
		]);
		const existing = enabledByLabel.get(key);

		if (existing) {
			if (existing.signature !== signature) {
				errors.push(
					`Feld ${index + 1}: Label "${field.label}" ist mehrfach vorhanden, aber die Konfiguration weicht von Feld ${existing.index + 1} ab.`,
				);
			}
		} else {
			enabledByLabel.set(key, { index, signature });
		}
	}

	return errors;
};

// --- Tag construction (direct, no Markdoc string round-trip) ---

const toInputTag = (field: DocumentFieldDefinition): InputTagType => {
	if (field.inputKind !== "text") {
		return {
			attributes: {
				primary: field.label,
				...(field.inputKind === "boolean" ? { type: "boolean" as const } : {}),
			},
			children: field.options.map((option) => ({
				attributes: { primary: option },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		};
	}

	return {
		attributes: {
			primary: field.label,
			type: field.valueType,
			...(field.description ? { description: field.description } : {}),
		},
		children: [],
		name: "Info",
	};
};

// --- Main ---

export const buildParsedMarkdocFromFieldDefinitions = (
	fieldDefinitions: DocumentFieldDefinition[],
): {
	inputTags: InputTagType[];
	normalizedFieldDefinitions: DocumentFieldDefinition[];
} => {
	const normalizedFieldDefinitions = fieldDefinitions.map(normalizeFieldDefinition);
	const errors = validateFieldDefinitions(normalizedFieldDefinitions);

	if (errors.length > 0) {
		throw new Error(errors.join("\n"));
	}

	const seenLabels = new Set<string>();
	const inputTags: InputTagType[] = [];

	for (const field of normalizedFieldDefinitions) {
		if (!field.isEnabled) {
			continue;
		}

		const labelKey = field.label.toLowerCase();
		if (seenLabels.has(labelKey)) {
			continue;
		}

		seenLabels.add(labelKey);
		inputTags.push(toInputTag(field));
	}

	return { inputTags, normalizedFieldDefinitions };
};
