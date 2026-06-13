import { describe, expect, test } from "bun:test";

import { getPromptHarnessTargetField } from "@/orpc/scribe/prompts";

describe("prompt harness target fields", () => {
	test("maps every harness to the canonical field it enhances", () => {
		expect(getPromptHarnessTargetField("anamnese")).toBe("anamnese");
		expect(getPromptHarnessTargetField("befunde")).toBe("befunde");
		expect(getPromptHarnessTargetField("diagnosis")).toBe("diagnoseblock");
		expect(getPromptHarnessTargetField("procedures")).toBe("befunde");
		expect(getPromptHarnessTargetField("epikrise")).toBe("epikrise");
		expect(getPromptHarnessTargetField("discharge")).toBe("epikrise");
		expect(getPromptHarnessTargetField("outpatient")).toBe("epikrise");
		expect(getPromptHarnessTargetField("icu-transfer")).toBe("epikrise");
	});

	test("resolves legacy aliases and falls back to epikrise", () => {
		expect(getPromptHarnessTargetField("Inpatient_discharge")).toBe("epikrise");
		expect(getPromptHarnessTargetField("ER_Anamnese_chat")).toBe("anamnese");
		expect(getPromptHarnessTargetField("Diagnoses")).toBe("diagnoseblock");
		expect(getPromptHarnessTargetField(null)).toBe("epikrise");
		expect(getPromptHarnessTargetField("unknown-harness")).toBe("epikrise");
	});
});
