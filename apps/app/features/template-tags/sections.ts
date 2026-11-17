import { parse } from "@markdoc/markdoc";
import type { Node } from "@markdoc/markdoc";
import type { MarkdocTemplateDiagnostic } from "markdoc-md/parse";

/** One `{% section %}` of a template. */
export interface TemplateSection {
	id: string;
	title: string;
}

const isSection = (node: Node): boolean => node.type === "tag" && node.tag === "section";

const toTemplateSection = (node: Node): TemplateSection => {
	const id = typeof node.attributes.id === "string" ? node.attributes.id : "";
	const title = typeof node.attributes.title === "string" ? node.attributes.title.trim() : "";
	return { id, title: title || id };
};

/** The top-level sections of a template in order, or `[]` for a template without sections. */
export const getTemplateSections = (content: string): TemplateSection[] => {
	const sections = parse(content)
		.children.filter(isSection)
		.map(toTemplateSection)
		.filter((section) => section.id);
	// A document has two or more sections or none; a sole section is plain text.
	return sections.length >= 2 ? sections : [];
};

const SECTION_BLOCK = /\{%\s*section\b([^%]*?)%\}([\s\S]*?)\{%\s*\/section\s*%\}/gu;
const OPEN_SECTION = /\{%\s*section\b([^%]*?)%\}([\s\S]*)$/u;
const SECTION_ID = /(?:\bid=\s*"([^"]*)"|#([\w-]+))/u;

const readSectionId = (attributes: string): string => {
	const match = SECTION_ID.exec(attributes);
	return match?.[1] ?? match?.[2] ?? "";
};

/**
 * Section texts of a (possibly still streaming) model response, keyed by id.
 * Text outside sections is ignored; a trailing section without its closing tag
 * is included as it grows. A partial closing tag at the very end is held back.
 */
export const splitSectionOutput = (output: string): Record<string, string> => {
	const sections: Record<string, string> = {};
	let rest = 0;
	for (const match of output.matchAll(SECTION_BLOCK)) {
		const id = readSectionId(match[1] ?? "");
		if (id) {
			sections[id] = (match[2] ?? "").trim();
		}
		rest = (match.index ?? 0) + match[0].length;
	}
	const open = OPEN_SECTION.exec(output.slice(rest));
	const id = open ? readSectionId(open[1] ?? "") : "";
	if (open && id) {
		sections[id] = (open[2] ?? "").replace(/\{%[^%]*%?$/u, "").trim();
	}
	return sections;
};

/** An empty line between sections, such as the editor's `&nbsp;` paragraph, is not content (trim drops U+00A0). */
const isBlankParagraph = (node: Node): boolean =>
	node.type === "paragraph" &&
	[...node.walk()].every(
		(child) =>
			child.type === "inline" ||
			child.type === "softbreak" ||
			child.type === "hardbreak" ||
			(child.type === "text" && !String(child.attributes.content ?? "").trim()),
	);

const sectionError = (id: string, node: Node, message: string): MarkdocTemplateDiagnostic => ({
	code: "markdoc-schema",
	id,
	location: node.location,
	message,
	severity: "error",
});

/**
 * Sections divide a whole document: they sit at the top level, have unique ids,
 * and once a template has one, all of its content belongs to a section.
 */
export const validateTemplateSections = (content: string): MarkdocTemplateDiagnostic[] => {
	const ast = parse(content);
	const diagnostics: MarkdocTemplateDiagnostic[] = [];
	const topLevel = new Set(ast.children.filter(isSection));
	for (const node of ast.walk()) {
		if (isSection(node) && !topLevel.has(node)) {
			diagnostics.push(
				sectionError(
					"section-nested",
					node,
					"Sections must be at the top level, not inside other tags, lists or sections.",
				),
			);
		}
	}
	if (topLevel.size === 0) {
		return diagnostics;
	}
	const seen = new Set<string>();
	for (const node of topLevel) {
		const { id } = node.attributes;
		if (typeof id !== "string") {
			continue;
		}
		if (seen.has(id)) {
			diagnostics.push(
				sectionError(
					"section-duplicate-id",
					node,
					`The section id '${id}' is used more than once.`,
				),
			);
		}
		seen.add(id);
	}
	for (const node of ast.children) {
		if (!isSection(node) && !isBlankParagraph(node)) {
			diagnostics.push(
				sectionError(
					"section-content-outside",
					node,
					"Content outside a section is never generated. Move it into a section.",
				),
			);
		}
	}
	return diagnostics;
};
