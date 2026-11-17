import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { mergeSection, unwrapSoleSection } from "./section-merge";
import { SectionTagView } from "./section-tag-view";

export interface SectionTagAttrs {
	/** Stable key, e.g. of the generated text; letters, digits, - and _. */
	id: string;
	/** Label above the section; the document falls back to the id. */
	title: string | null;
}

/**
 * One titled part of a document, e.g. the Anamnese of a letter:
 *
 * ```
 * {% section id="anamnese" title="Anamnese" %}
 * Inhalt
 * {% /section %}
 * ```
 *
 * Sections belong at the top level; template validation reports misplaced ones.
 * A document has two or more of them or none: one left over, after loading or any
 * edit such as deleting the other, becomes plain text.
 */
export const SectionTag = Node.create<SectionTagAttrs>({
	addAttributes() {
		return {
			id: {
				default: "",
				parseHTML: (element) => element.getAttribute("id") ?? "",
				renderHTML: (attributes) => ({ id: attributes.id }),
			},
			title: {
				default: null,
				parseHTML: (element) => element.getAttribute("title")?.trim() || null,
				renderHTML: (attributes) => (attributes.title ? { title: attributes.title } : {}),
			},
		};
	},

	// Backspace at the very start of a section joins it to the section above, like two paragraphs.
	addKeyboardShortcuts() {
		return {
			Backspace: ({ editor }) => {
				const { $from, empty } = editor.state.selection;
				if (!empty || $from.parentOffset > 0 || $from.depth < 2) {
					return false;
				}
				if ($from.node(1).type.name !== this.name || $from.index(0) === 0) {
					return false;
				}
				for (let depth = 1; depth < $from.depth; depth += 1) {
					if ($from.index(depth) > 0) {
						return false;
					}
				}
				const previous = editor.state.doc.child($from.index(0) - 1);
				return previous.type.name === this.name && mergeSection(editor, $from.before(1));
			},
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(SectionTagView);
	},

	// Part of the edit that left one section, so undo restores both.
	addProseMirrorPlugins() {
		return [
			new Plugin({
				appendTransaction: (transactions, _oldState, state) => {
					const { tr } = state;
					return transactions.some((transaction) => transaction.docChanged) && unwrapSoleSection(tr)
						? tr
						: null;
				},
			}),
		];
	},

	content: "block+",
	defining: true,
	draggable: false,
	group: "block",
	isolating: true,

	name: "sectionTag",

	// Content saved with one section loads as plain text; saving keeps it that way.
	onCreate() {
		const { tr } = this.editor.state;
		if (unwrapSoleSection(tr)) {
			this.editor.view.dispatch(tr.setMeta("addToHistory", false));
		}
	},

	// Only Markdoc's editor HTML carries an id; a pasted web page section stays plain content.
	parseHTML() {
		return [{ tag: "section[id]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["Section", mergeAttributes(HTMLAttributes), 0];
	},

	selectable: true,
});
