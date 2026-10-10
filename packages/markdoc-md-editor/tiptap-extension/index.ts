// Custom TipTap extension that adds Markdoc tags to the editor.

import { Extension } from "@tiptap/core";
import type { AnyExtension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";

import { CalcTag } from "./editorNodes/calcTag/calc-tag";
import type { CalcTagAttrs } from "./editorNodes/calcTag/calc-tag";
import { CaseTag } from "./editorNodes/caseTag/case-tag";
import type { CaseTagOptions } from "./editorNodes/caseTag/case-tag";
import { ConditionTag } from "./editorNodes/conditionTag/condition-tag";
import { DetailsTag } from "./editorNodes/detailsTag/details-tag";
import type { DetailsTagAttrs } from "./editorNodes/detailsTag/details-tag";
import { InfoTag } from "./editorNodes/infoTag/info-tag";
import type { InfoTagAttrs } from "./editorNodes/infoTag/info-tag";
import { SwitchTag } from "./editorNodes/switchTag/switch-tag";
import type { SwitchTagAttrs } from "./editorNodes/switchTag/switch-tag";
import { TagGapCaret } from "./tag-gap-caret";

export const shouldInsertLineBreak = (state: EditorState): boolean => {
	const { $from } = state.selection;
	if ($from.parent.type.name !== "paragraph") {
		return false;
	}
	// Enter must still create/exit list items, rather than insert a line inside one.
	for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
		if ($from.node(depth).type.name === "listItem") {
			return false;
		}
	}
	return true;
};

interface MarkdocExtensionOptions {
	/**
	 * If set to false, the caseTag extension will not be registered
	 * @example caseTag: false
	 */
	caseTag: Partial<CaseTagOptions> | false;

	/**
	 * If set to false, the calcTag extension will not be registered
	 * @example calcTag: false
	 */
	calcTag: Partial<CalcTagAttrs> | false;

	/**
	 * If set to false, the detailsTag extension will not be registered
	 * @example detailsTag: false
	 */
	detailsTag: Partial<DetailsTagAttrs> | false;

	/**
	 * If set to false, the infoTag extension will not be registered
	 * @example infoTag: false
	 */
	infoTag: Partial<InfoTagAttrs> | false;

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
 * - CalcTag: Displays values calculated from formulas
 * - SwitchTag: Creates conditional switch statements
 * - DetailsTag: Collapsible section with an optional label
 */
export const MarkdocMD = Extension.create<MarkdocExtensionOptions>({
	addKeyboardShortcuts() {
		return {
			Enter: () =>
				shouldInsertLineBreak(this.editor.state) ? this.editor.commands.setHardBreak() : false,
		};
	},

	addExtensions() {
		const extensions: AnyExtension[] = [ConditionTag];

		if (this.options.caseTag !== false) {
			extensions.push(CaseTag.configure(this.options.caseTag));
		}

		if (this.options.calcTag !== false) {
			extensions.push(CalcTag.configure(this.options.calcTag));
		}

		if (this.options.detailsTag !== false) {
			extensions.push(DetailsTag.configure(this.options.detailsTag));
		}

		if (this.options.infoTag !== false) {
			extensions.push(InfoTag.configure(this.options.infoTag));
		}

		if (this.options.switchTag !== false) {
			extensions.push(SwitchTag.configure(this.options.switchTag));
		}

		extensions.push(TagGapCaret);

		return extensions;
	},

	name: "markdoc-md",
});
