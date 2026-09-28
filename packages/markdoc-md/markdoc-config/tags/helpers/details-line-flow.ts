import type { Node } from "@markdoc/markdoc";

/**
 * Where a `details` section continues the surrounding lines instead of starting
 * a new paragraph. Derived from the source layout: a section written directly
 * below or above a paragraph or another section, without a blank line between
 * them, reads as one more line of that block.
 */
export interface DetailsLineFlow {
	joinNext: boolean;
	joinPrevious: boolean;
}

const JOIN_PREVIOUS = "joinPrevious";
const JOIN_NEXT = "joinNext";

const isDetails = (node: Node | undefined): node is Node =>
	node?.type === "tag" && node.tag === "details";

/** Only line-based blocks share a line flow; lists, headings, and tables keep their spacing. */
const sharesLineFlow = (node: Node | undefined): node is Node =>
	node?.type === "paragraph" || isDetails(node);

/** First source line of a node, and the line directly after its last line. */
const startLine = (node: Node): number | undefined => node.lines[0];
const endLine = (node: Node): number | undefined => node.lines.at(-1);

/**
 * Marks every block `details` section in the tree with its line flow. Must run
 * on the whole document before transforming, because a tag transform cannot see
 * its siblings. The marks live on the AST node, not in the tag schema, so
 * authors cannot set them.
 */
export const markDetailsLineFlow = (document: Node): void => {
	for (const parent of [document, ...document.walk()]) {
		for (const [index, child] of parent.children.entries()) {
			if (!isDetails(child) || child.inline) {
				continue;
			}
			const previous = parent.children[index - 1];
			const next = parent.children[index + 1];
			child.attributes[JOIN_PREVIOUS] =
				sharesLineFlow(previous) &&
				endLine(previous) !== undefined &&
				endLine(previous) === startLine(child);
			child.attributes[JOIN_NEXT] =
				sharesLineFlow(next) && startLine(next) !== undefined && startLine(next) === endLine(child);
		}
	}
};

/** Reads the marks written by `markDetailsLineFlow`; unmarked sections keep their spacing. */
export const readDetailsLineFlow = (node: Node): DetailsLineFlow => ({
	joinNext: node.attributes[JOIN_NEXT] === true,
	joinPrevious: node.attributes[JOIN_PREVIOUS] === true,
});
