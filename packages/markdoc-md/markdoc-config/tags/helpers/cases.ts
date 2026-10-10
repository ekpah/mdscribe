import type { Node } from "@markdoc/markdoc";

const WRAPPER_TYPES = new Set(["document", "inline", "paragraph"]);

/**
 * The cases a switch or condition owns. Markdoc can wrap them in paragraph or
 * inline helper nodes, which are unwrapped; other tags are not traversed, so
 * a nested switch keeps its own cases.
 */
export const immediateCases = (node: Node): Node[] =>
	node.children.flatMap((child) => {
		if (child.type === "tag") {
			return child.tag === "case" ? [child] : [];
		}
		return WRAPPER_TYPES.has(child.type) ? immediateCases(child) : [];
	});
