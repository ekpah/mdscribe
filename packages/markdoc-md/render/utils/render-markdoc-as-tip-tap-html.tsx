import Markdoc from "@markdoc/markdoc";
import type { Config, RenderableTreeNode, Tag } from "@markdoc/markdoc";

import { markdocConfig as config } from "../../markdoc-config";
import { sanitizeMarkdocForRendering } from "./sanitize-markdoc-for-rendering";

const isDetailsTag = (node: RenderableTreeNode | undefined): node is Tag =>
	Markdoc.Tag.isTag(node) && node.name === "Details";

/** Blocks a details section can join; mirrors `markDetailsLineFlow`. */
const sharesLineFlow = (node: RenderableTreeNode | undefined): boolean =>
	isDetailsTag(node) || (Markdoc.Tag.isTag(node) && node.name === "p");

/**
 * The editor shows every block as one line without paragraph spacing, so a
 * blank line next to a details section would be invisible there. Show it as an
 * empty paragraph instead: authors can see it, add it with Enter, and remove it
 * with Backspace. `htmlToMarkdoc` turns it back into the blank line.
 */
const showDetailsGapsAsEmptyLines = (node: RenderableTreeNode): void => {
	if (!Markdoc.Tag.isTag(node)) {
		return;
	}
	const children: RenderableTreeNode[] = [];
	for (const [index, child] of node.children.entries()) {
		showDetailsGapsAsEmptyLines(child);
		if (!isDetailsTag(child)) {
			children.push(child);
			continue;
		}
		const { joinNext, joinPrevious, ...attributes } = child.attributes;
		child.attributes = attributes;
		const previous = node.children[index - 1];
		const next = node.children[index + 1];
		// Between two sections, the first one's joinNext already decided the gap.
		if (sharesLineFlow(previous) && !isDetailsTag(previous) && joinPrevious !== true) {
			children.push(new Markdoc.Tag("p"));
		}
		children.push(child);
		if (sharesLineFlow(next) && joinNext !== true) {
			children.push(new Markdoc.Tag("p"));
		}
	}
	node.children = children;
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
	return Markdoc.renderers.html(content);
};
