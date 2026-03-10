import type { ContextProvider } from "../types";

interface TemplateContextSourceData {
	content?: unknown;
	examples?: unknown;
	title?: unknown;
}

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

const renderTemplateEntry = (data: TemplateContextSourceData): string => {
	const title = toTrimmedString(data.title);
	const content = toTrimmedString(data.content);
	const examples = toExamples(data.examples);

	if (!title && !content && examples.length === 0) {
		return "";
	}

	const parts: string[] = ["<template>"];

	if (title) {
		parts.push("<title>", title, "</title>");
	}

	if (content) {
		parts.push("<content>", content, "</content>");
	}

	if (examples.length > 0) {
		parts.push("<examples>");
		for (const example of examples) {
			parts.push("<example>", example, "</example>");
		}
		parts.push("</examples>");
	}

	parts.push("</template>");
	return parts.join("\n");
};

export const templateContextProvider: ContextProvider = {
	id: "template",
	build: ({ sources }) => {
		const templates = sources
			.filter((source) => source.kind === "template")
			.map((source) => renderTemplateEntry(source.data))
			.filter((entry) => entry.length > 0);

		if (templates.length === 0) {
			return null;
		}

		return {
			tag: "template_context",
			content: templates.join("\n\n"),
		};
	},
};
