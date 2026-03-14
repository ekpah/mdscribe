import { describe, expect, test } from "bun:test";

import { composeDocumentTypePrompt } from "@/orpc/scribe/prompts/compose";

const getLastUserContent = (messages: Array<{ content: string; role: string }>): string =>
	messages.findLast((message) => message.role === "user")?.content ?? "";

describe("Scribe Prompt Structure", () => {
	test("icu transfer keeps output structure, date line, and context in the old order", () => {
		const messages = composeDocumentTypePrompt("icu-transfer", {
			contextXml:
				"<patient_context>\n<notizen>\n<content>Kurze Notiz</content>\n</notizen>\n</patient_context>",
			todaysDate: "11.03.2026",
		});

		const userContent = getLastUserContent(messages);
		expect(messages).toHaveLength(2);
		expect(messages[0]?.role).toBe("system");
		expect(userContent).toContain("<output_structure>");
		expect(userContent).toContain("<output_example>");
		expect(userContent).toContain("Das heutige Datum ist der 11.03.2026.");
		expect(userContent).toContain("<patient_context>");
		expect(userContent.indexOf("<output_structure>")).toBeLessThan(
			userContent.indexOf("Das heutige Datum ist der 11.03.2026."),
		);
		expect(userContent.indexOf("Das heutige Datum ist der 11.03.2026.")).toBeLessThan(
			userContent.indexOf("<patient_context>"),
		);
	});

	test("discharge keeps date, context, and task execution in order", () => {
		const messages = composeDocumentTypePrompt("discharge", {
			contextXml:
				"<patient_context>\n<notizen>\n<content>Kurze Notiz</content>\n</notizen>\n</patient_context>",
			todaysDate: "11.03.2026",
		});

		const userContent = getLastUserContent(messages);
		expect(userContent).toContain("Das heutige Datum ist der 11.03.2026.");
		expect(userContent).toContain("<patient_context>");
		expect(userContent).toContain("<task_execution>");
		expect(userContent.indexOf("Das heutige Datum ist der 11.03.2026.")).toBeLessThan(
			userContent.indexOf("<patient_context>"),
		);
		expect(userContent.indexOf("<patient_context>")).toBeLessThan(
			userContent.indexOf("<task_execution>"),
		);
	});
});
