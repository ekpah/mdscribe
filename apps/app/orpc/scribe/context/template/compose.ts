const DEFAULT_TEMPLATE_TITLE = "Relevante Vorlage";
const REFERENCE_HEADING = "## Ausgewaehlte Vorlage (Referenz)";
const TITLE_PREFIX = "Titel:";
const OVERRIDE_INSTRUCTION_PREFIX = "Nutze die folgende Vorlage";
const INFORMATION_HEADING = "## Informationen";
// Headings must start their own line; "Beispiele:" is the legacy variant.
const EXAMPLES_HEADING_PATTERN = /^(?:## Beispiele|Beispiele:)[ \t]*$/m;
const INFORMATION_HEADING_PATTERN = /^(?:## Informationen|Informationen:)[ \t]*$/m;
const EXAMPLE_HEADING_PATTERN = /^### Beispiel \d+[ \t]*$/m;

export const buildSelectedTemplateReference = (templateData: {
	content: string;
	examples: string[];
	information?: string;
	title: string;
}): string => {
	const sections = [
		REFERENCE_HEADING,
		`${TITLE_PREFIX} ${templateData.title}`,
		templateData.content,
	];
	if (templateData.information?.trim()) {
		sections.push(INFORMATION_HEADING, templateData.information.trim());
	}

	if (templateData.examples.length > 0) {
		sections.push(
			"## Beispiele",
			...templateData.examples.map((example, index) => `### Beispiel ${index + 1}\n\n${example}`),
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
): { content: string; examples: string[]; information: string; title: string } => {
	const normalized = reference.replaceAll("\r\n", "\n").trim();
	if (!normalized) {
		return { content: "", examples: [], information: "", title: DEFAULT_TEMPLATE_TITLE };
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
	let information = "";
	const informationHeading = rest.match(INFORMATION_HEADING_PATTERN);
	const examplesHeading = rest.match(EXAMPLES_HEADING_PATTERN);
	const contentEnd = Math.min(
		informationHeading?.index ?? rest.length,
		examplesHeading?.index ?? rest.length,
	);
	content = rest.slice(0, contentEnd);
	if (informationHeading?.index !== undefined) {
		const informationStart = informationHeading.index + informationHeading[0].length;
		const informationEnd =
			examplesHeading?.index !== undefined && examplesHeading.index > informationHeading.index
				? examplesHeading.index
				: rest.length;
		information = rest.slice(informationStart, informationEnd).trim();
	}
	if (examplesHeading?.index !== undefined) {
		examples = splitExamples(rest.slice(examplesHeading.index + examplesHeading[0].length));
	}
	content = content.trim();

	return {
		content: content.length > 0 ? content : normalized,
		examples,
		information,
		title: title.length > 0 ? title : DEFAULT_TEMPLATE_TITLE,
	};
};
