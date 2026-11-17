import { Mark } from "@tiptap/core";

const CITE_ATTRIBUTES = ["citations", "quote", "source"] as const;

/**
 * Cited text from `{% cite %}`. The editor keeps the citation's attributes as
 * `renderTipTapHTML` wrote them, so `htmlToMarkdoc` restores the same tag;
 * typing next to a citation does not extend it.
 */
export const CiteMark = Mark.create({
	addAttributes() {
		return Object.fromEntries(
			CITE_ATTRIBUTES.map((name) => [
				name,
				{
					default: null,
					parseHTML: (element: HTMLElement) => element.getAttribute(name),
				},
			]),
		);
	},

	inclusive: false,

	name: "cite",

	// Outside other marks, like a link, so emphasis inside a citation does not split it.
	priority: 1000,

	parseHTML() {
		return [{ tag: "Cite" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["Cite", HTMLAttributes, 0];
	},
});
