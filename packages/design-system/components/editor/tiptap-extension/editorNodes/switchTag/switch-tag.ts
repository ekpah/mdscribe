import { Node, mergeAttributes } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

// Renamed import
import { SwitchTagView } from "./switch-tag-view";

const decodeCaseContent = (value: string | null): string => {
	if (!value) {
		return "";
	}
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

export interface SwitchCase {
	primary: string;
	text: string;
	content?: string;
}

export type SwitchTagType = "string" | "boolean";

const parseSwitchTagType = (rawType: string | null): SwitchTagType | null => {
	if (rawType === "string" || rawType === "boolean") {
		return rawType;
	}
	if (rawType === "checkbox") {
		return "boolean";
	}
	return null;
};

export interface SwitchTagAttrs {
	/**
	 * The primary text value for the switch tag (e.g., the variable to switch on)
	 */
	primary: string | null;
	/**
	 * Optional switch type for semantics/rendering.
	 */
	type: SwitchTagType | null;
	/**
	 * Cases to render within the switch tag
	 */
	cases: SwitchCase[];
	/**
	 * Optional variable name for dynamic content (might not be needed for switch)
	 */
	// Keep for consistency for now, might remove later
	variable: string | null;
}

export const SwitchTag = Node.create<SwitchTagAttrs>({
	addAttributes() {
		return {
			cases: {
				default: [],
				renderHTML: () => ({}),
			},
				primary: {
					default: null,
					parseHTML: (element) => element.getAttribute("primary"),
					renderHTML: (attributes) => ({
						primary: attributes.primary,
					}),
				},
					type: {
						default: null,
						parseHTML: (element) => {
							const rawType = element.getAttribute("type");
							return parseSwitchTagType(rawType);
						},
						renderHTML: (attributes) => ({
							type: attributes.type,
						}),
					},
			};
		},

	addNodeView() {
		return ReactNodeViewRenderer(SwitchTagView);
	},
	atom: true,
	draggable: false,
	group: "inline",
	inline: true,
	isolating: true,

	name: "switchTag",

	parseHTML() {
		return [
			{
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) {
						return false;
					}
						const primary = element.getAttribute("primary");
						const rawType = element.getAttribute("type");
						const type = parseSwitchTagType(rawType);
						const caseElements = [...element.children].filter(
							(child) => child.tagName.toLowerCase() === "case",
						);
					const cases = caseElements.map((child) => ({
						content: decodeCaseContent(child.getAttribute("data-content")) || child.innerHTML || "",
						primary: child.getAttribute("primary") ?? "",
						text: (child.textContent ?? "").trim(),
					}));

						return {
							cases,
							primary,
							type,
						};
					},
					getContent: () => Fragment.empty,
				tag: "Switch",
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
		const cases: SwitchCase[] = Array.isArray(node.attrs.cases) ? node.attrs.cases : [];
		const caseNodes = cases.map((caseItem) => [
			"Case",
			{
				"data-content": encodeURIComponent(caseItem.content ?? caseItem.text ?? ""),
				primary: caseItem.primary ?? "",
			},
			caseItem.text ?? "",
		]);

			return [
				"Switch",
				mergeAttributes(HTMLAttributes, {
					primary: node.attrs.primary,
					type: node.attrs.type,
				}),
				...caseNodes,
			];
		},
		renderText({ node }: { node: ProseMirrorNode }) {
			const switchPrimary = node.attrs.primary;
			const switchPrimaryValue = switchPrimary ? JSON.stringify(switchPrimary) : '""';
			const switchType = node.attrs.type as SwitchTagType | null | undefined;
			const switchTypeAttribute = switchType ? ` type=${JSON.stringify(switchType)}` : "";
			const cases: SwitchCase[] = Array.isArray(node.attrs.cases) ? node.attrs.cases : [];
			const content = cases
				.map((caseItem) => {
				const casePrimaryValue = caseItem.primary ? JSON.stringify(caseItem.primary) : '""';
				const caseText = caseItem.text ?? "";
				return `{% case ${casePrimaryValue} %}${caseText}{% /case %}`;
				})
				.join("");

			return `{% switch ${switchPrimaryValue}${switchTypeAttribute} %}${content}{% /switch %}`;
		},

	selectable: true,
});
