import { describe, expect, test } from "bun:test";

import {
	buildParsedMarkdocFromFieldDefinitions,
} from "@/lib/documents";
import type { DocumentFieldDefinition } from "@/lib/documents";

const createFieldDefinitions = (): DocumentFieldDefinition[] => [
	{
		description: "Erstes Feld",
		fieldName: "a",
		isEnabled: true,
		label: "A",
		markdocType: "Info",
		options: [],
		pdfType: "text",
		valueType: "string",
	},
	{
		description: "Checkbox",
		fieldName: "b",
		isEnabled: true,
		label: "B",
		markdocType: "Switch",
		options: [],
		pdfType: "checkbox",
		valueType: "string",
	},
	{
		description: "Ausgeblendet",
		fieldName: "c",
		isEnabled: false,
		label: "C",
		markdocType: "Info",
		options: [],
		pdfType: "text",
		valueType: "string",
	},
];

describe("buildParsedMarkdocFromFieldDefinitions", () => {
	test("builds deterministic input tag order and omits disabled fields", () => {
		const { inputTags } = buildParsedMarkdocFromFieldDefinitions(
			createFieldDefinitions(),
		);

		expect(inputTags).toHaveLength(2);
		expect(inputTags[0]?.attributes.primary).toBe("A");
		expect(inputTags[1]?.attributes.primary).toBe("B");
		expect(inputTags[1]?.name).toBe("Switch");
	});

	test("maps checkbox switch options to true/false by default", () => {
		const { inputTags } = buildParsedMarkdocFromFieldDefinitions(
			createFieldDefinitions(),
		);
		const switchTag = inputTags[1];
		expect(switchTag?.name).toBe("Switch");
		if (!switchTag || switchTag.name !== "Switch") {
			throw new Error("Expected switch tag");
		}
		expect(switchTag.attributes.type).toBe("boolean");
		expect(switchTag?.children.map((child) => child.attributes.primary)).toEqual([
			"true",
			"false",
		]);
	});

	test("allows duplicate labels when configuration matches and collapses to one input", () => {
		const duplicateWithSameConfig: DocumentFieldDefinition[] = [
			{
				description: "gleich",
				fieldName: "one",
				isEnabled: true,
				label: "gleich",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
			{
				description: "gleich",
				fieldName: "two",
				isEnabled: true,
				label: "gleich",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
		];

		const { inputTags } = buildParsedMarkdocFromFieldDefinitions(
			duplicateWithSameConfig,
		);
		expect(inputTags).toHaveLength(1);
		expect(inputTags[0]?.attributes.primary).toBe("gleich");
	});

	test("rejects duplicate labels with conflicting configuration", () => {
		const withDuplicateLabels: DocumentFieldDefinition[] = [
			{
				description: "eins",
				fieldName: "one",
				isEnabled: true,
				label: "gleich",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
			{
				description: "zwei",
				fieldName: "two",
				isEnabled: true,
				label: "gleich",
				markdocType: "Switch",
				options: ["ja", "nein"],
				pdfType: "dropdown",
				valueType: "string",
			},
		];

		expect(() => buildParsedMarkdocFromFieldDefinitions(withDuplicateLabels)).toThrow();
	});

	test("allows disabled field with same label as enabled field but different config", () => {
		const fields: DocumentFieldDefinition[] = [
			{
				description: "enabled text field",
				fieldName: "one",
				isEnabled: true,
				label: "Name",
				markdocType: "Info",
				options: [],
				pdfType: "text",
				valueType: "string",
			},
			{
				description: "disabled dropdown",
				fieldName: "two",
				isEnabled: false,
				label: "Name",
				markdocType: "Switch",
				options: ["a", "b"],
				pdfType: "dropdown",
				valueType: "string",
			},
		];

		const { inputTags } = buildParsedMarkdocFromFieldDefinitions(fields);
		expect(inputTags).toHaveLength(1);
		expect(inputTags[0]?.attributes.primary).toBe("Name");
		expect(inputTags[0]?.name).toBe("Info");
	});

	test("normalizes markdocType from pdfType and returns all normalized fields", () => {
		const fields: DocumentFieldDefinition[] = [
			{
				description: "  trim me  ",
				fieldName: "x",
				isEnabled: false,
				label: "  Label  ",
				markdocType: "Info",
				options: [],
				pdfType: "checkbox",
				valueType: "number",
			},
		];

		const { normalizedFieldDefinitions } = buildParsedMarkdocFromFieldDefinitions(fields);
		expect(normalizedFieldDefinitions[0]?.markdocType).toBe("Switch");
		expect(normalizedFieldDefinitions[0]?.valueType).toBe("string");
		expect(normalizedFieldDefinitions[0]?.options).toEqual(["true", "false"]);
		expect(normalizedFieldDefinitions[0]?.label).toBe("Label");
		expect(normalizedFieldDefinitions[0]?.description).toBe("trim me");
	});
});
