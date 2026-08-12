"use client";

import { FOCUS_INSERTED_TAG_PRIMARY_META } from "@repo/design-system/components/editor/_lib/select-inserted-inline-tag";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

export type MarkdocTagKind = "caseTag" | "infoTag" | "scoreTag" | "switchTag";

export interface SelectedMarkdocTag {
	kind: MarkdocTagKind;
	node: ProseMirrorNode;
	pos: number;
	/**
	 * How the tag became selected: as a node selection (chip click) or because
	 * the text cursor sits inside the tag content (case tags only).
	 */
	via: "content" | "node";
	/** Select the primary input when this tag was just inserted from the toolbar. */
	selectPrimary: boolean;
}

const MARKDOC_TAG_NODE_NAMES: readonly string[] = [
	"caseTag",
	"infoTag",
	"scoreTag",
	"switchTag",
];

const asMarkdocTagKind = (name: string): MarkdocTagKind | null =>
	MARKDOC_TAG_NODE_NAMES.includes(name) ? (name as MarkdocTagKind) : null;

const readSelectedTag = (editor: Editor, selectPrimary = false): SelectedMarkdocTag | null => {
	const { selection } = editor.state;

	if (selection instanceof NodeSelection) {
		const kind = asMarkdocTagKind(selection.node.type.name);
		if (kind) {
			return {
				kind,
				node: selection.node,
				pos: selection.from,
				selectPrimary,
				via: "node",
			};
		}
	}

	// A text cursor inside a case tag's inline content still selects that case.
	const { $from } = selection;
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		const node = $from.node(depth);
		if (node.type.name === "caseTag") {
			return {
				kind: "caseTag",
				node,
				pos: $from.before(depth),
				selectPrimary,
				via: "content",
			};
		}
	}

	return null;
};

/**
 * Tracks the tag shown in the inspector. Sticky: once a tag is selected it
 * stays active while the selection moves elsewhere (e.g. typing in the
 * document) until another tag is selected, the tag is deleted, or
 * `clearSelectedTag` is called (X button / sheet dismiss).
 */
export const useSelectedMarkdocTag = (
	editor: Editor | null,
): { clearSelectedTag: () => void; selectedTag: SelectedMarkdocTag | null } => {
	const [selectedTag, setSelectedTag] = useState<SelectedMarkdocTag | null>(null);

	useEffect(() => {
		if (!editor) {
			setSelectedTag(null);
			return;
		}

		setSelectedTag(readSelectedTag(editor));

		const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
			if (editor.isDestroyed) {
				setSelectedTag(null);
				return;
			}

			const requestsPrimarySelection =
				transaction.getMeta(FOCUS_INSERTED_TAG_PRIMARY_META) === true;
			const liveTag = readSelectedTag(editor, requestsPrimarySelection);
			if (liveTag) {
				setSelectedTag((previous) => ({
					...liveTag,
					selectPrimary:
						requestsPrimarySelection ||
						Boolean(
							previous?.selectPrimary &&
							previous.kind === liveTag.kind &&
							transaction.mapping.map(previous.pos) === liveTag.pos,
						),
				}));
				return;
			}

			// Selection moved off the tag: keep the last tag active while it
			// still exists, remapping its position through this transaction.
			setSelectedTag((previous) => {
				if (!previous) {
					return null;
				}
				const mappedPos = transaction.mapping.map(previous.pos);
				const node = editor.state.doc.nodeAt(mappedPos);
				if (node && node.type.name === previous.kind) {
					return {
						kind: previous.kind,
						node,
						pos: mappedPos,
						selectPrimary: false,
						via: previous.via,
					};
				}
				return null;
			});
		};

		editor.on("transaction", handleTransaction);

		return () => {
			editor.off("transaction", handleTransaction);
		};
	}, [editor]);

	const clearSelectedTag = useCallback(() => {
		setSelectedTag(null);

		if (!editor || editor.isDestroyed) {
			return;
		}

		// Collapse an active tag selection so the next transaction does not
		// immediately re-activate the tag.
		const liveTag = readSelectedTag(editor);
		if (liveTag) {
			editor.commands.setTextSelection(liveTag.pos);
		}
	}, [editor]);

	return { clearSelectedTag, selectedTag: editor ? selectedTag : null };
};

export const updateMarkdocTagAttributes = (
	editor: Editor,
	pos: number,
	attributes: Record<string, unknown>,
): void => {
	// No .focus() here: the caller usually types in an inspector input and must
	// keep focus there while the node attributes update underneath.
	editor
		.chain()
		.command(({ tr }) => {
			const node = tr.doc.nodeAt(pos);
			if (!node || !asMarkdocTagKind(node.type.name)) {
				return false;
			}
			const hadNodeSelection =
				tr.selection instanceof NodeSelection && tr.selection.from === pos;
			tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attributes });
			// Replacing the node degrades its NodeSelection to a text selection,
			// which would drop the chip highlight — restore it.
			if (hadNodeSelection) {
				tr.setSelection(NodeSelection.create(tr.doc, pos));
			}
			return true;
		})
		.run();
};
