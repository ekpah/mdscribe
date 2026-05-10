import type { ContextSource, TemplateContextInput } from "@/orpc/scribe/context/types";
import { parseSelectedTemplateReference } from "./compose";
import { resolveFallbackTemplateByContextKey } from "./fallbacks";

const hasContent = (value: string | undefined): value is string =>
	typeof value === "string" && value.trim().length > 0;

const TEMPLATE_CONTEXT_USAGE = `Nutze diese Vorlage als primäre Zielstruktur und stilistische Orientierung.
- Übernimm NIEMALS Inhalte aus Beispielen oder Vorlagen, nur Struktur, Form und Stil.
- Inhalte dürfen AUSSCHLIEßLICH aus den bereitgestellten Eingaben und dem Patientenkontext stammen.
- Übernimm nicht den Titel aus <title>; nutze ihn nur als Kontext und gib keine XML-Tags zurück.`;

const MARKDOC_TAG_GUIDANCE = `Markdoc-Tags in der Vorlage sind nur Platzhalterlogik.
- Gib in der finalen Ausgabe niemals Markdoc-Syntax aus (kein {% ... %}).
- {% info ... /%}: durch passenden Wert ersetzen; falls unbekannt: [nicht dokumentiert].
- {% switch ... %}{% case ... %}{% /switch %}: nur Text des passenden case ausgeben; falls unklar: [nicht dokumentiert].
- Bei {% switch ... type="boolean" %}: case "true" für wahr, case "false" für falsch verwenden.
- {% score ... /%}: nur mit belegten Angaben berechnen; falls nicht sicher berechenbar: [nicht berechenbar].`;

const toTrimmedString = (value: unknown): string =>
	typeof value === "string" ? value.trim() : "";

const toExamples = (value: unknown): string[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => toTrimmedString(entry))
		.filter((entry) => entry.length > 0);
};

const renderMarkdocTagGuidance = (): string =>
	`<markdoc_tag_guidance>\n${MARKDOC_TAG_GUIDANCE}\n</markdoc_tag_guidance>`;

const renderTemplateContext = (
	template?: TemplateContextInput | null,
): string => {
	if (!template) {
		return "";
	}

	const title = toTrimmedString(template.title);
	const content = toTrimmedString(template.content);
	const examples = toExamples(template.examples);
	const markdocTagGuidance = renderMarkdocTagGuidance();

	const blocks = [
		title ? `<title>\n${title}\n</title>` : "",
		content ? `<content>\n${content}\n</content>` : "",
		examples.length > 0
			? `<examples>\n${examples
					.map((example) => `<example>\n${example}\n</example>`)
					.join("\n")}\n</examples>`
			: "",
	].filter(hasContent);

	if (blocks.length === 0) {
		return "";
	}

	return `<template_context>\n<usage>\n${TEMPLATE_CONTEXT_USAGE}\n</usage>\n${markdocTagGuidance}\n<template>\n${blocks.join("\n")}\n</template>\n</template_context>`;
};

export const buildTemplateFallbackContext = (
	template?: TemplateContextInput | null,
): string | undefined => {
	if (!template) {
		return undefined;
	}

	const templateContext = renderTemplateContext(template);
	return hasContent(templateContext) ? templateContext : undefined;
};

export const resolveSelectedTemplateContext = (
	selectedTemplateReference?: string,
): TemplateContextInput | undefined => {
	const selectedTemplate = selectedTemplateReference?.trim();
	if (!hasContent(selectedTemplate)) {
		return undefined;
	}

	const parsedTemplate = parseSelectedTemplateReference(selectedTemplate);
	if (!hasContent(parsedTemplate.content)) {
		return undefined;
	}

	return {
		content: parsedTemplate.content,
		examples: [],
		title: parsedTemplate.title,
	};
};

const toTemplateContextInput = (
	data: Record<string, unknown>,
): TemplateContextInput => ({
	content: toTrimmedString(data.content),
	examples: Array.isArray(data.examples)
		? data.examples
				.map((entry) => toTrimmedString(entry))
				.filter((entry) => entry.length > 0)
		: [],
	title: toTrimmedString(data.title),
});

const resolveTemplateContextFromSources = (
	sources: ContextSource[],
): string | undefined => {
	for (const source of sources) {
		if (source.kind !== "template") {
			continue;
		}

		const templateContext = buildTemplateFallbackContext(
			toTemplateContextInput(source.data),
		);
		if (templateContext) {
			return templateContext;
		}
	}

	return undefined;
};

interface ComposeTemplateContextInput {
	promptContextKey?: string;
	selectedTemplateReference?: string;
	sources: ContextSource[];
}

export const composeTemplateContext = (
	input: ComposeTemplateContextInput,
): string | undefined => {
	const selectedTemplateContext = buildTemplateFallbackContext(
		resolveSelectedTemplateContext(input.selectedTemplateReference),
	);
	if (selectedTemplateContext) {
		return selectedTemplateContext;
	}

	const sourceTemplateContext = resolveTemplateContextFromSources(input.sources);
	if (sourceTemplateContext) {
		return sourceTemplateContext;
	}

	return buildTemplateFallbackContext(
		resolveFallbackTemplateByContextKey(input.promptContextKey),
	);
};
