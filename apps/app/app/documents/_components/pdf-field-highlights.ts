import type { DocumentBinding, DocumentDefinition } from "@/app/documents/_lib";

interface PdfFieldWidgetMetadata {
	name: string;
	widgetCount: number;
}

interface PdfFieldLookupOptions {
	includeDisabled?: boolean;
}

export interface PdfFieldHighlight {
	fieldName: string;
	widgetValues?: string[];
}

const getWidgetValues = (
	binding: DocumentBinding,
	pdfField: PdfFieldWidgetMetadata | undefined,
	isPdfFieldMetadataAvailable: boolean,
): string[] | undefined => {
	if (isPdfFieldMetadataAvailable && (!pdfField || pdfField.widgetCount <= 1)) {
		return undefined;
	}

	const widgetValues = [
		...new Set(Object.values(binding.valueMap ?? {}).filter((value) => value.length > 0)),
	];
	return widgetValues.length > 0 ? widgetValues : undefined;
};

export const getPdfFieldHighlightsForInput = (
	definition: DocumentDefinition,
	pdfFields: readonly PdfFieldWidgetMetadata[] | undefined,
	inputId: string | null,
	options: PdfFieldLookupOptions = {},
): PdfFieldHighlight[] => {
	if (!inputId) {
		return [];
	}

	const pdfFieldsByName = new Map(pdfFields?.map((field) => [field.name, field]));
	const highlightsByFieldName = new Map<string, PdfFieldHighlight>();
	for (const binding of definition.bindings) {
		if (
			(!options.includeDisabled && !binding.isEnabled) ||
			binding.inputId.toLowerCase() !== inputId.toLowerCase()
		) {
			continue;
		}

		const widgetValues = getWidgetValues(
			binding,
			pdfFieldsByName.get(binding.fieldName),
			pdfFields !== undefined,
		);
		const existingHighlight = highlightsByFieldName.get(binding.fieldName);
		if (!existingHighlight) {
			highlightsByFieldName.set(binding.fieldName, {
				fieldName: binding.fieldName,
				...(widgetValues ? { widgetValues } : {}),
			});
			continue;
		}
		if (!existingHighlight.widgetValues || !widgetValues) {
			highlightsByFieldName.set(binding.fieldName, { fieldName: binding.fieldName });
			continue;
		}

		existingHighlight.widgetValues = [
			...new Set([...existingHighlight.widgetValues, ...widgetValues]),
		];
	}

	return [...highlightsByFieldName.values()];
};

export const getInputIdForPdfWidget = (
	definition: DocumentDefinition,
	fieldName: string,
	widgetValue?: string,
	options: PdfFieldLookupOptions = {},
): string | undefined => {
	const matchingBindings = definition.bindings.filter(
		(binding) => binding.fieldName === fieldName && (options.includeDisabled || binding.isEnabled),
	);
	if (!widgetValue) {
		return matchingBindings[0]?.inputId;
	}

	return (
		matchingBindings.find((binding) => Object.values(binding.valueMap ?? {}).includes(widgetValue))
			?.inputId ?? matchingBindings[0]?.inputId
	);
};
