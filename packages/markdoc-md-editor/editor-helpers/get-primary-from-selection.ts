import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

const MARKDOC_TAG_NODE_NAMES = new Set(["caseTag", "infoTag", "scoreTag", "switchTag"]);

const getMarkdocTagPrimary = (node: ProseMirrorNode): string => {
	if (!MARKDOC_TAG_NODE_NAMES.has(node.type.name)) {
		return "";
	}

	return typeof node.attrs.primary === "string" ? node.attrs.primary : "";
};

/**
 * Derives the primary value for a newly inserted Markdoc tag from the current
 * editor selection. Selected Markdoc tags contribute their primary in place.
 */
export const getPrimaryFromSelection = ({
	doc,
	selection,
}: Pick<EditorState, "doc" | "selection">): string | null => {
	if (selection.empty) {
		return null;
	}

	return doc.textBetween(selection.from, selection.to, " ", getMarkdocTagPrimary);
};
