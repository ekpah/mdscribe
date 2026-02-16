import { TextSelection, type Transaction } from "@tiptap/pm/state";

export const placeCaretAfterInsertedInlineTag = ({
	tr,
	dispatch,
}: {
	tr: Transaction;
	dispatch?: (tr: Transaction) => void;
}) => {
	const caretPos = Math.min(tr.selection.to, tr.doc.content.size);
	const nextSelection = TextSelection.near(tr.doc.resolve(caretPos), 1);

	if (dispatch) {
		dispatch(tr.setSelection(nextSelection).scrollIntoView());
	}

	return true;
};
