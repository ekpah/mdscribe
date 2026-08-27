import { isBooleanDocumentInput, normalizeDocumentDefinition } from "./document-definition";
import type { DocumentDefinition, DocumentInput, DocumentPdfType } from "./types";

interface PdfCheckboxFieldMetadata {
	name: string;
	type?: DocumentPdfType;
	widgetCount: number;
}

export const getBooleanBindingValueMap = ({
	currentValueMap,
	pdfOptionMappings,
	pdfType,
	textCheckboxValue,
}: {
	currentValueMap?: Record<string, string>;
	pdfOptionMappings: readonly { pdfValue: string }[];
	pdfType: DocumentPdfType;
	textCheckboxValue?: string;
}): Record<"false" | "true", string> => {
	if (pdfType === "text" || pdfType === "multiline") {
		return {
			false: "",
			true: textCheckboxValue?.trim() || currentValueMap?.true || "x",
		};
	}

	return {
		false: "",
		true: currentValueMap?.true ?? pdfOptionMappings[0]?.pdfValue ?? "true",
	};
};

const toUniqueInputId = (preferredId: string, usedInputIds: Set<string>): string => {
	const normalizedPreferredId = preferredId.trim() || "Checkbox";
	let candidate = normalizedPreferredId;
	let suffix = 2;
	while (usedInputIds.has(candidate.toLowerCase())) {
		candidate = `${normalizedPreferredId} (${suffix})`;
		suffix += 1;
	}
	usedInputIds.add(candidate.toLowerCase());
	return candidate;
};

const createBooleanDocumentInput = (inputId: string): DocumentInput => ({
	attributes: { primary: inputId, type: "boolean" },
	children: ["true", "false"].map((primary) => ({
		attributes: { primary },
		children: [],
		name: "Case" as const,
	})),
	name: "Switch",
});

const removeValueMapOption = (
	valueMap: Record<string, string> | undefined,
	option: string,
): Record<string, string> | undefined => {
	if (!valueMap) {
		return undefined;
	}
	return Object.fromEntries(
		Object.entries(valueMap).filter(([inputValue]) => inputValue !== option),
	);
};

export const splitCheckboxOption = (
	definition: DocumentDefinition,
	inputId: string,
	option: string,
	pdfFields: readonly PdfCheckboxFieldMetadata[],
): DocumentDefinition => {
	const input = definition.inputs.find(
		(current) => current.attributes.primary.toLowerCase() === inputId.toLowerCase(),
	);
	if (
		input?.name !== "Switch" ||
		isBooleanDocumentInput(input) ||
		!input.children.some((child) => child.attributes.primary === option)
	) {
		return definition;
	}

	const usedInputIds = new Set(
		definition.inputs
			.filter((current) => current !== input)
			.map((current) => current.attributes.primary.toLowerCase()),
	);
	const detachedInputId = toUniqueInputId(option, usedInputIds);
	const targetBindingEntries = definition.bindings
		.map((binding, index) => ({ binding, index }))
		.filter(
			({ binding }) => binding.inputId.toLowerCase() === input.attributes.primary.toLowerCase(),
		);
	const widgetCountsByFieldName = new Map(
		pdfFields.map((field) => [field.name, field.widgetCount]),
	);
	const pdfTypesByFieldName = new Map(pdfFields.map((field) => [field.name, field.type]));
	const ownerEntries = targetBindingEntries.filter(({ binding }) => {
		const pdfValue = binding.valueMap?.[option];
		if (!pdfValue) {
			return false;
		}
		const pdfType = pdfTypesByFieldName.get(binding.fieldName);
		return (
			(widgetCountsByFieldName.get(binding.fieldName) ?? 0) > 1 ||
			pdfType === "text" ||
			pdfType === "multiline" ||
			!["0", "false", "off"].includes(pdfValue.toLowerCase())
		);
	});
	if (ownerEntries.length === 0) {
		return definition;
	}
	const ownerIndexes = new Set(ownerEntries.map(({ index }) => index));
	const hasRemainingOptions = input.children.length > 1;

	const bindings = definition.bindings.flatMap((binding, index) => {
		if (binding.inputId.toLowerCase() !== input.attributes.primary.toLowerCase()) {
			return [binding];
		}
		const remainingBinding = {
			...binding,
			valueMap: removeValueMapOption(binding.valueMap, option),
		};
		if (!ownerIndexes.has(index)) {
			return hasRemainingOptions ? [remainingBinding] : [];
		}
		const ownerPdfValue = binding.valueMap?.[option];
		if (!ownerPdfValue) {
			return hasRemainingOptions ? [remainingBinding] : [];
		}
		const isMultiWidgetOwner = (widgetCountsByFieldName.get(binding.fieldName) ?? 0) > 1;
		const ownerPdfType = pdfTypesByFieldName.get(binding.fieldName);
		const isTextOwner = ownerPdfType === "text" || ownerPdfType === "multiline";
		const ownerUnselectedPdfValue =
			isMultiWidgetOwner || isTextOwner
				? ""
				: (Object.entries(binding.valueMap ?? {}).find(
						([inputValue]) => inputValue !== option,
					)?.[1] ?? "false");
		const detachedBinding = {
			fieldName: binding.fieldName,
			inputId: detachedInputId,
			isEnabled: binding.isEnabled,
			valueMap: { false: ownerUnselectedPdfValue, true: ownerPdfValue },
		};
		if (!isMultiWidgetOwner || !hasRemainingOptions) {
			return [detachedBinding];
		}
		return [remainingBinding, detachedBinding];
	});
	const nextInput = {
		...input,
		children: input.children.filter((child) => child.attributes.primary !== option),
	};
	const inputs = definition.inputs.flatMap((current) =>
		current === input
			? [...(hasRemainingOptions ? [nextInput] : []), createBooleanDocumentInput(detachedInputId)]
			: [current],
	);

	return normalizeDocumentDefinition({ bindings, inputs });
};

export const mergeCheckboxBindingIntoChoice = (
	definition: DocumentDefinition,
	index: number,
	targetInputId: string,
): DocumentDefinition => {
	const binding = definition.bindings[index];
	const sourceInput = definition.inputs.find(
		(input) => input.attributes.primary.toLowerCase() === binding?.inputId.toLowerCase(),
	);
	const targetInput = definition.inputs.find(
		(input) => input.attributes.primary.toLowerCase() === targetInputId.toLowerCase(),
	);
	if (
		!binding ||
		!sourceInput ||
		!isBooleanDocumentInput(sourceInput) ||
		targetInput?.name !== "Switch" ||
		isBooleanDocumentInput(targetInput) ||
		sourceInput === targetInput
	) {
		return definition;
	}

	const existingOptions = targetInput.children.map((option) => option.attributes.primary);
	const usedOptions = new Set(existingOptions.map((option) => option.toLowerCase()));
	const option = toUniqueInputId(sourceInput.attributes.primary, usedOptions);
	const nextOptions = [...existingOptions, option];
	const sourceInputKey = sourceInput.attributes.primary.toLowerCase();
	const targetInputKey = targetInput.attributes.primary.toLowerCase();
	const sourceBindings = definition.bindings.filter(
		(current) => current.inputId.toLowerCase() === sourceInputKey,
	);
	const sourceBindingsByFieldName = new Map(
		sourceBindings.map((current) => [current.fieldName, current]),
	);
	const targetFieldNames = new Set(
		definition.bindings
			.filter((current) => current.inputId.toLowerCase() === targetInputKey)
			.map((current) => current.fieldName),
	);
	const bindings = definition.bindings.flatMap((current) => {
		if (current.inputId.toLowerCase() === sourceInputKey) {
			if (targetFieldNames.has(current.fieldName)) {
				return [];
			}
			const sourcePdfValue = current.valueMap?.true ?? "true";
			const sourceUnselectedPdfValue =
				current.valueMap?.false ?? (sourcePdfValue === "true" ? "false" : "");
			return [
				{
					...current,
					inputId: targetInput.attributes.primary,
					valueMap: Object.fromEntries(
						nextOptions.map((currentOption) => [
							currentOption,
							currentOption === option ? sourcePdfValue : sourceUnselectedPdfValue,
						]),
					),
				},
			];
		}
		if (current.inputId.toLowerCase() !== targetInputKey) {
			return [current];
		}
		const matchingSourceBinding = sourceBindingsByFieldName.get(current.fieldName);
		return [
			{
				...current,
				valueMap: Object.fromEntries(
					nextOptions.map((currentOption) => [
						currentOption,
						(currentOption === option && matchingSourceBinding
							? (matchingSourceBinding.valueMap?.true ?? "true")
							: current.valueMap?.[currentOption]) ??
							(Object.values(current.valueMap ?? {}).every((value) =>
								["true", "false"].includes(value),
							)
								? "false"
								: ""),
					]),
				),
			},
		];
	});
	return normalizeDocumentDefinition({
		bindings,
		inputs: definition.inputs
			.filter((input) => input !== sourceInput)
			.map((input) =>
				input === targetInput
					? {
							...targetInput,
							children: nextOptions.map((primary) => ({
								attributes: { primary },
								children: [],
								name: "Case" as const,
							})),
						}
					: input,
			),
	});
};
