import { Node } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";

import {
	nodeToMarkdoc,
	parseCaseElements,
	readTagPrimary,
	renderBranchingTagHtml,
	toBranchingAttrs,
} from "../case-items";
import { ConditionTagView } from "./condition-tag-view";

/** A numeric condition: selects content from existing values and declares no input of its own. */
export const ConditionTag = Node.create({
	name: "conditionTag",
	group: "inline",
	inline: true,
	atom: true,
	isolating: true,
	selectable: true,
	addAttributes: () => ({
		primary: { default: null, parseHTML: readTagPrimary },
		cases: { default: [], parseHTML: parseCaseElements, renderHTML: () => ({}) },
		description: { default: null, parseHTML: (element) => element.getAttribute("description") },
		unit: { default: null, parseHTML: (element) => element.getAttribute("unit") },
		source: { default: null, parseHTML: (element) => element.getAttribute("source") },
	}),
	parseHTML: () => [
		{
			tag: "Condition",
			getContent: () => Fragment.empty,
		},
	],
	addNodeView: () => ReactNodeViewRenderer(ConditionTagView),
	renderHTML: ({ HTMLAttributes, node }) =>
		renderBranchingTagHtml("Condition", toBranchingAttrs(node), HTMLAttributes),
	renderText: ({ node }) => nodeToMarkdoc(node),
});
