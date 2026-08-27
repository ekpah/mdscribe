import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { CaseTagView } from "./case-tag-view";

export interface CaseTagOptions {
	HTMLAttributes: Record<string, unknown>;
}

/**
 * Represents a case within a switch statement in Markdoc.
 * {% case "value" %}
 * Content for this case
 * {% /case %}
 */
export const CaseTag = Node.create<CaseTagOptions>({
	addAttributes() {
		return {
			primary: {
				default: "",
				parseHTML: (element) => element.getAttribute("primary"),
				renderHTML: (attributes) => ({
					primary: attributes.primary,
				}),
			},
			value: {
				default: null,
				parseHTML: (element) => {
					const value = element.getAttribute("value");
					return value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
				},
				renderHTML: (attributes) => ({ value: attributes.value }),
			},
		};
	},
	addNodeView() {
		return ReactNodeViewRenderer(CaseTagView);
	},
	content: "inline*",
	draggable: false,
	inline: true,
	name: "caseTag",
	parseHTML() {
		return [
			{
				tag: "Case",
			},
		];
	},
	renderHTML({
		HTMLAttributes,
		node,
	}: {
		HTMLAttributes: Record<string, string>;
		node: ProseMirrorNode;
	}) {
		return [
			"Case",
			mergeAttributes(HTMLAttributes, {
				primary: node.attrs.primary,
				value: node.attrs.value,
			}),
			0,
		];
	},
	renderText({ node }: { node: ProseMirrorNode }) {
		const casePrimary = node.attrs.primary;
		const casePrimaryValue = casePrimary ? JSON.stringify(casePrimary) : '""';
		const caseValue = node.attrs.value === null ? "" : ` value=${node.attrs.value}`;
		const caseContent = node.textContent;
		return `{% case ${casePrimaryValue}${caseValue} %}${caseContent}{% /case %}`;
	},
	selectable: true,
});
