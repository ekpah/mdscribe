/**
 * Text format for copying templates and collections between mdscribe installations.
 *
 * A text starts with front matter (`mdscribe: template/v1` or `mdscribe: collection/v1`).
 * Each section sits between paired HTML comments on their own lines, such as
 * `<!-- mdscribe:content -->` and `<!-- /mdscribe:content -->`, so headings, `---`,
 * trailing spaces, and blank lines inside a template survive unchanged. A collection
 * wraps each template in `<!-- mdscribe:template -->` blocks and announces their count,
 * which lets the import notice text that a chat program cut off.
 */

export interface ExchangeTemplate {
	content: string;
	examples: string[];
	information: string;
	title: string;
}

export interface ExchangeCollection {
	description?: string;
	title: string;
}

type ParsedEntry =
	| { ok: true; template: ExchangeTemplate }
	| { error: string; ok: false; title?: string };

export interface ParsedExchange {
	collection: ExchangeCollection | null;
	entries: ParsedEntry[];
	/** Problems with the text as a whole, such as templates missing from a collection. */
	problems: string[];
}

export class ExchangeFormatError extends Error {
	/** The template the problem belongs to, when known. */
	readonly title?: string;

	constructor(message: string, title?: string) {
		super(message);
		this.name = "ExchangeFormatError";
		this.title = title;
	}
}

const TEMPLATE_FORMAT = "template/v1";
const COLLECTION_FORMAT = "collection/v1";
const TEMPLATE_START = "<!-- mdscribe:template -->";
const TEMPLATE_END = "<!-- /mdscribe:template -->";
const SECTION_MARKER = /^<!-- mdscribe:(content|information|example)(?: \d+)? -->$/;
const RESERVED_LINE = /^<!-- \/?mdscribe:/m;
const CUT_OFF = "Der Text wurde vermutlich abgeschnitten.";

/** Front matter; text values are JSON-quoted so colons, quotes and `#` stay safe. */
const frontMatter = (
	format: string | undefined,
	fields: Record<string, string | number | undefined>,
): string[] => [
	"---",
	...(format ? [`mdscribe: ${format}`] : []),
	...Object.entries(fields)
		.filter(([, value]) => value !== undefined && value !== "")
		.map(([key, value]) => `${key}: ${typeof value === "number" ? value : JSON.stringify(value)}`),
	"---",
];

const section = (name: string, body: string, index?: number): string[] => {
	if (RESERVED_LINE.test(body)) {
		throw new ExchangeFormatError(
			`Die Vorlage enthält eine Zeile, die mit „<!-- mdscribe:“ beginnt (${name}).`,
		);
	}
	return [
		`<!-- mdscribe:${name}${index ? ` ${index}` : ""} -->`,
		body,
		`<!-- /mdscribe:${name} -->`,
	];
};

const templateLines = (template: ExchangeTemplate, format?: string): string[] => [
	...frontMatter(format, { title: template.title }),
	"",
	...section("content", template.content),
	...(template.information ? ["", ...section("information", template.information)] : []),
	...template.examples.flatMap((example, index) => ["", ...section("example", example, index + 1)]),
];

export const serializeTemplate = (template: ExchangeTemplate): string =>
	`${templateLines(template, TEMPLATE_FORMAT).join("\n")}\n`;

export const serializeCollection = (
	collection: ExchangeCollection,
	templates: ExchangeTemplate[],
): string => {
	const lines = frontMatter(COLLECTION_FORMAT, {
		description: collection.description,
		templates: templates.length,
		title: collection.title,
	});
	for (const template of templates) {
		lines.push("", TEMPLATE_START, ...templateLines(template), TEMPLATE_END);
	}
	return `${lines.join("\n")}\n`;
};

/** Whether pasted text is meant to be in this format, before parsing it. */
export const looksLikeExchange = (text: string): boolean =>
	/^\uFEFF?---\r?\nmdscribe: /.test(text.trimStart());

const readFrontMatter = (lines: string[], start: number) => {
	if (lines[start] !== "---") {
		throw new ExchangeFormatError(`In Zeile ${start + 1} fehlt der Kopf (---).`);
	}
	const fields: Record<string, string> = {};
	let pos = start + 1;
	for (; pos < lines.length && lines[pos] !== "---"; pos += 1) {
		const line = lines[pos] ?? "";
		const separator = line.indexOf(": ");
		if (separator < 1) {
			throw new ExchangeFormatError(
				`Zeile ${pos + 1} im Kopf ist ungültig: „${line.slice(0, 60)}“`,
			);
		}
		const value = line.slice(separator + 2);
		try {
			fields[line.slice(0, separator)] = value.startsWith('"') ? JSON.parse(value) : value;
		} catch {
			throw new ExchangeFormatError(`Zeile ${pos + 1} im Kopf ist ungültig.`);
		}
	}
	if (pos >= lines.length) {
		throw new ExchangeFormatError("Der Kopf wird nicht geschlossen (---).");
	}
	return { fields, next: pos + 1 };
};

/** Reads one template from its front matter up to `stop` (a closing marker line) or the end. */
const readTemplate = (lines: string[], start: number, stop?: string) => {
	const { fields, next } = readFrontMatter(lines, start);
	const title = fields.title?.trim();
	const sections: Record<string, string> = {};
	const examples: string[] = [];
	let pos = next;
	while (pos < lines.length && lines[pos] !== stop) {
		const line = lines[pos] ?? "";
		pos += 1;
		if (line === "") {
			continue;
		}
		const name = SECTION_MARKER.exec(line)?.[1];
		if (!name) {
			throw new ExchangeFormatError(
				`Unerwarteter Text in Zeile ${pos}: „${line.slice(0, 60)}“`,
				title,
			);
		}
		const bodyStart = pos;
		const closing = `<!-- /mdscribe:${name} -->`;
		while (pos < lines.length && lines[pos] !== closing && !RESERVED_LINE.test(lines[pos] ?? "")) {
			pos += 1;
		}
		if (lines[pos] !== closing) {
			throw new ExchangeFormatError(
				`Abschnitt ab Zeile ${bodyStart} ist nicht abgeschlossen. ${CUT_OFF}`,
				title,
			);
		}
		const body = lines.slice(bodyStart, pos).join("\n");
		if (name === "example") {
			examples.push(body);
		} else {
			sections[name] = body;
		}
		pos += 1;
	}
	if (!title) {
		throw new ExchangeFormatError("Der Vorlage fehlt ein Titel.");
	}
	if (sections.content === undefined) {
		throw new ExchangeFormatError("Der Vorlage fehlt der Inhalt.", title);
	}
	const template = {
		content: sections.content,
		examples,
		information: sections.information ?? "",
		title,
	};
	return { next: pos, template };
};

const toEntry = (read: () => ExchangeTemplate): ParsedEntry => {
	try {
		return { ok: true, template: read() };
	} catch (error) {
		if (!(error instanceof ExchangeFormatError)) {
			throw error;
		}
		return { error: error.message, ok: false, title: error.title };
	}
};

/**
 * Parses a template or collection. Throws ExchangeFormatError when the text is not in this
 * format at all; damage to single templates is reported per entry so complete ones import.
 */
export const parseExchange = (rawText: string): ParsedExchange => {
	const text = rawText
		.replace(/^\uFEFF/, "")
		.replaceAll("\r\n", "\n")
		.trimStart();
	const lines = (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
	const { fields, next } = readFrontMatter(lines, 0);

	if (fields.mdscribe === TEMPLATE_FORMAT) {
		return {
			collection: null,
			entries: [toEntry(() => readTemplate(lines, 0).template)],
			problems: [],
		};
	}
	if (fields.mdscribe !== COLLECTION_FORMAT) {
		throw new ExchangeFormatError(`Unbekanntes Format „${fields.mdscribe ?? ""}“.`);
	}

	const entries: ParsedEntry[] = [];
	const problems: string[] = [];
	let pos = next;
	while (pos < lines.length) {
		if (lines[pos] === "") {
			pos += 1;
			continue;
		}
		if (lines[pos] !== TEMPLATE_START) {
			problems.push(`Unerwarteter Text in Zeile ${pos + 1}.`);
			break;
		}
		const blockStart = pos + 1;
		entries.push(
			toEntry(() => {
				const result = readTemplate(lines, blockStart, TEMPLATE_END);
				if (lines[result.next] !== TEMPLATE_END) {
					throw new ExchangeFormatError(
						`Die Vorlage ist nicht abgeschlossen. ${CUT_OFF}`,
						result.template.title,
					);
				}
				return result.template;
			}),
		);
		// Continue with the next template, if the text still has one.
		const resume = lines.indexOf(TEMPLATE_START, blockStart);
		pos = resume === -1 ? lines.length : resume;
	}

	const announced = Number(fields.templates);
	const complete = entries.filter((entry) => entry.ok).length;
	if (Number.isInteger(announced) && announced !== complete) {
		problems.unshift(`Angekündigt: ${announced} Vorlagen, vollständig: ${complete}.`);
	}
	return {
		collection: {
			description: fields.description || undefined,
			title: fields.title?.trim() || "Importierte Sammlung",
		},
		entries,
		problems,
	};
};
