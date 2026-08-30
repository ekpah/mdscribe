import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { serializeCaseConditionAttrs } from "../case-condition";
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
			...Object.fromEntries(
				["eq", "gt", "gte", "lt", "lte"].map((name) => [
					name,
					{
						default: null,
						parseHTML: (element: HTMLElement) =>
							element.hasAttribute(name) ? Number(element.getAttribute(name)) : null,
					},
				]),
			),
			isDefault: {
				default: false,
				parseHTML: (element) => element.getAttribute("default") === "true",
			},
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
				eq: node.attrs.eq,
				gt: node.attrs.gt,
				gte: node.attrs.gte,
				lt: node.attrs.lt,
				lte: node.attrs.lte,
				default: node.attrs.isDefault ? "true" : undefined,
			}),
			0,
		];
	},
	renderText({ node }: { node: ProseMirrorNode }) {
		const condition = serializeCaseConditionAttrs(node.attrs);
		if (condition) return `{% case ${condition} %}${node.textContent}{% /case %}`;
		const casePrimary = node.attrs.primary;
		const casePrimaryValue = casePrimary ? JSON.stringify(casePrimary) : '""';
		const caseValue = node.attrs.value === null ? "" : ` value=${node.attrs.value}`;
		const caseContent = node.textContent;
		return `{% case ${casePrimaryValue}${caseValue} %}${caseContent}{% /case %}`;
	},
	selectable: true,
});
