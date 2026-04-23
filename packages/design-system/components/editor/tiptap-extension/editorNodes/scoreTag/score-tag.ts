import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { ScoreTagView } from "./score-tag-view";

export interface ScoreTagAttrs {
	/**
	 * Optional display key for the score
	 */
	primary: string | null;
	/**
	 * The formula to calculate the score
	 */
	formula: string | null;
	/**
	 * Optional unit for the calculated value
	 */
	unit: string | null;
	/**
	 * Whether the unit should be rendered inline
	 */
	renderUnit: boolean;
}

export const ScoreTag = Node.create<ScoreTagAttrs>({
	addAttributes() {
		return {
			formula: {
				default: null,
				parseHTML: (element) => element.getAttribute("formula"),
				renderHTML: (attributes) => ({
					formula: attributes.formula,
				}),
			},
			primary: {
				default: null,
				parseHTML: (element) => element.getAttribute("primary"),
				renderHTML: (attributes) => ({
					primary: attributes.primary,
				}),
			},
			renderUnit: {
				default: false,
				parseHTML: (element) => {
					const rawValue = element.getAttribute("renderunit") ?? element.getAttribute("renderUnit");
					return rawValue === "true";
				},
				renderHTML: (attributes) => ({
					renderUnit: attributes.renderUnit ? "true" : null,
				}),
			},
			unit: {
				default: null,
				parseHTML: (element) => element.getAttribute("unit"),
				renderHTML: (attributes) => ({
					unit: attributes.unit,
				}),
			},
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(ScoreTagView);
	},
	atom: true,
	draggable: false,
	group: "inline",
	inline: true,

	name: "scoreTag",

	parseHTML() {
		return [
			{
				tag: "Score",
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
			"Score",
			mergeAttributes(HTMLAttributes, {
				formula: node.attrs.formula,
				primary: node.attrs.primary,
				renderUnit: node.attrs.renderUnit ? "true" : null,
				unit: node.attrs.unit,
			}),
		];
	},

	renderText({ node }: { node: ProseMirrorNode }) {
		const primary = node.attrs.primary ? ` primary=${JSON.stringify(node.attrs.primary)}` : "";
		const formula = node.attrs.formula || "";
		const formulaAttribute = ` formula=${JSON.stringify(formula)}`;
		const renderUnit = node.attrs.renderUnit ? " renderUnit=true" : "";
		const unit = node.attrs.unit ? ` unit=${JSON.stringify(node.attrs.unit)}` : "";
		return `{% score${primary}${formulaAttribute}${unit}${renderUnit} /%}`;
	},

	selectable: true,
});
