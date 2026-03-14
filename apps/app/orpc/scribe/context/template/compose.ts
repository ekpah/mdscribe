import type { ContextSource, TemplateContextInput } from "@/orpc/scribe/context/types";

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

const appendTemplateTag = (parts: string[], tag: string, value: string) => {
	if (!value) {
		return;
	}

	parts.push(`<${tag}>`, value, `</${tag}>`);
};

const appendTemplateExamples = (parts: string[], examples: string[]) => {
	if (examples.length === 0) {
		return;
	}

	parts.push("<examples>");
	for (const example of examples) {
		parts.push("<example>", example, "</example>");
	}
	parts.push("</examples>");
};

const renderTemplateEntry = (data: Record<string, unknown>): string => {
	const title = toTrimmedString(data.title);
	const content = toTrimmedString(data.content);
	const examples = toExamples(data.examples);

	if (!title && !content && examples.length === 0) {
		return "";
	}

	const parts: string[] = ["<template>"];
	appendTemplateTag(parts, "title", title);
	appendTemplateTag(parts, "content", content);
	appendTemplateExamples(parts, examples);
	parts.push("</template>");
	return parts.join("\n");
};

export const composeTemplateContext = (
	template?: TemplateContextInput | null,
): string => {
	if (!template) {
		return "";
	}

	const entry = renderTemplateEntry(template);
	if (!entry) {
		return "";
	}

	return `<template_context>\n${entry}\n</template_context>`;
};

export const composeTemplateContextFromSources = (
	sources: ContextSource[],
): string => {
	const templates = sources
		.filter((source) => source.kind === "template")
		.map((source) => renderTemplateEntry(source.data))
		.filter((entry) => entry.length > 0);

	if (!templates.length) {
		return "";
	}

	return `<template_context>\n${templates.join("\n\n")}\n</template_context>`;
};

export const buildSelectedTemplateReference = (templateData: {
	content: string;
	examples: { content: string }[];
	title: string;
}): string => {
	const sections = [
		"## Ausgewaehlte Vorlage (Referenz)",
		`Titel: ${templateData.title}`,
		templateData.content,
	];

	if (templateData.examples.length > 0) {
		sections.push("## Beispiele");
		for (const example of templateData.examples) {
			sections.push(example.content);
		}
	}

	return sections.join("\n\n");
};
