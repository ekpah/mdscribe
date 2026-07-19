import { describe, expect, test } from "bun:test";

import { PDFDocument } from "pdf-lib";

import {
	canonicalizeInputValue,
	documentDefinitionSchema,
	fillPDFForm,
	getEnabledDocumentInputs,
	normalizeDocumentDefinition,
} from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";

const definition: DocumentDefinition = {
	bindings: [
		{ fieldName: "name", inputId: "Patient", isEnabled: true },
		{
			fieldName: "visual_check",
			inputId: "Einwilligung",
			isEnabled: true,
			valueMap: { false: "", true: "X" },
		},
		{
			fieldName: "priority",
			inputId: "Prioritaet",
			isEnabled: true,
			valueMap: { hoch: "high", niedrig: "low" },
		},
	],
	inputs: [
		{
			attributes: { primary: "Patient", type: "string" },
			children: [],
			name: "Info",
		},
		{
			attributes: { primary: "Einwilligung", type: "boolean" },
			children: [],
			name: "Switch",
		},
		{
			attributes: { primary: "Prioritaet" },
			children: ["niedrig", "hoch"].map((primary) => ({
				attributes: { primary },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		},
	],
};

const getDefinitionInput = (index: number) => {
	const input = definition.inputs.at(index);
	if (!input) {
		throw new Error(`Missing document input at index ${index}`);
	}
	return input;
};

describe("document definition", () => {
	test("keeps inputs separate from PDF bindings", () => {
		const normalized = normalizeDocumentDefinition(definition);
		expect(normalized.inputs.map((input) => input.attributes.primary)).toEqual([
			"Patient",
			"Einwilligung",
			"Prioritaet",
		]);
		expect(normalized.bindings).toHaveLength(3);
	});

	test("uses inputId as the runtime value key and applies explicit PDF value maps", async () => {
		const pdf = await PDFDocument.create();
		const page = pdf.addPage([500, 500]);
		const form = pdf.getForm();
		form.createTextField("name").addToPage(page, { height: 20, width: 180, x: 30, y: 430 });
		form.createTextField("visual_check").addToPage(page, { height: 20, width: 20, x: 30, y: 390 });
		const priority = form.createRadioGroup("priority");
		priority.addOptionToPage("low", page, { height: 15, width: 15, x: 30, y: 350 });
		priority.addOptionToPage("high", page, { height: 15, width: 15, x: 90, y: 350 });

		const filled = await fillPDFForm(
			await pdf.save(),
			{
				Einwilligung: true,
				Patient: "Max Mustermann",
				Prioritaet: "hoch",
			},
			definition,
		);
		const result = await PDFDocument.load(filled);
		const resultForm = result.getForm();
		expect(resultForm.getTextField("name").getText()).toBe("Max Mustermann");
		expect(resultForm.getTextField("visual_check").getText()).toBe("X");
		expect(resultForm.getRadioGroup("priority").getSelected()).toBe("high");
	});

	test("allows multiple PDF fields to share one inputId", () => {
		const normalized = normalizeDocumentDefinition({
			bindings: [
				{ fieldName: "name", inputId: "Patient", isEnabled: true },
				{ fieldName: "name_copy", inputId: "patient", isEnabled: true },
			],
			inputs: [getDefinitionInput(0)],
		});

		expect(normalized.bindings.map((binding) => binding.inputId)).toEqual(["Patient", "Patient"]);
	});

	test("allows one PDF checkbox field to use multiple distinct boolean inputs", () => {
		const normalized = normalizeDocumentDefinition({
			bindings: [
				{
					fieldName: "request_type",
					inputId: "Reha",
					isEnabled: true,
					valueMap: { false: "", true: "Reha" },
				},
				{
					fieldName: "request_type",
					inputId: "LTA",
					isEnabled: true,
					valueMap: { false: "", true: "LTA" },
				},
			],
			inputs: ["Reha", "LTA"].map((primary) => ({
				attributes: { primary, type: "boolean" as const },
				children: [],
				name: "Switch" as const,
			})),
		});

		expect(normalized.bindings.map((binding) => binding.fieldName)).toEqual([
			"request_type",
			"request_type",
		]);
	});

	test("rejects the same input being bound to the same PDF field twice", () => {
		expect(() =>
			normalizeDocumentDefinition({
				bindings: [
					{ fieldName: "name", inputId: "Patient", isEnabled: true },
					{ fieldName: "name", inputId: "patient", isEnabled: true },
				],
				inputs: [getDefinitionInput(0)],
			}),
		).toThrow('PDF-Feld "name" ist der Eingabe "Patient" mehrfach zugeordnet');
	});

	test("only exposes inputs referenced by enabled bindings", () => {
		const enabledInputs = getEnabledDocumentInputs({
			bindings: definition.bindings.map((binding) => ({
				...binding,
				isEnabled: binding.fieldName === "name",
			})),
			inputs: definition.inputs,
		});

		expect(enabledInputs.map((input) => input.attributes.primary)).toEqual(["Patient"]);
	});

	test("rejects bindings without a corresponding input", () => {
		expect(() =>
			normalizeDocumentDefinition({
				bindings: [{ fieldName: "name", inputId: "Unbekannt", isEnabled: true }],
				inputs: [],
			}),
		).toThrow('Eingabe "Unbekannt" ist nicht definiert');
	});

	test("rejects obsolete schema properties instead of adapting them", () => {
		expect(documentDefinitionSchema.safeParse({ ...definition, version: 2 }).success).toBe(false);
	});

	test("requires complete value maps for choice and boolean inputs", () => {
		expect(() =>
			normalizeDocumentDefinition({
				bindings: [
					{
						fieldName: "priority",
						inputId: "Prioritaet",
						isEnabled: true,
						valueMap: { hoch: "high" },
					},
				],
				inputs: [getDefinitionInput(2)],
			}),
		).toThrow('Wert "niedrig" fehlt');
	});

	test("rejects obsolete and colliding value map keys", () => {
		const definitionWithObsoleteMap: DocumentDefinition = {
			bindings: [
				{
					fieldName: "status",
					inputId: "Status",
					isEnabled: true,
					valueMap: { closed: "closed", obsolete: "old", open: "open" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Status" },
					children: ["open", "closed"].map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
			],
		};

		expect(() => normalizeDocumentDefinition(definitionWithObsoleteMap)).toThrow(
			'Wert "obsolete" gehört nicht zur Eingabe "Status"',
		);
		expect(() =>
			normalizeDocumentDefinition({
				...definitionWithObsoleteMap,
				bindings: [
					{
						fieldName: "status",
						inputId: "Status",
						isEnabled: true,
						valueMap: { " open": "one", closed: "closed", open: "two" },
					},
				],
			}),
		).toThrow('PDF-Wertzuordnung enthält den Wert "open" mehrfach');
	});

	test("canonicalizes tolerant boolean values", () => {
		const booleanInput = getDefinitionInput(1);
		for (const truthyValue of [true, "true", "ja", "1", "yes", " Ja "]) {
			expect(canonicalizeInputValue(booleanInput, truthyValue)).toBe("true");
		}
		for (const falsyValue of [false, "false", "nein", "", undefined]) {
			expect(canonicalizeInputValue(booleanInput, falsyValue)).toBe("false");
		}
	});
});
