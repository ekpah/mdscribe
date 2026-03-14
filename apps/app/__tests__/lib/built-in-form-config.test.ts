import { describe, expect, test } from "bun:test";
import {
	buildBuiltInAiscribeTemplateConfig,
	getBuiltInAiscribeOverrideSlug,
} from "@/app/aiscribe/_lib/built-in-form-config";

describe("built-in AIScribe form config", () => {
	test("falls back to documentType configuration without override form", () => {
		const config = buildBuiltInAiscribeTemplateConfig({
			template: "discharge",
		});

		expect(config.title).toBe("Entlassungsbrief");
		expect("documentType" in config).toBe(true);
		if ("documentType" in config) {
			expect(config.documentType).toBe("discharge");
		}
	});

	test("switches to custom-form execution when override form is available", () => {
		const config = buildBuiltInAiscribeTemplateConfig({
			overrideForm: { id: "form-override-1" },
			template: "er",
		});

		expect(config.title).toBe("Notfall Anamnese");
		expect("formId" in config).toBe(true);
		if ("formId" in config) {
			expect(config.formId).toBe("form-override-1");
		}
	});

	test("uses stable override slugs for built-in routes", () => {
		expect(getBuiltInAiscribeOverrideSlug("icu")).toBe("builtin-icu");
		expect(getBuiltInAiscribeOverrideSlug("procedures")).toBe(
			"builtin-procedures",
		);
	});
});
