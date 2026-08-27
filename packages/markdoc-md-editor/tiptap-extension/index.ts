// Custom TipTap extension that adds Markdoc tags to the editor.

import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";

import { CaseTag } from "./editorNodes/caseTag/case-tag";
import type { CaseTagOptions } from "./editorNodes/caseTag/case-tag";
import { InfoTag } from "./editorNodes/infoTag/info-tag";
import type { InfoTagAttrs } from "./editorNodes/infoTag/info-tag";
import { ScoreTag } from "./editorNodes/scoreTag/score-tag";
import type { ScoreTagAttrs } from "./editorNodes/scoreTag/score-tag";
import { SwitchTag } from "./editorNodes/switchTag/switch-tag";
import type { SwitchTagAttrs } from "./editorNodes/switchTag/switch-tag";
import { TagGapCaret } from "./tag-gap-caret";

const INLINE_MARKDOC_TAG_NAMES = new Set(["caseTag", "infoTag", "scoreTag", "switchTag"]);

export const isCursorAfterInlineMarkdocTag = (state: EditorState): boolean => {
	const { selection } = state;
	if (!selection.empty) {
		return false;
	}
	const { $from } = selection;
	return (
		$from.parent.isTextblock &&
		$from.parentOffset === $from.parent.content.size &&
		Boolean($from.nodeBefore && INLINE_MARKDOC_TAG_NAMES.has($from.nodeBefore.type.name))
	);
};

interface MarkdocExtensionOptions {
	/**
	 * If set to false, the caseTag extension will not be registered
	 * @example caseTag: false
	 */
	caseTag: Partial<CaseTagOptions> | false;

	/**
	 * If set to false, the infoTag extension will not be registered
	 * @example infoTag: false
	 */
	infoTag: Partial<InfoTagAttrs> | false;

	/**
	 * If set to false, the scoreTag extension will not be registered
	 * @example scoreTag: false
	 */
	scoreTag: Partial<ScoreTagAttrs> | false;

	/**
	 * If set to false, the switchTag extension will not be registered
	 * @example switchTag: false
	 */
	switchTag: Partial<SwitchTagAttrs> | false;
}

/**
 * The Markdoc extension is a collection of custom Markdoc tags and marks for the editor.
 *
 * It includes:
 * - CaseTag: Represents a case within a switch statement
 * - InfoTag: Displays informational content
 * - ScoreTag: Displays calculated scores based on formulas
 * - SwitchTag: Creates conditional switch statements
 */
export const MarkdocMD = Extension.create<MarkdocExtensionOptions>({
	addKeyboardShortcuts() {
		return {
			Enter: () =>
				isCursorAfterInlineMarkdocTag(this.editor.state)
					? this.editor.commands.setHardBreak()
					: false,
		};
	},

	addExtensions() {
		const extensions = [];

		if (this.options.caseTag !== false) {
			extensions.push(CaseTag.configure(this.options.caseTag));
		}

		if (this.options.infoTag !== false) {
			extensions.push(InfoTag.configure(this.options.infoTag));
		}

		if (this.options.scoreTag !== false) {
			extensions.push(ScoreTag.configure(this.options.scoreTag));
		}

		if (this.options.switchTag !== false) {
			extensions.push(SwitchTag.configure(this.options.switchTag));
		}

		extensions.push(TagGapCaret);

		return extensions;
	},

	name: "markdoc-md",
});
