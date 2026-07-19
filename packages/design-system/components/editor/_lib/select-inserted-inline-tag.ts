import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";

/**
 * After `insertContent` of an inline atom tag, the caret sits right behind the
 * new node. Select that node instead so the tag inspector opens with it.
 */
export const selectInsertedInlineTag = ({
	tr,
	dispatch,
}: {
	tr: Transaction;
	dispatch?: (tr: Transaction) => void;
}) => {
	if (!dispatch) {
		return true;
	}

	const { $from } = tr.selection;
	const nodeBefore = $from.nodeBefore;

	if (nodeBefore?.isAtom && nodeBefore.isInline) {
		const nodePos = $from.pos - nodeBefore.nodeSize;
		dispatch(tr.setSelection(NodeSelection.create(tr.doc, nodePos)).scrollIntoView());
		return true;
	}

	// Fallback: keep the caret right after the inserted content.
	const caretPos = Math.min(tr.selection.to, tr.doc.content.size);
	dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(caretPos), 1)).scrollIntoView());
	return true;
};
