import Markdoc from "@markdoc/markdoc";
import type { Config, RenderableTreeNode } from "@markdoc/markdoc";

import { markdocConfig as config } from "../../markdoc-config";
import { showDetailsGapsAsEmptyLines } from "../../markdoc-config/tags/helpers/details-line-flow";
import { sanitizeMarkdocForRendering } from "./sanitize-markdoc-for-rendering";

const CASE_LITERAL_ATTRIBUTES = new Set(["eq", "gt", "gte", "lt", "lte", "value"]);

/**
 * HTML attributes are strings, so literals that strings cannot express are
 * JSON-encoded: case values and comparisons always (to tell `"1"` from `1`),
 * and non-string primaries (condition arrays) behind `data-primary-json`. Even
 * invalid literals then survive an editor roundtrip for validation to report.
 */
const encodeLiteralAttributes = (node: RenderableTreeNode): void => {
	if (Array.isArray(node)) {
		for (const child of node) {
			encodeLiteralAttributes(child);
		}
		return;
	}
	if (!Markdoc.Tag.isTag(node)) {
		return;
	}
	for (const [key, value] of Object.entries(node.attributes)) {
		if (node.name === "Case" && CASE_LITERAL_ATTRIBUTES.has(key)) {
			node.attributes[key] = JSON.stringify(value);
		} else if (
			key === "primary" &&
			(node.name === "Condition" || node.name === "Switch") &&
			typeof value !== "string" &&
			value !== undefined
		) {
			node.attributes[key] = JSON.stringify(value);
			node.attributes["data-primary-json"] = "true";
		}
	}
	for (const child of node.children) {
		encodeLiteralAttributes(child);
	}
};

/**
 * Renders a Markdoc string into HTML to be used in TipTap. This could also be used to render the content in just HTML, but is most useful for TipTap, as it allows for the use of the components defined in your Markdoc config.
 * @param {string} markdocString - The raw Markdoc content.
 * @returns {string} A string representing the Markdoc content as HTML.
 */
export const renderTipTapHTML = (
	markdocString: string,
	options: { config?: Config; sanitize?: boolean } = {},
): string => {
	const source =
		options.sanitize === false ? markdocString : sanitizeMarkdocForRendering(markdocString);
	const ast = Markdoc.parse(source);
	// Markdown has no empty paragraphs or leading/trailing hard breaks. The
	// HTML serializer pads empty lines with &nbsp; so the parser retains them.
	for (const node of ast.walk()) {
		if (node.type !== "inline") {
			continue;
		}
		for (const [index, child] of node.children.entries()) {
			const previous = node.children[index - 1];
			const next = node.children[index + 1];
			if (
				child.type === "text" &&
				child.attributes.content === "\u00a0" &&
				(!previous || previous.type === "hardbreak" || previous.type === "softbreak") &&
				(!next || next.type === "hardbreak" || next.type === "softbreak")
			) {
				child.attributes.content = "";
			}
		}
	}
	const editorConfig = options.config ?? config;
	const content = Markdoc.transform(ast, {
		...editorConfig,
		nodes: {
			...editorConfig.nodes,
			// TipTap has one line-break node. Normalize soft breaks to visible
			// hard breaks here without changing the non-editor renderer.
			softbreak: { render: "br" },
		},
	});
	showDetailsGapsAsEmptyLines(content);
	encodeLiteralAttributes(content);
	return Markdoc.renderers.html(content);
};
