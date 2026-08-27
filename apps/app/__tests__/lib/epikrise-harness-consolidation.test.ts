import { describe, expect, test } from "bun:test";

import { resolveFallbackTemplateByContextKey } from "@/orpc/scribe/context/template/fallbacks";
import { documentTypeConfigs, SELECTABLE_PROMPT_HARNESS_OPTIONS } from "@/orpc/scribe/prompts";

describe("epikrise harness consolidation", () => {
	test("narrative settings share the epikrise system prompt", () => {
		const epikrisePrompt = documentTypeConfigs.epikrise.systemPrompt;
		expect(documentTypeConfigs.discharge.systemPrompt).toBe(epikrisePrompt);
		expect(documentTypeConfigs.outpatient.systemPrompt).toBe(epikrisePrompt);
		expect(documentTypeConfigs["icu-transfer"].systemPrompt).toBe(epikrisePrompt);
	});

	test("setting differences live in the fallback templates", () => {
		const discharge = resolveFallbackTemplateByContextKey("discharge");
		const outpatient = resolveFallbackTemplateByContextKey("outpatient");
		const icuTransfer = resolveFallbackTemplateByContextKey("icu-transfer");
		const epikrise = resolveFallbackTemplateByContextKey("epikrise");

		expect(discharge?.content).toContain("stationär");
		expect(outpatient?.content).toContain("ENTSCHEIDUNGSPUNKT");
		expect(icuTransfer?.content).toContain("Verlegung");
		expect(epikrise?.title).toBe("Standardstruktur Epikrise");

		const contents = [discharge?.content, outpatient?.content, icuTransfer?.content];
		expect(new Set(contents).size).toBe(contents.length);
	});

	test("only epikrise is selectable for new forms; legacy narrative ids stay out", () => {
		const ids = SELECTABLE_PROMPT_HARNESS_OPTIONS.map((option) => option.id);
		expect(ids).toContain("epikrise");
		expect(ids).not.toContain("discharge");
		expect(ids).not.toContain("outpatient");
		expect(ids).not.toContain("icu-transfer");
	});
});
