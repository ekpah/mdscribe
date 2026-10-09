import type { Config, RenderableTreeNode } from "@markdoc/markdoc";
import { Tag } from "@markdoc/markdoc";
import type { CSSProperties } from "react";

import { markdocConfig } from "../../markdoc-config";
import type { MarkdocComponentMap } from "../../markdoc-config/tags/helpers/components";
import { DEFAULT_DETAILS_SUMMARY } from "../../markdoc-config/tags/helpers/config";
import { showDetailsGapsAsEmptyLines } from "../../markdoc-config/tags/helpers/details-line-flow";

export const templateConfig: Config = {
	...markdocConfig,
	nodes: {
		...markdocConfig.nodes,
		softbreak: { render: "br" },
	},
};

/** Inline typography travels with rich-text copies instead of depending on app CSS. */
const styles: Record<string, CSSProperties> = {
	article: {
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif',
		fontSize: 14,
		lineHeight: 1.45,
		maxWidth: "none",
		whiteSpace: "normal",
	},
	h1: {
		fontSize: 30,
		fontWeight: 800,
		lineHeight: 1.25,
		margin: "12px 0 8px",
	},
	h2: {
		fontSize: 20,
		fontWeight: 700,
		lineHeight: 1.25,
		margin: "12px 0 6px",
	},
	h3: { fontSize: 18, fontWeight: 600, lineHeight: 1.25, margin: "8px 0 4px" },
	li: { margin: 0, paddingLeft: "0.428571em" },
	ol: { listStyleType: "decimal", margin: "4px 0", paddingLeft: "1.57143em" },
	p: { margin: 0 },
	strong: { fontWeight: 600 },
	table: { borderCollapse: "collapse", margin: "12px 0", tableLayout: "fixed", width: "100%" },
	td: {
		border: "1px solid #b8b8b8",
		overflowWrap: "break-word",
		padding: "8px 12px",
		verticalAlign: "top",
	},
	th: {
		backgroundColor: "#f0f0f0",
		border: "1px solid #b8b8b8",
		color: "#333",
		fontWeight: 600,
		overflowWrap: "break-word",
		padding: "8px 12px",
		textAlign: "left",
		verticalAlign: "top",
	},
	ul: { listStyleType: "disc", margin: "4px 0", paddingLeft: "1.57143em" },
};

const applyStyles = (node: RenderableTreeNode, components?: MarkdocComponentMap): void => {
	if (!Tag.isTag(node)) {
		return;
	}
	const style = styles[node.name];
	if (node.name === "p") {
		// Real line blocks avoid the blank paragraph separators browsers add to copied text.
		node.name = "div";
		node.attributes["data-template-line"] = "";
		if (node.children.length === 0) {
			node.children = ["\u00A0"];
		}
	} else if (node.name === "Details" && !components?.Details) {
		const { open, summary } = node.attributes;
		node.name = "details";
		node.attributes = { "data-markdoc-details": "", open, style: { margin: 0 } };
		node.children.unshift(
			new Tag("summary", { style: { cursor: "pointer" } }, [
				summary?.trim() || DEFAULT_DETAILS_SUMMARY,
			]),
		);
	}
	if (style) {
		node.attributes.style = style;
	}
	for (const child of node.children) {
		applyStyles(child, components);
	}
};

export const applyTemplateLayout = (
	tree: RenderableTreeNode,
	components?: MarkdocComponentMap,
): void => {
	showDetailsGapsAsEmptyLines(tree);
	applyStyles(tree, components);
};
