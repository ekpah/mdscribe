const DEFAULT_TEMPLATE_TITLE = "Relevante Vorlage";
const REFERENCE_HEADING = "## Ausgewaehlte Vorlage (Referenz)";
const TITLE_PREFIX = "Titel:";
const OVERRIDE_INSTRUCTION_PREFIX = "Nutze die folgende Vorlage";
// Headings must start their own line; "Beispiele:" is the legacy variant.
const EXAMPLES_HEADING_PATTERN = /^(?:## Beispiele|Beispiele:)[ \t]*$/m;
const EXAMPLE_HEADING_PATTERN = /^### Beispiel \d+[ \t]*$/m;

export const buildSelectedTemplateReference = (templateData: {
	content: string;
	examples: string[];
	title: string;
}): string => {
	const sections = [
		REFERENCE_HEADING,
		`${TITLE_PREFIX} ${templateData.title}`,
		templateData.content,
	];

	if (templateData.examples.length > 0) {
		sections.push(
			"## Beispiele",
			...templateData.examples.map(
				(example, index) => `### Beispiel ${index + 1}\n\n${example}`,
			),
		);
	}

	return sections.join("\n\n");
};

// Splits off the first line; the remainder keeps its indentation but loses
// leading blank lines.
const splitFirstLine = (text: string): [string, string] => {
	const lineBreak = text.indexOf("\n");
	if (lineBreak === -1) {
		return [text, ""];
	}
	return [text.slice(0, lineBreak), text.slice(lineBreak + 1).replace(/^\n+/, "")];
};

const splitExamples = (section: string): string[] =>
	section
		.split(EXAMPLE_HEADING_PATTERN)
		.map((example) => example.trim())
		.filter((example) => example.length > 0);

export const parseSelectedTemplateReference = (
	reference: string,
): { content: string; examples: string[]; title: string } => {
	const normalized = reference.replaceAll("\r\n", "\n").trim();
	if (!normalized) {
		return { content: "", examples: [], title: DEFAULT_TEMPLATE_TITLE };
	}

	let title = "";
	let rest = normalized;

	// Optional header lines, in order: "## <heading>", "Titel: <title>",
	// and a leading usage instruction. Each is consumed when present.
	let [line, remainder] = splitFirstLine(rest);
	if (line.startsWith("## ")) {
		title = line.slice("## ".length).trim();
		rest = remainder;
		[line, remainder] = splitFirstLine(rest);
	}
	if (line.startsWith(TITLE_PREFIX)) {
		title = line.slice(TITLE_PREFIX.length).trim() || title;
		rest = remainder;
		[line, remainder] = splitFirstLine(rest);
	}
	if (line.startsWith(OVERRIDE_INSTRUCTION_PREFIX)) {
		rest = remainder;
	}

	let content = rest;
	let examples: string[] = [];
	const examplesHeading = rest.match(EXAMPLES_HEADING_PATTERN);
	if (examplesHeading?.index !== undefined) {
		content = rest.slice(0, examplesHeading.index);
		examples = splitExamples(rest.slice(examplesHeading.index + examplesHeading[0].length));
	}
	content = content.trim();

	return {
		content: content.length > 0 ? content : normalized,
		examples,
		title: title.length > 0 ? title : DEFAULT_TEMPLATE_TITLE,
	};
};
