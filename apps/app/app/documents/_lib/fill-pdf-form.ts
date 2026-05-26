import { PDFDocument, PDFName } from "pdf-lib";

import type { DocumentFieldDefinition } from "./types";

interface PdfLibFormField {
	acroField?: {
		dict?: {
			set: (key: PDFName, value: PDFName) => void;
		};
		getWidgets?: () => Array<{
			getOnValue?: () => PDFName | undefined;
			setAppearanceState?: (value: PDFName) => void;
		}>;
	};
	check?: () => void;
	constructor: { name: string };
	select?: (value: string) => void;
	setText?: (value: string) => void;
	uncheck?: () => void;
}

const toStringValue = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}
	return value?.toString() || "";
};

const toCheckboxState = (value: string): boolean => {
	const normalized = value.trim().toLowerCase();
	return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "ja";
};

const toLabelKey = (label: string): string => label.trim().toLowerCase();

const normalizePdfOption = (value: string): string => value.trim();

const createFieldDefinitionsByLabelMap = (fieldDefinitions: DocumentFieldDefinition[]) => {
	const map = new Map<string, DocumentFieldDefinition[]>();
	for (const definition of fieldDefinitions) {
		const key = toLabelKey(definition.label);
		const current = map.get(key) ?? [];
		current.push(definition);
		map.set(key, current);
	}
	return map;
};

const fieldValueHandlers: Partial<
	Record<
		string,
		(field: PdfLibFormField, value: string, definition: DocumentFieldDefinition) => void
	>
> = {
	PDFCheckBox: (field, value, definition) => {
		if (definition.inputKind === "choice") {
			const normalizedValue = normalizePdfOption(value);
			const selectedOptionIndex = definition.options
				.map(normalizePdfOption)
				.indexOf(normalizedValue);
			if (selectedOptionIndex === -1) {
				console.warn(`Unknown checkbox option "${value}" for ${definition.fieldName}`);
				return;
			}

			const widgets = field.acroField?.getWidgets?.() ?? [];
			const selectedWidget =
				widgets[selectedOptionIndex] ??
				widgets.find(
					(widget) =>
						normalizePdfOption(widget.getOnValue?.()?.decodeText() ?? "") === normalizedValue,
				);
			const selectedValue = selectedWidget?.getOnValue?.();

			if (!selectedValue) {
				console.warn(`Missing checkbox widget option "${value}" for ${definition.fieldName}`);
				return;
			}

			field.acroField?.dict?.set(PDFName.of("V"), selectedValue);
			for (const [widgetIndex, widget] of widgets.entries()) {
				widget.setAppearanceState?.(
					widgetIndex === selectedOptionIndex ? selectedValue : PDFName.of("Off"),
				);
			}
			return;
		}

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
	PDFTextField: (field, value, definition) => {
		if (definition.inputKind === "boolean" && definition.pdfType === "text") {
			field.setText?.(toCheckboxState(value) ? definition.textCheckboxValue?.trim() || "x" : "");
			return;
		}
		field.setText?.(value);
	},
};

export const fillPDFForm = async (
	file: Uint8Array,
	fieldValues: Record<string, unknown>,
	fieldDefinitions: DocumentFieldDefinition[],
): Promise<Uint8Array> => {
	const stableBytes = new Uint8Array(file);
	const pdfDoc = await PDFDocument.load(stableBytes);
	const form = pdfDoc.getForm();
	const fieldDefinitionsByLabel = createFieldDefinitionsByLabelMap(fieldDefinitions);

	for (const [label, fieldValue] of Object.entries(fieldValues)) {
		const mappedFieldDefinitions = fieldDefinitionsByLabel.get(toLabelKey(label));
		if (!mappedFieldDefinitions) continue;

		for (const fieldDefinition of mappedFieldDefinitions) {
			try {
				const field = form.getField(fieldDefinition.fieldName) as unknown as PdfLibFormField;
				const stringValue = toStringValue(fieldValue);
				const handler = fieldValueHandlers[field.constructor.name];
				if (!handler) {
					console.warn(
						`Unknown field type: ${field.constructor.name} for ${fieldDefinition.fieldName}`,
					);
					continue;
				}
				handler(field, stringValue, fieldDefinition);
			} catch (error) {
				console.error(`Error filling field ${fieldDefinition.fieldName} (label: ${label}):`, error);
			}
		}
	}

	return pdfDoc.save();
};
