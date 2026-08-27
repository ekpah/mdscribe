import type { DocumentBinding, DocumentDefinition, DocumentInput } from "./types";

const toInputKey = (inputId: string): string => inputId.trim().toLowerCase();

export const isBooleanDocumentInput = (input: DocumentInput | undefined): boolean =>
	input?.name === "Switch" &&
	(input.attributes.type === "boolean" || input.attributes.type === "checkbox");

const normalizeInput = (input: DocumentInput): DocumentInput => {
	if (input.name === "Info") {
		return {
			...input,
			attributes: {
				...input.attributes,
				description: input.attributes.description?.trim() || undefined,
				primary: input.attributes.primary.trim(),
				unit: input.attributes.unit?.trim() || undefined,
			},
			children: [],
		};
	}

	return {
		...input,
		attributes: { ...input.attributes, primary: input.attributes.primary.trim() },
		children: input.children.map((child) => ({
			...child,
			attributes: { primary: child.attributes.primary.trim() },
			children: [],
		})),
	};
};

const normalizeValueMap = (
	valueMap: Record<string, string> | undefined,
): Record<string, string> | undefined => {
	if (!valueMap) {
		return undefined;
	}

	const normalizedEntries: [string, string][] = [];
	const normalizedKeys = new Set<string>();
	for (const [inputValue, pdfValue] of Object.entries(valueMap)) {
		const normalizedInputValue = inputValue.trim();
		if (normalizedKeys.has(normalizedInputValue)) {
			throw new Error(`PDF-Wertzuordnung enthält den Wert "${normalizedInputValue}" mehrfach.`);
		}
		normalizedKeys.add(normalizedInputValue);
		normalizedEntries.push([normalizedInputValue, pdfValue]);
	}
	return Object.fromEntries(normalizedEntries);
};

const validateValueMap = (binding: DocumentBinding, input: DocumentInput, index: number): void => {
	if (!binding.valueMap) {
		return;
	}

	let requiredValues: string[] = [];
	if (isBooleanDocumentInput(input)) {
		requiredValues = ["true", "false"];
	} else if (input.name === "Switch") {
		requiredValues = input.children.map((child) => child.attributes.primary);
	}

	for (const requiredValue of requiredValues) {
		if (!Object.hasOwn(binding.valueMap, requiredValue)) {
			throw new Error(
				`Zuordnung ${index + 1}: Wert "${requiredValue}" fehlt in der PDF-Wertzuordnung.`,
			);
		}
	}
	const requiredValueSet = new Set(requiredValues);
	for (const mappedValue of Object.keys(binding.valueMap)) {
		if (!requiredValueSet.has(mappedValue)) {
			throw new Error(
				`Zuordnung ${index + 1}: Wert "${mappedValue}" gehört nicht zur Eingabe "${binding.inputId}".`,
			);
		}
	}
};

const validateDocumentDefinition = (definition: DocumentDefinition): void => {
	const inputsByKey = new Map<string, DocumentInput>();
	for (const [index, input] of definition.inputs.entries()) {
		const inputId = input.attributes.primary;
		if (!inputId) {
			throw new Error(`Eingabe ${index + 1}: Primary darf nicht leer sein.`);
		}

		const inputKey = toInputKey(inputId);
		if (inputsByKey.has(inputKey)) {
			throw new Error(`Eingabe ${index + 1}: Primary "${inputId}" ist mehrfach vorhanden.`);
		}
		inputsByKey.set(inputKey, input);

		if (input.name !== "Switch" || isBooleanDocumentInput(input)) {
			continue;
		}

		if (input.children.length === 0) {
			throw new Error(`Eingabe ${index + 1}: Auswahl benötigt mindestens eine Option.`);
		}

		const options = new Set<string>();
		for (const option of input.children) {
			const optionKey = toInputKey(option.attributes.primary);
			if (!optionKey) {
				throw new Error(`Eingabe ${index + 1}: Auswahloption darf nicht leer sein.`);
			}
			if (options.has(optionKey)) {
				throw new Error(
					`Eingabe ${index + 1}: Auswahloption "${option.attributes.primary}" ist mehrfach vorhanden.`,
				);
			}
			options.add(optionKey);
		}
	}

	const bindingKeys = new Set<string>();
	for (const [index, binding] of definition.bindings.entries()) {
		const bindingKey = `${binding.fieldName}\u0000${toInputKey(binding.inputId)}`;
		if (bindingKeys.has(bindingKey)) {
			throw new Error(
				`Zuordnung ${index + 1}: PDF-Feld "${binding.fieldName}" ist der Eingabe "${binding.inputId}" mehrfach zugeordnet.`,
			);
		}
		bindingKeys.add(bindingKey);

		const input = inputsByKey.get(toInputKey(binding.inputId));
		if (!input) {
			throw new Error(`Zuordnung ${index + 1}: Eingabe "${binding.inputId}" ist nicht definiert.`);
		}
		validateValueMap(binding, input, index);
	}
};

export const normalizeDocumentDefinition = (definition: DocumentDefinition): DocumentDefinition => {
	const inputs = definition.inputs.map(normalizeInput);
	const canonicalInputIds = new Map(
		inputs.map((input) => [toInputKey(input.attributes.primary), input.attributes.primary]),
	);
	const bindings = definition.bindings.map((binding) => ({
		...binding,
		fieldName: binding.fieldName.trim(),
		inputId: canonicalInputIds.get(toInputKey(binding.inputId)) ?? binding.inputId.trim(),
		valueMap: normalizeValueMap(binding.valueMap),
	}));
	const normalized = { bindings, inputs };
	validateDocumentDefinition(normalized);
	return normalized;
};

export const getEnabledDocumentInputs = (definition: DocumentDefinition): DocumentInput[] => {
	const enabledInputKeys = new Set(
		definition.bindings
			.filter((binding) => binding.isEnabled)
			.map((binding) => toInputKey(binding.inputId)),
	);
	return definition.inputs.filter((input) =>
		enabledInputKeys.has(toInputKey(input.attributes.primary)),
	);
};

const toBooleanState = (value: string): boolean =>
	["true", "1", "yes", "ja"].includes(value.trim().toLowerCase());

export const canonicalizeInputValue = (
	input: DocumentInput | undefined,
	value: unknown,
): string => {
	const stringValue = typeof value === "string" ? value : value?.toString() || "";
	return isBooleanDocumentInput(input) ? String(toBooleanState(stringValue)) : stringValue;
};
