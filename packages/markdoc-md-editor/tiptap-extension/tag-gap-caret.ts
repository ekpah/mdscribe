import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const tagGapCaretKey = new PluginKey<boolean>("tagGapCaret");

const isInlineAtom = (node: ProseMirrorNode | null): boolean =>
	Boolean(node && node.isAtom && node.isInline && !node.isText);

const createCaretElement = (): HTMLElement => {
	const caret = document.createElement("span");
	caret.className = "tag-gap-caret";
	caret.setAttribute("aria-hidden", "true");
	return caret;
};

const buildCaretDecorations = (state: EditorState): DecorationSet | null => {
	const isFocused = tagGapCaretKey.getState(state);
	if (!isFocused) {
		return null;
	}

	const { selection } = state;
	if (!(selection instanceof TextSelection) || !selection.empty) {
		return null;
	}

	const { $from } = selection;
	if ($from.depth === 0 || !$from.parent.inlineContent) {
		return null;
	}

	// Browsers (notably Firefox) cannot paint the native caret when there is
	// no adjacent text node — e.g. directly between two tag chips. Render a
	// fake caret there and hide the native one to avoid double carets.
	const nodeBefore = $from.nodeBefore;
	const nodeAfter = $from.nodeAfter;
	if (nodeBefore?.isText || nodeAfter?.isText) {
		return null;
	}
	if (!(isInlineAtom(nodeBefore) || isInlineAtom(nodeAfter))) {
		return null;
	}

	return DecorationSet.create(state.doc, [
		Decoration.node($from.before(), $from.after(), {
			class: "tag-gap-caret-hide-native",
		}),
		Decoration.widget($from.pos, createCaretElement, {
			key: "tag-gap-caret",
			side: 0,
		}),
	]);
};

/**
 * Render a synthetic caret when the text cursor sits directly next to inline
 * tag chips without an adjacent text node, where the native caret is
 * invisible in Firefox.
 */
export const TagGapCaret = Extension.create({
	name: "tagGapCaret",

	addProseMirrorPlugins() {
		return [
			new Plugin<boolean>({
				key: tagGapCaretKey,
				props: {
					decorations: buildCaretDecorations,
					handleDOMEvents: {
						blur: (view) => {
							view.dispatch(view.state.tr.setMeta(tagGapCaretKey, false));
							return false;
						},
						focus: (view) => {
							view.dispatch(view.state.tr.setMeta(tagGapCaretKey, true));
							return false;
						},
					},
				},
				state: {
					apply: (tr, value) => {
						const meta = tr.getMeta(tagGapCaretKey) as boolean | undefined;
						return meta ?? value;
					},
					init: () => false,
				},
			}),
		];
	},
});
