import { parseDocument } from "htmlparser2";
import { serializeMarkdocTable } from "markdoc-md/parse";

type Node = ReturnType<typeof parseDocument>["children"][number];

// Lab values such as <NWG are text, not tags. Retain structural/inline HTML
// and the script/style nodes that cellText deliberately excludes.
const strayLessThan =
	/<(?!\/?(?:table|thead|tbody|tfoot|tr|td|th|caption|br|p|strong|b|em|i|ul|ol|li|h[1-6]|blockquote|pre|code|del|hr|sub|sup|html|body|div|span|a|img|script|style)\b)/gi;

const cellText = (node: Node): string => {
	if (node.type === "text") {
		return node.data;
	}
	if (node.type !== "tag" || ["script", "style"].includes(node.name)) {
		return "";
	}
	return node.name === "br"
		? "\u0000"
		: node.children.map(cellText).join("") + (["td", "th", "tr"].includes(node.name) ? " " : "");
};

const cellSpan = (value: string | undefined): number => {
	const count = Number(value);
	return Number.isInteger(count) && count > 0 && count <= 1000 ? count : 1;
};

// Source text must stay literal, not become Markdoc tags, links or formatting.
const escapeCell = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("{", "&#123;")
		.replaceAll(/[\\`*_[\]]/g, "\\$&")
		.replaceAll(/^([#+=~-])/g, "\\$1")
		.replaceAll(/^(\d+)([.)])(?=\s|$)/g, "$1\\$2");

const markdocTable = (html: string): string => {
	const rows: Extract<Node, { attribs: unknown }>[][] = [];
	const captions: string[] = [];
	const visit = (node: Node) => {
		if (node.type !== "tag") {
			return;
		}
		if (node.name === "caption") {
			captions.push(cellText(node).trim());
		} else if (node.name === "tr") {
			rows.push(
				node.children.filter(
					(child): child is Extract<Node, { attribs: unknown }> =>
						child.type === "tag" && ["td", "th"].includes(child.name),
				),
			);
		} else {
			for (const child of node.children) {
				visit(child);
			}
		}
	};
	for (const node of parseDocument(html).children) {
		visit(node);
	}
	if (!rows.length) {
		return html;
	}
	return [
		...captions.map(escapeCell),
		serializeMarkdocTable(
			rows.map((cells) =>
				cells.map((cell) => {
					const lines = cellText(cell).split("\u0000");
					return {
						colspan: cellSpan(cell.attribs.colspan),
						content: lines
							.map(
								(line) =>
									escapeCell(line.replaceAll(/\s+/g, " ").trim()) ||
									(lines.length > 1 ? "&nbsp;" : ""),
							)
							.join("  \n"),
						rowspan: cellSpan(cell.attribs.rowspan),
					};
				}),
			),
			rows[0].length > 0 && rows[0].every((cell) => cell.name === "th"),
		).trimEnd(),
	].join("\n\n");
};

/** Shared prompt/preview view; original OCR text and geometry stay unchanged for citations. */
export const formatOcrTextForPrompt = (text: string): string => {
	const escapedOffsets: number[] = [];
	const html = text.replaceAll(strayLessThan, (_, offset: number) => {
		escapedOffsets.push(offset + escapedOffsets.length * 3);
		return "&lt;";
	});
	// &lt; adds three characters. Map parser offsets back so prose outside
	// tables stays byte-for-byte unchanged, including literal less-than signs.
	const originalOffset = (offset: number) =>
		offset - escapedOffsets.filter((escaped) => escaped < offset).length * 3;
	const tables: { end: number; start: number }[] = [];
	const visit = (node: Node) => {
		if (node.type !== "tag") {
			return;
		}
		if (node.name === "table" && node.startIndex !== null && node.endIndex !== null) {
			tables.push({ end: node.endIndex + 1, start: node.startIndex });
		} else {
			for (const child of node.children) {
				visit(child);
			}
		}
	};
	for (const node of parseDocument(html, { withEndIndices: true, withStartIndices: true })
		.children) {
		visit(node);
	}
	let formatted = text;
	for (const { end, start } of tables.toReversed()) {
		formatted =
			formatted.slice(0, originalOffset(start)) +
			markdocTable(html.slice(start, end)) +
			formatted.slice(originalOffset(end));
	}
	return formatted;
};
