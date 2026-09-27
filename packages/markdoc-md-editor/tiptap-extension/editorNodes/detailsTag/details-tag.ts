import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { DetailsTagView } from "./details-tag-view";

export interface DetailsTagAttrs {
	/** Expands the section by default, matching GitHub's `<details open>`. */
	open: boolean;
	/** Optional label; the document falls back to "Details" when absent. */
	summary: string | null;
}

/**
 * GitHub-style collapsed section:
 *
 * ```
 * {% details summary="Laborwerte" open=true %}
 * Inhalt
 * {% /details %}
 * ```
 *
 * The label lives on the `summary` attribute (not in the content), so the
 * round-trip through `htmlToMarkdoc` stays lossless.
 */
export const DetailsTag = Node.create<DetailsTagAttrs>({
	addAttributes() {
		return {
			open: {
				default: false,
				// HTML boolean semantics: a bare `open` means open, only open="false"
				// is closed. TipTap merges attribute parsers over a rule-level
				// `getAttrs`, so the tolerant read has to live here.
				parseHTML: (element) =>
					element.hasAttribute("open") && element.getAttribute("open") !== "false",
				renderHTML: (attributes) => (attributes.open ? { open: "true" } : {}),
			},
			summary: {
				default: null,
				// Our editor HTML carries the label as an attribute. GitHub's child
				// form (`<details open><summary>Label</summary>…</details>`) can reach
				// the editor through a rich-text paste, so read a child summary too.
				parseHTML: (element) => {
					const attribute = element.getAttribute("summary");
					if (attribute?.trim()) {
						return attribute.trim();
					}
					const summaryElement = [...element.children].find(
						(child) => child.tagName.toLowerCase() === "summary",
					);
					return summaryElement?.textContent?.trim() || null;
				},
				renderHTML: (attributes) => (attributes.summary ? { summary: attributes.summary } : {}),
			},
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(DetailsTagView);
	},

	content: "block+",
	defining: true,
	draggable: false,
	group: "block",
	isolating: true,

	name: "detailsTag",

	parseHTML() {
		return [
			{
				// The child summary is the label, not content.
				contentElement: (element) => {
					const summaryElement = [...element.children].find(
						(child) => child.tagName.toLowerCase() === "summary",
					);
					summaryElement?.remove();
					return element;
				},
				tag: "details",
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ["Details", mergeAttributes(HTMLAttributes), 0];
	},

	selectable: true,
});
