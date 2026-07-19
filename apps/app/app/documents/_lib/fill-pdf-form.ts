import { PDFDocument, PDFName } from "pdf-lib";

import { canonicalizeInputValue, normalizeDocumentDefinition } from "./document-definition";
import type { DocumentBinding, DocumentDefinition, DocumentInput } from "./types";

interface PdfLibFormField {
	acroField?: {
		dict?: { set: (key: PDFName, value: PDFName) => void };
		getWidgets?: () => {
			getOnValue?: () => PDFName | undefined;
			setAppearanceState?: (value: PDFName) => void;
		}[];
	};
	check?: () => void;
	clear?: () => void;
	constructor: { name: string };
	select?: (value: string) => void;
	setText?: (value: string) => void;
	uncheck?: () => void;
}

interface DocumentFillFailure {
	fieldName: string;
	message: string;
}

export class DocumentFillError extends Error {
	readonly failures: DocumentFillFailure[];

	constructor(failures: DocumentFillFailure[]) {
		super(`PDF konnte in ${failures.length} Feld(ern) nicht ausgefüllt werden.`);
		this.name = "DocumentFillError";
		this.failures = failures;
	}
}

const toInputKey = (inputId: string): string => inputId.trim().toLowerCase();

const resolveBindingValue = (
	binding: DocumentBinding,
	input: DocumentInput,
	fieldValues: Record<string, unknown>,
): string => {
	const inputValue = canonicalizeInputValue(input, fieldValues[binding.inputId]);
	if (!inputValue || !binding.valueMap) {
		return inputValue;
	}
	if (!Object.hasOwn(binding.valueMap, inputValue)) {
		throw new Error(`Wert "${inputValue}" ist nicht für das PDF-Feld zugeordnet.`);
	}
	return binding.valueMap[inputValue] ?? "";
};

const setCheckboxValue = (field: PdfLibFormField, value: string): void => {
	const widgets = field.acroField?.getWidgets?.() ?? [];
	const distinctOnValues = new Set(
		widgets
			.map((widget) => widget.getOnValue?.()?.decodeText() ?? "")
			.filter((onValue) => onValue && onValue !== "Off"),
	);
	if (distinctOnValues.size > 1) {
		if (!value) {
			field.uncheck?.();
			return;
		}

		const selectedWidget = widgets.find(
			(widget) => (widget.getOnValue?.()?.decodeText() ?? "") === value,
		);
		const selectedValue = selectedWidget?.getOnValue?.();
		if (!selectedWidget || !selectedValue) {
			throw new Error(`Unbekannte Checkbox-Option "${value}".`);
		}

		field.acroField?.dict?.set(PDFName.of("V"), selectedValue);
		for (const widget of widgets) {
			widget.setAppearanceState?.(widget === selectedWidget ? selectedValue : PDFName.of("Off"));
		}
		return;
	}

	if (value && !["0", "false", "off"].includes(value.toLowerCase())) {
		field.check?.();
	} else {
		field.uncheck?.();
	}
};

const fillBoundField = (field: PdfLibFormField, value: string): void => {
	switch (field.constructor.name) {
		case "PDFCheckBox": {
			setCheckboxValue(field, value);
			return;
		}
		case "PDFDropdown":
		case "PDFOptionList":
		case "PDFRadioGroup": {
			if (value) {
				field.select?.(value);
			} else {
				field.clear?.();
			}
			return;
		}
		case "PDFTextField": {
			field.setText?.(value);
			return;
		}
		default: {
			throw new Error(`Nicht unterstützter PDF-Feldtyp: ${field.constructor.name}`);
		}
	}
};

const resolveFieldValue = (
	bindings: DocumentBinding[],
	field: PdfLibFormField,
	fieldValues: Record<string, unknown>,
	inputsByKey: Map<string, DocumentInput>,
): string => {
	const resolvedValues = bindings.map((binding) => {
		const input = inputsByKey.get(toInputKey(binding.inputId));
		if (!input) {
			throw new Error(`Eingabe "${binding.inputId}" ist nicht definiert.`);
		}
		return resolveBindingValue(binding, input, fieldValues);
	});
	if (bindings.length === 1) {
		return resolvedValues[0] ?? "";
	}
	if (
		field.constructor.name !== "PDFCheckBox" ||
		(field.acroField?.getWidgets?.().length ?? 0) <= 1
	) {
		throw new Error(
			"Mehrere Eingaben werden nur für PDF-Checkboxen mit mehreren Optionen unterstützt.",
		);
	}

	const selectedValues = [...new Set(resolvedValues.filter(Boolean))];
	if (selectedValues.length > 1) {
		throw new Error("Mehrere Checkbox-Eingaben wählen gleichzeitig unterschiedliche PDF-Werte.");
	}
	return selectedValues[0] ?? "";
};

export const fillPDFForm = async (
	file: Uint8Array,
	fieldValues: Record<string, unknown>,
	definition: DocumentDefinition,
): Promise<Uint8Array> => {
	const normalizedDefinition = normalizeDocumentDefinition(definition);
	const pdfDoc = await PDFDocument.load(new Uint8Array(file));
	const form = pdfDoc.getForm();
	const inputsByKey = new Map(
		normalizedDefinition.inputs.map((input) => [toInputKey(input.attributes.primary), input]),
	);
	const bindingsByFieldName = new Map<string, DocumentBinding[]>();
	for (const binding of normalizedDefinition.bindings) {
		if (!binding.isEnabled) {
			continue;
		}
		const fieldBindings = bindingsByFieldName.get(binding.fieldName) ?? [];
		fieldBindings.push(binding);
		bindingsByFieldName.set(binding.fieldName, fieldBindings);
	}
	const failures: DocumentFillFailure[] = [];

	for (const [fieldName, bindings] of bindingsByFieldName) {
		try {
			const field = form.getField(fieldName) as unknown as PdfLibFormField;
			fillBoundField(field, resolveFieldValue(bindings, field, fieldValues, inputsByKey));
		} catch (error) {
			failures.push({
				fieldName,
				message: error instanceof Error ? error.message : "Unbekannter Fehler",
			});
		}
	}

	if (failures.length > 0) {
		throw new DocumentFillError(failures);
	}

	return pdfDoc.save();
};
