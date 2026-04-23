import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { InfoTagView } from "./info-tag-view";

// `variable` remains part of the runtime attrs contract used by the view.
export interface InfoTagAttrs {
	/**
	 * The primary text value for the info tag
	 */
	primary: string | null;
	/**
	 * Optional value type
	 */
	type: "string" | "number" | "date" | null;
	/**
	 * Optional unit to render with the value
	 */
	unit: string | null;
	/**
	 * Optional description for helper text/tooling
	 */
	description: string | null;
	/**
	 * Whether the unit should be rendered inline
	 */
	renderUnit: boolean;
	/**
	 * Optional variable name for dynamic content
	 */
	variable: string | null;
}

export const InfoTag = Node.create<InfoTagAttrs>({
	addAttributes() {
		return {
			description: {
				default: null,
				parseHTML: (element) => element.getAttribute("description"),
				renderHTML: (attributes) => ({
					description: attributes.description,
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
			type: {
				default: null,
				parseHTML: (element) => element.getAttribute("type"),
				renderHTML: (attributes) => ({
					type: attributes.type,
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
		return ReactNodeViewRenderer(InfoTagView);
	},

	atom: true,
	draggable: false,
	group: "inline",
	inline: true,
	isolating: true,

	name: "infoTag",

	parseHTML() {
		return [
			{
				tag: "Info",
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
			"Info",
			mergeAttributes(HTMLAttributes, {
				primary: node.attrs.primary,
			}),
		];
	},
	renderText({ node }: { node: ProseMirrorNode }) {
		const descriptionAttribute = node.attrs.description
			? ` description=${JSON.stringify(node.attrs.description)}`
			: "";
		const typeAttribute = node.attrs.type ? ` type=${JSON.stringify(node.attrs.type)}` : "";
		const unitAttribute = node.attrs.unit ? ` unit=${JSON.stringify(node.attrs.unit)}` : "";
		const renderUnitAttribute = node.attrs.renderUnit ? " renderUnit=true" : "";
		return `{% info ${JSON.stringify(node.attrs.primary ?? "")}${descriptionAttribute}${typeAttribute}${unitAttribute}${renderUnitAttribute} /%}`;
	},

	selectable: true,
});
