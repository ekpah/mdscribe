import { describe, expect, test } from "bun:test";

import { PDFDocument } from "pdf-lib";

import {
	fillPDFForm,
	matchesCondition,
	normalizeDocumentDefinition,
} from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";

const definition: DocumentDefinition = {
	fieldMappings: [
		{ fieldName: "name", isEnabled: true, pdfType: "text", variable: "Patient" },
		{ condition: "true", fieldName: "visual_check", isEnabled: true, pdfType: "text", value: "X", variable: "Einwilligung" },
		{ condition: "hoch", fieldName: "priority", isEnabled: true, pdfType: "radio", value: "high", variable: "Prioritaet" },
		{ condition: "niedrig", fieldName: "priority", isEnabled: true, pdfType: "radio", value: "low", variable: "Prioritaet" },
	],
	inputTags: [
		{
			attributes: { primary: "Patient", type: "string" },
			children: [],
			name: "Info",
		},
		{
			attributes: { primary: "Einwilligung", type: "boolean" },
			children: ["true", "false"].map((primary) => ({
				attributes: { primary }, children: [], name: "Case" as const,
			})),
			name: "Switch",
		},
		{
			attributes: { primary: "Prioritaet" },
			children: ["niedrig", "hoch"].map((primary) => ({
				attributes: { primary }, children: [], name: "Case" as const,
			})),
			name: "Switch",
		},
	],
	version: 2,
};

describe("document definition", () => {
	test("keeps input tags separate from PDF mappings", () => {
		const normalized = normalizeDocumentDefinition(definition);
		expect(normalized.inputTags.map((tag) => tag.attributes.primary)).toEqual([
			"Patient",
			"Einwilligung",
			"Prioritaet",
		]);
		expect(normalized.fieldMappings).toHaveLength(4);
	});

	test("writes mapping values only when the mapping condition matches", async () => {
		const pdf = await PDFDocument.create();
		const page = pdf.addPage([500, 500]);
		const form = pdf.getForm();
		form.createTextField("name").addToPage(page, { height: 20, width: 180, x: 30, y: 430 });
		form.createTextField("visual_check").addToPage(page, { height: 20, width: 20, x: 30, y: 390 });
		const priority = form.createRadioGroup("priority");
		priority.addOptionToPage("low", page, { height: 15, width: 15, x: 30, y: 350 });
		priority.addOptionToPage("high", page, { height: 15, width: 15, x: 90, y: 350 });

		const filled = await fillPDFForm(await pdf.save(), {
			Einwilligung: true,
			Patient: "Max Mustermann",
			Prioritaet: "hoch",
		}, definition);
		const result = await PDFDocument.load(filled);
		const resultForm = result.getForm();
		expect(resultForm.getTextField("name").getText()).toBe("Max Mustermann");
		expect(resultForm.getTextField("visual_check").getText()).toBe("X");
		expect(resultForm.getRadioGroup("priority").getSelected()).toBe("high");
	});

	test("rejects an enabled mapping without an input variable", () => {
		expect(() =>
			normalizeDocumentDefinition({
			...definition,
			fieldMappings: [{ fieldName: "name", isEnabled: true, pdfType: "text", variable: "Unbekannt" }],
		}),
	).toThrow('Variable "Unbekannt" ist nicht als Eingabe definiert');
	});

	test("matchesCondition canonicalizes boolean switch values", () => {
		const [, booleanTag] = definition.inputTags;
		for (const truthyValue of [true, "true", "ja", "1", "yes", " Ja "]) {
			expect(matchesCondition(booleanTag, truthyValue, "true")).toBe(true);
			expect(matchesCondition(booleanTag, truthyValue, "false")).toBe(false);
		}
		for (const falsyValue of [false, "false", "nein", "", undefined]) {
			expect(matchesCondition(booleanTag, falsyValue, "false")).toBe(true);
			expect(matchesCondition(booleanTag, falsyValue, "true")).toBe(false);
		}
	});

	test("matchesCondition compares non-boolean inputs exactly", () => {
		const choiceTag = definition.inputTags.find(
			(tag) => tag.attributes.primary === "Prioritaet",
		);
		expect(matchesCondition(choiceTag, "hoch", "hoch")).toBe(true);
		expect(matchesCondition(choiceTag, "Hoch", "hoch")).toBe(false);
		expect(matchesCondition(undefined, "42", "42")).toBe(true);
	});

	test("fills a text-backed checkbox from tolerant boolean input", async () => {
		const pdf = await PDFDocument.create();
		const page = pdf.addPage([500, 500]);
		const form = pdf.getForm();
		form.createTextField("visual_check").addToPage(page, { height: 20, width: 20, x: 30, y: 390 });

		const checkboxDefinition: DocumentDefinition = {
			...definition,
			fieldMappings: definition.fieldMappings.filter(
				(mapping) => mapping.fieldName === "visual_check",
			),
		};

		const filled = await fillPDFForm(await pdf.save(), { Einwilligung: "ja" }, checkboxDefinition);
		const result = await PDFDocument.load(filled);
		expect(result.getForm().getTextField("visual_check").getText()).toBe("X");

		const cleared = await fillPDFForm(filled, { Einwilligung: "nein" }, checkboxDefinition);
		const clearedResult = await PDFDocument.load(cleared);
		expect(clearedResult.getForm().getTextField("visual_check").getText() ?? "").toBe("");
	});
});
