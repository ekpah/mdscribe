import { describe, expect, test } from "bun:test";
import { composeScribeContext } from "@/orpc/scribe/context";
import { composeDocumentTypePrompt } from "@/orpc/scribe/prompts/compose";

const getLastUserContent = (messages: { content: string; role: string }[]): string =>
	messages.findLast((message) => message.role === "user")?.content ?? "";
const getSystemContent = (messages: { content: string; role: string }[]): string =>
	messages.find((message) => message.role === "system")?.content ?? "";

describe("Scribe Prompt Structure", () => {
	test("icu transfer uses context fallback template and keeps date before context block", () => {
		const { contextPrompt, contextXml } = composeScribeContext({
			formData: { notes: "Kurze Notiz" },
			promptContextKey: "icu-transfer",
			sessionUser: null,
			todaysDate: "11.03.2026",
		});
		const messages = composeDocumentTypePrompt("icu-transfer", {
			contextPrompt,
			contextXml,
		});

		const userContent = getLastUserContent(messages);
		expect(messages).toHaveLength(2);
		expect(messages[0]?.role).toBe("system");
		expect(userContent).toContain("<context>");
		expect(userContent).toContain("<template_context>");
		expect(userContent).toContain(
			"primäre Zielstruktur und stilistische Orientierung",
		);
		expect(userContent).toContain("Standardstruktur Intensiv-Verlegungsbrief");
		expect(userContent).toContain("Das heutige Datum ist der 11.03.2026.");
		expect(userContent).toContain("<patient_context>");
		expect(userContent.indexOf("Das heutige Datum ist der 11.03.2026.")).toBeLessThan(
			userContent.indexOf("<context>"),
		);
		expect(userContent.indexOf("<template_context>")).toBeLessThan(
			userContent.indexOf("<patient_context>"),
		);
		expect(
			userContent.indexOf("primäre Zielstruktur und stilistische Orientierung"),
		).toBeLessThan(userContent.indexOf("<template>"));
	});

	test("icu transfer uses provided selected template and skips built-in fallback", () => {
		const { contextPrompt, contextXml } = composeScribeContext({
			formData: { notes: "Kurze Notiz" },
			promptContextKey: "icu-transfer",
			selectedTemplateReference:
				"## Eigene Vorlage\n\nTitel: Eigene Vorlage\n\nEigener Stil",
			sessionUser: null,
			todaysDate: "11.03.2026",
		});
		const messages = composeDocumentTypePrompt("icu-transfer", {
			contextPrompt,
			contextXml,
		});

		const userContent = getLastUserContent(messages);
		expect(userContent).toContain(
			"primäre Zielstruktur und stilistische Orientierung",
		);
		expect(userContent).toContain("Eigene Vorlage");
		expect(userContent).not.toContain("Standardstruktur Intensiv-Verlegungsbrief");
	});

	test("anamnese keeps date and fallback template in unified context block", () => {
		const { contextPrompt, contextXml } = composeScribeContext({
			formData: {
				anamnese: "Seit gestern Thoraxschmerz mit Ausstrahlung",
				notes: "Allergie gegen Penicillin bekannt",
			},
			promptContextKey: "anamnese",
			sessionUser: null,
			todaysDate: "11.03.2026",
		});
		const messages = composeDocumentTypePrompt("anamnese", {
			contextPrompt,
			contextXml,
		});

		const userContent = getLastUserContent(messages);
		expect(messages).toHaveLength(2);
		expect(messages[0]?.role).toBe("system");
		expect(userContent).toContain("Das heutige Datum ist der 11.03.2026.");
		expect(userContent).toContain("<context>");
		expect(userContent).toContain("<template_context>");
		expect(userContent).toContain("Standardstruktur Anamnese");
		expect(userContent).toContain("<patient_context>");
		expect(userContent.indexOf("Das heutige Datum ist der 11.03.2026.")).toBeLessThan(
			userContent.indexOf("<context>"),
		);
	});

	test("discharge keeps date and unified context block", () => {
		const { contextPrompt, contextXml } = composeScribeContext({
			formData: { notes: "Kurze Notiz" },
			promptContextKey: "discharge",
			sessionUser: null,
			todaysDate: "11.03.2026",
		});
		const messages = composeDocumentTypePrompt("discharge", {
			contextPrompt,
			contextXml,
		});

		const userContent = getLastUserContent(messages);
		expect(userContent).toContain("<template_context>");
		expect(userContent).toContain("Standardstruktur Entlassbrief");
		expect(userContent).toContain("Das heutige Datum ist der 11.03.2026.");
		expect(userContent).toContain("<context>");
		expect(userContent).toContain("<patient_context>");
		expect(userContent.indexOf("Das heutige Datum ist der 11.03.2026.")).toBeLessThan(
			userContent.indexOf("<context>"),
		);
	});

	test("diagnosis follows shared context path without extra source duplication", () => {
		const { contextPrompt, contextXml } = composeScribeContext({
			formData: {
				anamnese: "Akuter Thoraxschmerz",
				befunde: "Troponin erhöht",
				diagnoseblock: "KHK",
				notes: "NSTEMI wahrscheinlich",
			},
			promptContextKey: "diagnosis",
			sessionUser: null,
			todaysDate: "11.03.2026",
		});
		const messages = composeDocumentTypePrompt("diagnosis", {
			contextPrompt,
			contextXml,
		});

		const systemContent = getSystemContent(messages);
		const userContent = getLastUserContent(messages);
		expect(systemContent).not.toContain("<data_sources>");
		expect(userContent).toContain("<context>");
		expect(userContent).toContain("<patient_context>");
		expect(userContent).toContain("<diagnoseblock>");
		expect(userContent).toContain("<anamnese>");
		expect(userContent).toContain("<befunde>");
		expect(userContent).toContain("<notizen>");
	});

	test("procedures keeps provided template_context without input label wrapper", () => {
		const { contextPrompt, contextXml } = composeScribeContext({
			formData: { notes: "Procedure note" },
			promptContextKey: "procedures",
			sessionUser: null,
			template: {
				content: "Template Body",
				examples: [],
				title: "Custom Procedure Template",
			},
			todaysDate: "11.03.2026",
		});
		const messages = composeDocumentTypePrompt("procedures", {
			contextPrompt,
			contextXml,
		});

		const userContent = getLastUserContent(messages);
		expect(userContent).toContain("Custom Procedure Template");
		expect(userContent).not.toContain("<input_label>");
	});
});
