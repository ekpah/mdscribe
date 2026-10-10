import { Node } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

import type { SwitchCase } from "../case-items";
import {
	nodeToMarkdoc,
	parseCaseElements,
	readTagPrimary,
	renderBranchingTagHtml,
	toBranchingAttrs,
} from "../case-items";
import { SwitchTagView } from "./switch-tag-view";

export type { SwitchCase } from "../case-items";

export type SwitchTagType = "string" | "boolean" | "number";

const SWITCH_BOOLEAN_CASE_PRIMARIES = ["true", "false"] as const;

export const isBooleanSwitchType = (value: SwitchTagType | null | undefined): boolean =>
	value === "boolean";

export const normalizeBooleanSwitchCases = (cases: SwitchCase[]): SwitchCase[] =>
	SWITCH_BOOLEAN_CASE_PRIMARIES.map((primary) => {
		const existing = cases.find((caseItem) => caseItem.primary === primary);
		return {
			content: existing?.content ?? existing?.text ?? "",
			primary,
			text: existing?.text ?? "",
			value: existing?.value,
		};
	});

const parseSwitchTagType = (rawType: string | null): SwitchTagType | null => {
	if (rawType === "string" || rawType === "boolean" || rawType === "number") {
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
	primary: string | string[] | null;
	/**
	 * Optional switch type for semantics/rendering.
	 */
	type: SwitchTagType | null;
	/**
	 * Optional source metadata used by upstream value-population flows.
	 */
	source: string | null;
	unit: string | null;
	description: string | null;
	/**
	 * Cases to render within the switch tag
	 */
	cases: SwitchCase[];
}

export const SwitchTag = Node.create<SwitchTagAttrs>({
	addAttributes() {
		return {
			description: { default: null, parseHTML: (element) => element.getAttribute("description") },
			unit: { default: null, parseHTML: (element) => element.getAttribute("unit") },
			cases: {
				default: [],
				parseHTML: parseCaseElements,
				renderHTML: () => ({}),
			},
			primary: { default: null, parseHTML: readTagPrimary },
			source: {
				default: null,
				parseHTML: (element) => element.getAttribute("source"),
				renderHTML: (attributes) => ({
					source: attributes.source,
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
		return renderBranchingTagHtml("Switch", toBranchingAttrs(node), HTMLAttributes);
	},
	renderText({ node }: { node: ProseMirrorNode }) {
		return nodeToMarkdoc(node);
	},

	selectable: true,
});
