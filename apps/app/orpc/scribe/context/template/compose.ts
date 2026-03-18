export const buildSelectedTemplateReference = (templateData: {
	content: string;
	examples: { content: string }[];
	title: string;
}): string => {
	const sections = [`Titel: ${templateData.title}`, templateData.content];

	if (templateData.examples.length > 0) {
		sections.push("Beispiele:");
		for (const example of templateData.examples) {
			sections.push(example.content);
		}
	}

	return sections.join("\n\n");
};

const DEFAULT_TEMPLATE_TITLE = "Relevante Vorlage";
const TITLE_PREFIX = "Titel:";
const EXAMPLES_HEADINGS = new Set(["## Beispiele", "Beispiele:"]);
const OVERRIDE_INSTRUCTION_PREFIX = "Nutze die folgende Vorlage";

const trimLines = (value: string): string[] =>
	value
		.replaceAll("\r\n", "\n")
		.split("\n")
		.map((line) => line.trimEnd());

const trimEmptyEdgeLines = (lines: string[]): string[] => {
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start]?.trim().length === 0) {
		start++;
	}
	while (end > start && lines[end - 1]?.trim().length === 0) {
		end--;
	}
	return lines.slice(start, end);
};

export const parseSelectedTemplateReference = (
	reference: string,
): { content: string; title: string } => {
	const normalized = reference.trim();
	if (!normalized) {
		return {
			content: "",
			title: DEFAULT_TEMPLATE_TITLE,
		};
	}

	let lines = trimEmptyEdgeLines(trimLines(normalized));
	let title: string | undefined;

	const firstLine = lines[0]?.trim();
	if (firstLine?.startsWith("## ")) {
		title = firstLine.replace(/^##\s+/, "").trim();
		lines = trimEmptyEdgeLines(lines.slice(1));
	}

	const titleLine = lines[0]?.trim();
	if (titleLine?.startsWith(TITLE_PREFIX)) {
		const parsedTitle = titleLine.slice(TITLE_PREFIX.length).trim();
		if (parsedTitle.length > 0) {
			title = parsedTitle;
		}
		lines = trimEmptyEdgeLines(lines.slice(1));
	}

	const maybeInstruction = lines[0]?.trim();
	if (maybeInstruction?.startsWith(OVERRIDE_INSTRUCTION_PREFIX)) {
		lines = trimEmptyEdgeLines(lines.slice(1));
	}

	const examplesIndex = lines.findIndex((line) =>
		EXAMPLES_HEADINGS.has(line.trim()),
	);
	if (examplesIndex !== -1) {
		lines = trimEmptyEdgeLines(lines.slice(0, examplesIndex));
	}

	const content = lines.join("\n").trim();

	return {
		content: content.length > 0 ? content : normalized,
		title: title && title.length > 0 ? title : DEFAULT_TEMPLATE_TITLE,
	};
};
