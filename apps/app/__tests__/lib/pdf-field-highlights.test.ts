import { describe, expect, test } from "bun:test";

import {
	getInputIdForPdfWidget,
	getPdfFieldHighlightsForInput,
} from "@/app/documents/_components/pdf-field-highlights";
import type { DocumentDefinition } from "@/app/documents/_lib";

const definition: DocumentDefinition = {
	bindings: [
		{
			fieldName: "AW_1",
			inputId: "Gemeinsam",
			isEnabled: true,
			valueMap: { Drei: "PDF 3", Eins: "PDF 1", Vier: "PDF 4", Zwei: "PDF 2" },
		},
		{
			fieldName: "AW_1",
			inputId: "Andere Auswahl",
			isEnabled: true,
			valueMap: { false: "", true: "PDF 5" },
		},
		{
			fieldName: "AW_2",
			inputId: "Andere Auswahl",
			isEnabled: true,
			valueMap: { A: "PDF A", B: "PDF B" },
		},
	],
	inputs: [],
};

const pdfFields = [
	{ name: "AW_1", widgetCount: 5 },
	{ name: "AW_2", widgetCount: 2 },
];

describe("PDF field highlights", () => {
	test("keeps split widget values with their owning inputs", () => {
		expect(getPdfFieldHighlightsForInput(definition, pdfFields, "Gemeinsam")).toEqual([
			{ fieldName: "AW_1", widgetValues: ["PDF 3", "PDF 1", "PDF 4", "PDF 2"] },
		]);
		expect(getPdfFieldHighlightsForInput(definition, pdfFields, "Andere Auswahl")).toEqual([
			{ fieldName: "AW_1", widgetValues: ["PDF 5"] },
			{ fieldName: "AW_2", widgetValues: ["PDF A", "PDF B"] },
		]);
	});

	test("resolves a clicked widget to the binding that owns its export value", () => {
		expect(getInputIdForPdfWidget(definition, "AW_1", "PDF 4")).toBe(
			"Gemeinsam",
		);
		expect(getInputIdForPdfWidget(definition, "AW_1", "PDF 5")).toBe(
			"Andere Auswahl",
		);
	});

	test("derives binding-owned widget values without editor PDF metadata", () => {
		expect(getPdfFieldHighlightsForInput(definition, undefined, "Andere Auswahl")).toEqual([
			{ fieldName: "AW_1", widgetValues: ["PDF 5"] },
			{ fieldName: "AW_2", widgetValues: ["PDF A", "PDF B"] },
		]);
	});

	test("excludes disabled bindings in the filling view but can include them in the editor", () => {
		const withDisabledBinding: DocumentDefinition = {
			...definition,
			bindings: [
				...definition.bindings,
				{
					fieldName: "AW_disabled",
					inputId: "Gemeinsam",
					isEnabled: false,
					valueMap: { Eins: "PDF disabled" },
				},
			],
		};

		expect(
			getPdfFieldHighlightsForInput(withDisabledBinding, undefined, "Gemeinsam"),
		).not.toContainEqual({ fieldName: "AW_disabled", widgetValues: ["PDF disabled"] });
		expect(
			getPdfFieldHighlightsForInput(withDisabledBinding, undefined, "Gemeinsam", {
				includeDisabled: true,
			}),
		).toContainEqual({ fieldName: "AW_disabled", widgetValues: ["PDF disabled"] });
		expect(getInputIdForPdfWidget(withDisabledBinding, "AW_disabled", "PDF disabled")).toBeUndefined();
		expect(
			getInputIdForPdfWidget(withDisabledBinding, "AW_disabled", "PDF disabled", {
				includeDisabled: true,
			}),
		).toBe("Gemeinsam");
	});
});
