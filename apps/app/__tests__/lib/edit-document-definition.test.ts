import { describe, expect, test } from "bun:test";

import {
	getBooleanBindingValueMap,
	mergeCheckboxBindingIntoChoice,
	splitCheckboxOption,
} from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";

const choiceDefinition: DocumentDefinition = {
	bindings: [
		{
			fieldName: "request_type",
			inputId: "Antragstyp",
			isEnabled: true,
			valueMap: { LTA: "Teilhabe am Arbeitsleben (LTA) ", Reha: "Reha" },
		},
	],
	inputs: [
		{
			attributes: { primary: "Antragstyp" },
			children: ["Reha", "LTA"].map((primary) => ({
				attributes: { primary },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		},
	],
};

const choicePdfFields = [{ name: "request_type", widgetCount: 2 }];

describe("document definition editor transforms", () => {
	test("preserves the raw PDF export value when converting a checkbox back to boolean", () => {
		expect(
			getBooleanBindingValueMap({
				currentValueMap: { Patient: "Ja" },
				pdfOptionMappings: [{ pdfValue: "Yes" }],
				pdfType: "checkbox",
			}),
		).toEqual({ false: "", true: "Yes" });
	});

	test("detaches one multi-widget checkbox option as a boolean input", () => {
		const result = splitCheckboxOption(choiceDefinition, "Antragstyp", "LTA", choicePdfFields);

		expect(result.inputs.map((input) => input.attributes.primary)).toEqual(["Antragstyp", "LTA"]);
		expect(result.inputs[0]?.children.map((child) => child.attributes.primary)).toEqual(["Reha"]);
		expect(result.inputs[1]?.attributes.type).toBe("boolean");
		expect(result.bindings).toEqual([
			{
				fieldName: "request_type",
				inputId: "Antragstyp",
				isEnabled: true,
				valueMap: { Reha: "Reha" },
			},
			{
				fieldName: "request_type",
				inputId: "LTA",
				isEnabled: true,
				valueMap: { false: "", true: "Teilhabe am Arbeitsleben (LTA) " },
			},
		]);
	});

	test("adds a detached multi-widget checkbox option back to its shared switch", () => {
		const detached = splitCheckboxOption(choiceDefinition, "Antragstyp", "LTA", choicePdfFields);
		const result = mergeCheckboxBindingIntoChoice(detached, 1, "Antragstyp");

		expect(result).toEqual(choiceDefinition);
	});

	test("groups separate PDF checkboxes under one choice input", () => {
		const result = mergeCheckboxBindingIntoChoice(
			{
				bindings: [
					{
						fieldName: "reha",
						inputId: "Antragstyp",
						isEnabled: true,
						valueMap: { Reha: "true" },
					},
					{ fieldName: "lta", inputId: "LTA", isEnabled: true },
				],
				inputs: [
					{
						attributes: { primary: "Antragstyp" },
						children: [{ attributes: { primary: "Reha" }, children: [], name: "Case" }],
						name: "Switch",
					},
					{
						attributes: { primary: "LTA", type: "boolean" },
						children: [],
						name: "Switch",
					},
				],
			},
			1,
			"Antragstyp",
		);

		expect(result.inputs).toHaveLength(1);
		expect(result.inputs[0]?.children.map((option) => option.attributes.primary)).toEqual([
			"Reha",
			"LTA",
		]);
		expect(result.bindings).toEqual([
			{
				fieldName: "reha",
				inputId: "Antragstyp",
				isEnabled: true,
				valueMap: { LTA: "false", Reha: "true" },
			},
			{
				fieldName: "lta",
				inputId: "Antragstyp",
				isEnabled: true,
				valueMap: { LTA: "true", Reha: "false" },
			},
		]);
	});

	test("groups visual checkboxes backed by PDF text fields", () => {
		const result = mergeCheckboxBindingIntoChoice(
			{
				bindings: [
					{
						fieldName: "visual_checkbox_a",
						inputId: "Auswahl",
						isEnabled: true,
						valueMap: { Erste: "x" },
					},
					{
						fieldName: "visual_checkbox_b",
						inputId: "Zweite",
						isEnabled: true,
						valueMap: { false: "", true: "x" },
					},
				],
				inputs: [
					{
						attributes: { primary: "Auswahl" },
						children: [{ attributes: { primary: "Erste" }, children: [], name: "Case" }],
						name: "Switch",
					},
					{
						attributes: { primary: "Zweite", type: "boolean" },
						children: [],
						name: "Switch",
					},
				],
			},
			1,
			"Auswahl",
		);

		expect(result.inputs).toHaveLength(1);
		expect(result.inputs[0]?.children.map((option) => option.attributes.primary)).toEqual([
			"Erste",
			"Zweite",
		]);
		expect(result.bindings).toEqual([
			{
				fieldName: "visual_checkbox_a",
				inputId: "Auswahl",
				isEnabled: true,
				valueMap: { Erste: "x", Zweite: "" },
			},
			{
				fieldName: "visual_checkbox_b",
				inputId: "Auswahl",
				isEnabled: true,
				valueMap: { Erste: "", Zweite: "x" },
			},
		]);
	});

	test("detaches a PDF text-backed option with a blank unchecked value", () => {
		const grouped: DocumentDefinition = {
			bindings: [
				{
					fieldName: "visual_checkbox_a",
					inputId: "Auswahl",
					isEnabled: true,
					valueMap: { Erste: "x", Zweite: "" },
				},
				{
					fieldName: "visual_checkbox_b",
					inputId: "Auswahl",
					isEnabled: true,
					valueMap: { Erste: "", Zweite: "x" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Auswahl" },
					children: ["Erste", "Zweite"].map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
			],
		};

		const result = splitCheckboxOption(grouped, "Auswahl", "Zweite", [
			{ name: "visual_checkbox_a", type: "text", widgetCount: 1 },
			{ name: "visual_checkbox_b", type: "text", widgetCount: 1 },
		]);

		expect(result.bindings).toEqual([
			{
				fieldName: "visual_checkbox_a",
				inputId: "Auswahl",
				isEnabled: true,
				valueMap: { Erste: "x" },
			},
			{
				fieldName: "visual_checkbox_b",
				inputId: "Zweite",
				isEnabled: true,
				valueMap: { false: "", true: "x" },
			},
		]);
	});

	test("detaches a grouped PDF checkbox back into its own boolean input", () => {
		const grouped = mergeCheckboxBindingIntoChoice(
			{
				bindings: [
					{
						fieldName: "reha",
						inputId: "Antragstyp",
						isEnabled: true,
						valueMap: { Reha: "true" },
					},
					{ fieldName: "lta", inputId: "LTA", isEnabled: true },
				],
				inputs: [
					{
						attributes: { primary: "Antragstyp" },
						children: [{ attributes: { primary: "Reha" }, children: [], name: "Case" }],
						name: "Switch",
					},
					{
						attributes: { primary: "LTA", type: "boolean" },
						children: [],
						name: "Switch",
					},
				],
			},
			1,
			"Antragstyp",
		);

		const result = splitCheckboxOption(grouped, "Antragstyp", "LTA", [
			{ name: "lta", widgetCount: 1 },
			{ name: "reha", widgetCount: 1 },
		]);

		expect(result.inputs.map((input) => input.attributes.primary)).toEqual(["Antragstyp", "LTA"]);
		expect(result.bindings).toEqual([
			{
				fieldName: "reha",
				inputId: "Antragstyp",
				isEnabled: true,
				valueMap: { Reha: "true" },
			},
			{
				fieldName: "lta",
				inputId: "LTA",
				isEnabled: true,
				valueMap: { false: "false", true: "true" },
			},
		]);
	});

	test("detaches a separate PDF checkbox added to a multi-widget choice", () => {
		const source: DocumentDefinition = {
			bindings: [
				...choiceDefinition.bindings,
				{
					fieldName: "urgent",
					inputId: "Dringend",
					isEnabled: true,
					valueMap: { false: "false", true: "true" },
				},
			],
			inputs: [
				...choiceDefinition.inputs,
				{
					attributes: { primary: "Dringend", type: "boolean" },
					children: ["true", "false"].map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
			],
		};
		const grouped = mergeCheckboxBindingIntoChoice(source, 1, "Antragstyp");

		const result = splitCheckboxOption(grouped, "Antragstyp", "Dringend", [
			{ name: "request_type", widgetCount: 2 },
			{ name: "urgent", widgetCount: 1 },
		]);

		expect(result).toEqual(source);
	});

	test("uses PDF widget metadata when an option export value is true", () => {
		const definition: DocumentDefinition = {
			bindings: [
				{
					fieldName: "request_type",
					inputId: "Antragstyp",
					isEnabled: true,
					valueMap: { Andere: "Andere", Zustimmung: "true" },
				},
			],
			inputs: [
				{
					attributes: { primary: "Antragstyp" },
					children: ["Zustimmung", "Andere"].map((primary) => ({
						attributes: { primary },
						children: [],
						name: "Case" as const,
					})),
					name: "Switch",
				},
			],
		};

		const result = splitCheckboxOption(definition, "Antragstyp", "Zustimmung", [
			{ name: "request_type", widgetCount: 2 },
		]);

		expect(result.bindings).toEqual([
			{
				fieldName: "request_type",
				inputId: "Antragstyp",
				isEnabled: true,
				valueMap: { Andere: "Andere" },
			},
			{
				fieldName: "request_type",
				inputId: "Zustimmung",
				isEnabled: true,
				valueMap: { false: "", true: "true" },
			},
		]);
	});

	test("allows detaching the final choice option", () => {
		const firstSplit = splitCheckboxOption(
			choiceDefinition,
			"Antragstyp",
			"LTA",
			choicePdfFields,
		);
		const result = splitCheckboxOption(firstSplit, "Antragstyp", "Reha", choicePdfFields);

		expect(result.inputs.map((input) => input.attributes.primary)).toEqual(["Reha", "LTA"]);
		expect(result.bindings).toEqual([
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
				valueMap: { false: "", true: "Teilhabe am Arbeitsleben (LTA) " },
			},
		]);
	});

	test("moves every PDF field owned by a boolean input into the target choice", () => {
		const result = mergeCheckboxBindingIntoChoice(
			{
				bindings: [
					{
						fieldName: "target",
						inputId: "Auswahl",
						isEnabled: true,
						valueMap: { Bestehend: "true" },
					},
					{
						fieldName: "source_a",
						inputId: "Gemeinsam",
						isEnabled: true,
						valueMap: { false: "", true: "Yes" },
					},
					{
						fieldName: "source_b",
						inputId: "Gemeinsam",
						isEnabled: true,
						valueMap: { false: "", true: "X" },
					},
				],
				inputs: [
					{
						attributes: { primary: "Auswahl" },
						children: [
							{ attributes: { primary: "Bestehend" }, children: [], name: "Case" },
						],
						name: "Switch",
					},
					{
						attributes: { primary: "Gemeinsam", type: "boolean" },
						children: [],
						name: "Switch",
					},
				],
			},
			1,
			"Auswahl",
		);

		expect(result.inputs.map((input) => input.attributes.primary)).toEqual(["Auswahl"]);
		expect(result.bindings).toEqual([
			{
				fieldName: "target",
				inputId: "Auswahl",
				isEnabled: true,
				valueMap: { Bestehend: "true", Gemeinsam: "false" },
			},
			{
				fieldName: "source_a",
				inputId: "Auswahl",
				isEnabled: true,
				valueMap: { Bestehend: "", Gemeinsam: "Yes" },
			},
			{
				fieldName: "source_b",
				inputId: "Auswahl",
				isEnabled: true,
				valueMap: { Bestehend: "", Gemeinsam: "X" },
			},
		]);
	});

	test("keeps every PDF field owned by a split choice option", () => {
		const result = splitCheckboxOption(
			{
				bindings: [
					{
						fieldName: "first",
						inputId: "Auswahl",
						isEnabled: true,
						valueMap: { Andere: "", Gemeinsam: "X" },
					},
					{
						fieldName: "second",
						inputId: "Auswahl",
						isEnabled: true,
						valueMap: { Andere: "", Gemeinsam: "Y" },
					},
				],
				inputs: [
					{
						attributes: { primary: "Auswahl" },
						children: ["Andere", "Gemeinsam"].map((primary) => ({
							attributes: { primary },
							children: [],
							name: "Case" as const,
						})),
						name: "Switch",
					},
				],
			},
			"Auswahl",
			"Gemeinsam",
			[
				{ name: "first", type: "text", widgetCount: 1 },
				{ name: "second", type: "text", widgetCount: 1 },
			],
		);

		expect(result.inputs.map((input) => input.attributes.primary)).toEqual([
			"Auswahl",
			"Gemeinsam",
		]);
		expect(result.bindings).toEqual([
			{
				fieldName: "first",
				inputId: "Gemeinsam",
				isEnabled: true,
				valueMap: { false: "", true: "X" },
			},
			{
				fieldName: "second",
				inputId: "Gemeinsam",
				isEnabled: true,
				valueMap: { false: "", true: "Y" },
			},
		]);
	});
});
