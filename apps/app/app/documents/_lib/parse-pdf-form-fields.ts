import { PDFDocument } from "pdf-lib";

import { normalizeDocumentDefinition } from "./document-definition";
import {
	MAX_PDF_FORM_FIELD_COUNT,
	MAX_PDF_PAGE_COUNT,
	MAX_PDF_WIDGET_COUNT,
} from "./pdf-data";
import type { DocumentDefinition, DocumentInputKind, DocumentPdfType } from "./types";

export interface PdfFormField {
	fieldType: string;
	inputKind: DocumentInputKind;
	isExported: boolean;
	isReadOnly: boolean;
	isRequired: boolean;
	label: string;
	maxLength?: number;
	name: string;
	optionMappings?: PdfFormFieldOptionMapping[];
	options?: string[];
	type: DocumentPdfType;
	value?: string | string[];
	widgetCount: number;
}

export interface PdfFormFieldOptionMapping {
	inputValue: string;
	pdfValue: string;
}

interface PDFFormField {
	getMaxLength?: () => number | undefined;
	getOptions?: () => string[];
	getSelected?: () => string | string[];
	getText?: () => string;
	isChecked?: () => boolean;
	isMultiselect?: () => boolean;
	isMultiline?: () => boolean;
}

interface PdfLibFormField {
	acroField?: PdfLibAcroField;
	constructor: { name: string };
	getName: () => string;
	isExported?: () => boolean;
	isReadOnly?: () => boolean;
	isRequired?: () => boolean;
	check?: () => void;
	select?: (value: string) => void;
	setText?: (value: string) => void;
	uncheck?: () => void;
}

interface PdfLibAcroField {
	getValue?: () => PdfLibName | undefined;
	getWidgets?: () => PdfLibWidget[];
}

interface PdfLibName {
	decodeText: () => string;
}

interface PdfLibWidget {
	getOnValue?: () => PdfLibName | undefined;
}

type ParsedPdfFormField = Omit<
	PdfFormField,
	"fieldType" | "isExported" | "isReadOnly" | "isRequired" | "widgetCount"
>;

const parseTextField = (pdfFormField: PDFFormField, fieldName: string): ParsedPdfFormField => ({
	inputKind: "text",
	label: fieldName,
	maxLength: pdfFormField.getMaxLength?.(),
	name: fieldName,
	type: pdfFormField.isMultiline?.() ? "multiline" : "text",
	value: pdfFormField.getText?.() || "",
});

const getCheckboxWidgetOptions = (field: PdfLibFormField): PdfFormFieldOptionMapping[] => {
	const widgets = field.acroField?.getWidgets?.() ?? [];
	const options: PdfFormFieldOptionMapping[] = [];
	const seen = new Set<string>();

	for (const widget of widgets) {
		const pdfValue = widget.getOnValue?.()?.decodeText() ?? "";
		const inputValue = pdfValue.trim();
		if (!inputValue || inputValue === "Off" || seen.has(inputValue)) {
			continue;
		}
		seen.add(inputValue);
		options.push({ inputValue, pdfValue });
	}

	return options;
};

const parseCheckboxField = (
	pdfFormField: PDFFormField,
	pdfLibFormField: PdfLibFormField,
	fieldName: string,
): ParsedPdfFormField => {
	const widgetOptions = getCheckboxWidgetOptions(pdfLibFormField);
	if (widgetOptions.length > 1) {
		return {
			inputKind: "choice",
			label: fieldName,
			name: fieldName,
			optionMappings: widgetOptions,
			options: widgetOptions.map((option) => option.inputValue),
			type: "checkbox",
			value: pdfLibFormField.acroField?.getValue?.()?.decodeText() ?? "",
		};
	}

	return {
		inputKind: "boolean",
		label: fieldName,
		name: fieldName,
		optionMappings: widgetOptions,
		options: ["true", "false"],
		type: "checkbox",
		value: pdfFormField.isChecked?.() ? "true" : "false",
	};
};

const parseSelectableField = (
	pdfFormField: PDFFormField,
	fieldName: string,
	type: "dropdown" | "radio",
): ParsedPdfFormField => {
	const options = pdfFormField.getOptions?.() ?? [];
	const optionMappings = options.map((option) => ({ inputValue: option.trim(), pdfValue: option }));
	const selected = pdfFormField.getSelected?.() ?? [];
	const selectedValues = Array.isArray(selected) ? selected : [selected];
	const value = selectedValues.length > 1 ? selectedValues : selectedValues[0] || "";

	return {
		inputKind: "choice",
		label: fieldName,
		name: fieldName,
		optionMappings,
		options: optionMappings.map((option) => option.inputValue),
		type,
		value,
	};
};

const parseOptionListField = (
	pdfFormField: PDFFormField,
	fieldName: string,
): ParsedPdfFormField => {
	if (pdfFormField.isMultiselect?.()) {
		return {
			inputKind: "text",
			label: fieldName,
			name: fieldName,
			type: "unsupported",
		};
	}
	return parseSelectableField(pdfFormField, fieldName, "dropdown");
};

const pdfFieldParsers: Partial<
	Record<
		string,
		(
			pdfFormField: PDFFormField,
			pdfLibFormField: PdfLibFormField,
			fieldName: string,
		) => ParsedPdfFormField
	>
> = {
	PDFCheckBox: parseCheckboxField,
	PDFDropdown: (field, _pdfLibField, name) => parseSelectableField(field, name, "dropdown"),
	PDFOptionList: (field, _pdfLibField, name) => parseOptionListField(field, name),
	PDFRadioGroup: (field, _pdfLibField, name) => parseSelectableField(field, name, "radio"),
	PDFTextField: (field, _pdfLibField, name) => parseTextField(field, name),
};

const parseSingleFormField = (field: PdfLibFormField): PdfFormField => {
	const fieldName = field.getName();
	const fieldType = field.constructor.name;
	const parser = pdfFieldParsers[fieldType];
	const pdfFormField = field as unknown as PDFFormField;
	const parsedField = parser
		? parser(pdfFormField, field, fieldName)
		: {
				inputKind: "text" as const,
				label: fieldName,
				name: fieldName,
				type: "unsupported" as const,
			};

	return {
		...parsedField,
		fieldType,
		isExported: field.isExported?.() ?? true,
		isReadOnly: field.isReadOnly?.() ?? false,
		isRequired: field.isRequired?.() ?? false,
		widgetCount: field.acroField?.getWidgets?.().length ?? 0,
	};
};

const parseFormFieldsFromPDF = async (file: Uint8Array): Promise<PdfFormField[]> => {
	const stableBytes = new Uint8Array(file);
	const pdfDoc = await PDFDocument.load(stableBytes);
	if (pdfDoc.getPageCount() > MAX_PDF_PAGE_COUNT) {
		throw new Error(`PDFs dürfen höchstens ${MAX_PDF_PAGE_COUNT} Seiten enthalten.`);
	}
	const form = pdfDoc.getForm();
	const fields = form.getFields();
	if (fields.length > MAX_PDF_FORM_FIELD_COUNT) {
		throw new Error(`PDFs dürfen höchstens ${MAX_PDF_FORM_FIELD_COUNT} Formularfelder enthalten.`);
	}
	const widgetCount = fields.reduce(
		(total, field) =>
			total +
			((field as unknown as PdfLibFormField).acroField?.getWidgets?.().length ?? 0),
		0,
	);
	if (widgetCount > MAX_PDF_WIDGET_COUNT) {
		throw new Error(`PDFs dürfen höchstens ${MAX_PDF_WIDGET_COUNT} Formular-Widgets enthalten.`);
	}

	return fields.map((field) => parseSingleFormField(field as unknown as PdfLibFormField));
};

export const parsePDFFormFields = async (file: Uint8Array): Promise<{ fields: PdfFormField[] }> => {
	const fields = await parseFormFieldsFromPDF(file);
	return { fields };
};

const inferOptions = (field: PdfFormField): string[] => {
	if (field.inputKind === "boolean") {
		return ["true", "false"];
	}
	return field.options || [];
};

const getDefaultBindingValueMap = (
	field: PdfFormField,
): Record<string, string> | undefined => {
	if (field.inputKind === "choice") {
		return Object.fromEntries(
			(
				field.optionMappings ??
				(field.options ?? []).map((option) => ({
					inputValue: option,
					pdfValue: option,
				}))
			).map(({ inputValue, pdfValue }) => [inputValue, pdfValue]),
		);
	}
	if (field.inputKind === "boolean" && field.type === "checkbox") {
		return {
			false: "",
			true: field.optionMappings?.[0]?.pdfValue ?? "true",
		};
	}
	return undefined;
};

export const buildDefaultDocumentDefinitionFromPdfFields = (
	fields: PdfFormField[],
): DocumentDefinition =>
	normalizeDocumentDefinition({
		bindings: fields.map((field) => {
			const valueMap = getDefaultBindingValueMap(field);
			return {
				fieldName: field.name,
				inputId: field.name,
				isEnabled: !field.isReadOnly && field.type !== "unsupported",
				...(valueMap ? { valueMap } : {}),
			};
		}),
		inputs: fields.map((field) => {
			if (field.inputKind === "text") {
				return {
					attributes: { primary: field.name, type: "string" },
					children: [],
					name: "Info" as const,
				};
			}

			const options = inferOptions(field);
			return {
				attributes: {
					primary: field.name,
					...(field.inputKind === "boolean" ? { type: "boolean" as const } : {}),
				},
				children: options.map((option) => ({
					attributes: { primary: option },
					children: [],
					name: "Case" as const,
				})),
				name: "Switch" as const,
			};
		}),
	});
