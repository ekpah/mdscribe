import { describe, expect, test } from "bun:test";

import type { DocumentDefinition, PdfFormField } from "@/app/documents/_lib";
import {
	validateDocumentDefinitionAgainstPdfFields,
	validateDocumentDefinitionPreservesPdfFields,
} from "@/app/documents/_lib/pdf-definition-validation";

const textField: PdfFormField = {
	fieldType: "PDFTextField",
	inputKind: "text",
	isExported: true,
	isReadOnly: false,
	isRequired: false,
	label: "patient_name",
	name: "patient_name",
	type: "text",
	widgetCount: 1,
};

const definition: DocumentDefinition = {
	bindings: [{ fieldName: "patient_name", inputId: "Patient", isEnabled: true }],
	inputs: [
		{
			attributes: { primary: "Patient", type: "string" },
			children: [],
			name: "Info",
		},
	],
};

describe("PDF document definition validation", () => {
	test("accepts definitions that bind known compatible PDF fields", () => {
		expect(() => validateDocumentDefinitionAgainstPdfFields(definition, [textField])).not.toThrow();
	});

	test("rejects invented PDF fields even when their binding is disabled", () => {
		const proposed: DocumentDefinition = {
			bindings: [{ fieldName: "invented", inputId: "Patient", isEnabled: false }],
			inputs: definition.inputs,
		};

		expect(() => validateDocumentDefinitionAgainstPdfFields(proposed, [textField])).toThrow(
			'PDF-Feld "invented" wurde nicht gefunden.',
		);
	});

	test("rejects AI proposals that remove or add PDF field names", () => {
		expect(() =>
			validateDocumentDefinitionPreservesPdfFields(definition, { bindings: [], inputs: [] }, [
				textField,
			]),
		).toThrow('Der KI-Vorschlag hat das PDF-Feld "patient_name" entfernt.');

		expect(() =>
			validateDocumentDefinitionPreservesPdfFields(
				definition,
				{
					bindings: [
						...definition.bindings,
						{ fieldName: "invented", inputId: "Patient", isEnabled: false },
					],
					inputs: definition.inputs,
				},
				[textField],
			),
		).toThrow('Der KI-Vorschlag hat das unbekannte PDF-Feld "invented" ergänzt.');
	});

	test("preserves field activation while allowing binding restructuring", () => {
		const disabledProposal: DocumentDefinition = {
			bindings: [{ fieldName: "patient_name", inputId: "Patient", isEnabled: false }],
			inputs: definition.inputs,
		};

		expect(() =>
			validateDocumentDefinitionPreservesPdfFields(definition, disabledProposal, [textField]),
		).toThrow('Der KI-Vorschlag hat die Aktivierung von "patient_name" verändert.');
	});

	test("rejects checkbox export values not present in PDF widget metadata", () => {
		const checkboxField: PdfFormField = {
			...textField,
			fieldType: "PDFCheckBox",
			inputKind: "boolean",
			name: "consent",
			optionMappings: [{ inputValue: "Yes", pdfValue: "Yes" }],
			type: "checkbox",
		};
		const checkboxDefinition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "consent",
					inputId: "Einwilligung",
					isEnabled: true,
					valueMap: { false: "", true: "invented" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Einwilligung", type: "boolean" },
					children: [],
					name: "Switch",
				},
			],
		};

		expect(() =>
			validateDocumentDefinitionAgainstPdfFields(checkboxDefinition, [checkboxField]),
		).toThrow('Eingabe "Einwilligung" passt nicht zum PDF-Feld "consent".');
	});
});
