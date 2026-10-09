import { Table } from "@tiptap/extension-table";
import { Fragment } from "@tiptap/pm/model";
import type { Node } from "@tiptap/pm/model";
import { EditorState, Plugin, Selection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { mergeCells } from "@tiptap/pm/tables";
import type { CellSelection } from "@tiptap/pm/tables";

/** Keep every table expressible by Markdoc's built-in list-table syntax. */
const isNativeTableDocument = (doc: Node): boolean => {
	let valid = true;
	doc.descendants((node) => {
		if (node.type.name !== "table") {
			return valid;
		}
		const hasHeader = node.firstChild?.firstChild?.type.name === "tableHeader";
		for (const [rowIndex, row] of node.content.content.entries()) {
			if (row.childCount === 0) {
				valid = false;
			}
			for (const cell of row.content.content) {
				const header = hasHeader && rowIndex === 0;
				if (
					cell.type.name !== (header ? "tableHeader" : "tableCell") ||
					(header && cell.attrs.rowspan !== 1) ||
					cell.childCount !== 1 ||
					cell.firstChild?.type.name !== "paragraph" ||
					cell.attrs.colwidth !== null
				) {
					valid = false;
				}
			}
		}
		return false;
	});
	return valid;
};

export const NativeTable = Table.extend({
	addCommands() {
		return {
			...this.parent?.(),
			mergeCells:
				() =>
				({ state, tr, dispatch }) => {
					if (!isNativeTableDocument(state.doc)) {
						return false;
					}
					// Simulate on a separate transaction so editor.can() checks the same
					// constraints as execution, without changing a command chain on failure.
					let candidate: Transaction | undefined;
					mergeCells(
						EditorState.create({ doc: state.doc, selection: state.selection }),
						(merged) => {
							const { $anchorCell } = merged.selection as CellSelection;
							const { pos } = $anchorCell;
							const cell = $anchorCell.parent.child($anchorCell.index());
							let inline = Fragment.empty;
							for (const paragraph of cell.content.content) {
								if (inline.size > 0 && paragraph.content.size > 0) {
									inline = inline.append(Fragment.from(state.schema.nodes.hardBreak.create()));
								}
								inline = inline.append(paragraph.content);
							}
							merged.replaceWith(
								pos + 1,
								pos + cell.nodeSize - 1,
								state.schema.nodes.paragraph.create(null, inline),
							);
							candidate = merged;
						},
					);
					if (!candidate || !isNativeTableDocument(candidate.doc)) {
						return false;
					}
					if (dispatch) {
						for (const step of candidate.steps) {
							tr.step(step);
						}
						tr.setSelection(Selection.fromJSON(tr.doc, candidate.selection.toJSON()));
					}
					return true;
				},
		};
	},
	addProseMirrorPlugins() {
		return [
			...(this.parent?.() ?? []),
			new Plugin({
				// Covers paste, row/column deletion and keyboard commands as well
				// as the toolbar; unsupported edits leave the document unchanged.
				filterTransaction: (tr) => !tr.docChanged || isNativeTableDocument(tr.doc),
			}),
		];
	},
});
