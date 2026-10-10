import { Node, mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { getFormulaVariables } from "markdoc-md/parse";

import type { SwitchCase } from "../case-items";
import {
	parseCaseElements,
	readTagPrimary,
	nodeToMarkdoc,
	renderBranchingTagHtml,
} from "../case-items";
import { parseRoundAttribute, renderRoundAttribute } from "../round-attribute";
import { CalcTagView } from "./calc-tag-view";

/** An info input referenced by a calculated tag. */
export interface CalcInfoComponent {
	description?: string | null;
	kind: "info";
	primary: string;
	renderUnit?: boolean;
	round?: number | false | null;
	source?: string | null;
	type?: "date" | "number" | "string" | null;
	unit?: string | null;
}

/** A categorical switch referenced by a calculated tag. */
export interface CalcSwitchComponent {
	cases: SwitchCase[];
	kind: "switch";
	/** An array primary is invalid for switches but kept for validation to report. */
	primary: string | string[];
	description?: string | null;
	unit?: string | null;
	source?: string | null;
	type?: "boolean" | "string" | "number" | null;
}

/** A numeric condition whose members a calculated tag references. */
export interface CalcConditionComponent {
	cases: SwitchCase[];
	kind: "condition";
	primary: string | string[];
	description?: string | null;
	unit?: string | null;
	source?: string | null;
}

export type CalcComponent = CalcInfoComponent | CalcSwitchComponent | CalcConditionComponent;

/** The variable names a component declares; a condition declares each member. */
export const calcComponentNames = (component: CalcComponent): string[] =>
	Array.isArray(component.primary) ? component.primary : [component.primary];

const parseCalcSwitchType = (value: string | null): CalcSwitchComponent["type"] => {
	if (value === "checkbox") {
		return "boolean";
	}
	return value === "boolean" || value === "string" || value === "number" ? value : null;
};

export const parseCalcComponents = (element: HTMLElement): CalcComponent[] =>
	[...element.children].flatMap((child): CalcComponent[] => {
		if (!(child instanceof HTMLElement)) {
			return [];
		}
		const tagName = child.tagName.toLowerCase();
		const primary = child.getAttribute("primary") ?? "";
		if (tagName === "info") {
			const round = parseRoundAttribute(child);
			return [
				{
					description: child.getAttribute("description"),
					kind: "info",
					primary,
					...(round === null ? {} : { round }),
					renderUnit:
						(child.getAttribute("renderunit") ?? child.getAttribute("renderUnit")) === "true",
					source: child.getAttribute("source"),
					type: child.getAttribute("type") as CalcInfoComponent["type"],
					unit: child.getAttribute("unit"),
				},
			];
		}
		const branching = {
			cases: parseCaseElements(child),
			description: child.getAttribute("description"),
			source: child.getAttribute("source"),
			unit: child.getAttribute("unit"),
		};
		if (tagName === "condition") {
			return [{ ...branching, kind: "condition", primary: readTagPrimary(child) ?? "" }];
		}
		if (tagName === "switch") {
			return [
				{
					...branching,
					kind: "switch",
					primary: readTagPrimary(child) ?? "",
					type: parseCalcSwitchType(child.getAttribute("type")),
				},
			];
		}
		return [];
	});

export const renderCalcComponentHtml = (component: CalcComponent): DOMOutputSpec => {
	if (component.kind === "info") {
		return [
			"Info",
			{
				description: component.description,
				primary: component.primary,
				renderUnit: component.renderUnit ? "true" : null,
				round: renderRoundAttribute(component.round),
				source: component.source,
				type: component.type,
				unit: component.unit,
			},
		];
	}
	return renderBranchingTagHtml(component.kind === "condition" ? "Condition" : "Switch", component);
};

/** The component a document tag would contribute to a calc that references it. */
export const toCalcComponent = (node: ProseMirrorNode): CalcComponent | null => {
	const { primary } = node.attrs;
	if (!primary || (typeof primary !== "string" && !Array.isArray(primary))) {
		return null;
	}
	if (node.type.name === "infoTag" && typeof primary === "string") {
		return {
			description: node.attrs.description,
			kind: "info",
			primary,
			...(node.attrs.round === null ? {} : { round: node.attrs.round }),
			renderUnit: node.attrs.renderUnit,
			source: node.attrs.source,
			type: node.attrs.type,
			unit: node.attrs.unit,
		};
	}
	const branching = {
		cases: Array.isArray(node.attrs.cases) ? node.attrs.cases : [],
		description: node.attrs.description,
		source: node.attrs.source,
		unit: node.attrs.unit,
	};
	if (node.type.name === "conditionTag") {
		return { ...branching, kind: "condition", primary };
	}
	if (node.type.name === "switchTag") {
		return { ...branching, kind: "switch", primary, type: node.attrs.type };
	}
	return null;
};

/** Adds formula inputs using existing declarations before synthesizing numeric fields. */
export const ensureCalcFormulaComponents = (tr: Transaction, rootDocument = tr.doc): boolean => {
	const availableComponents = new Map<string, CalcComponent>();
	const collect = (component: CalcComponent) => {
		for (const name of calcComponentNames(component)) {
			if (!name || availableComponents.has(name)) {
				continue;
			}
			// A condition only compares numbers; the calc needs the field, not the condition.
			availableComponents.set(
				name,
				component.kind === "condition"
					? { kind: "info", primary: name, type: "number" }
					: component.kind === "switch"
						? // Only the option values matter; copied case content would duplicate its inputs.
							{ ...component, cases: component.cases.map(({ content: _content, ...item }) => item) }
						: component,
			);
		}
		if (component.kind === "info") {
			return;
		}
		// Declarations inside case content count too, so no conflicting number input is invented.
		for (const item of component.cases) {
			if (!item.content) {
				continue;
			}
			const content = document.createElement("div");
			content.innerHTML = item.content;
			for (const element of content.querySelectorAll("info, switch, condition")) {
				const wrapper = document.createElement("div");
				wrapper.append(element.cloneNode(true));
				for (const nested of parseCalcComponents(wrapper)) {
					collect(nested);
				}
			}
		}
	};
	for (const document of rootDocument === tr.doc ? [tr.doc] : [tr.doc, rootDocument]) {
		document.descendants((node) => {
			const component = toCalcComponent(node);
			if (component) {
				collect(component);
			}
			if (node.type.name === "calcTag" && Array.isArray(node.attrs.components)) {
				for (const existing of node.attrs.components as CalcComponent[]) {
					collect(existing);
				}
			}
		});
	}

	const updates: { components: CalcComponent[]; pos: number }[] = [];
	tr.doc.descendants((node, pos) => {
		if (node.type.name !== "calcTag" || typeof node.attrs.formula !== "string") {
			return;
		}
		let variables: string[];
		try {
			variables = getFormulaVariables(node.attrs.formula);
		} catch {
			return;
		}
		const components = Array.isArray(node.attrs.components)
			? (node.attrs.components as CalcComponent[])
			: [];
		const existingPrimaries = new Set(components.flatMap(calcComponentNames));
		const missingComponents = variables
			.filter((variable) => !existingPrimaries.has(variable))
			.map(
				(variable): CalcComponent =>
					availableComponents.get(variable) ?? {
						kind: "info",
						primary: variable,
						type: "number",
					},
			);
		if (missingComponents.length > 0) {
			updates.push({ components: [...components, ...missingComponents], pos });
		}
	});

	for (const update of updates) {
		const node = tr.doc.nodeAt(update.pos);
		if (node) {
			tr.setNodeMarkup(update.pos, undefined, { ...node.attrs, components: update.components });
		}
	}
	return updates.length > 0;
};

export interface CalcTagAttrs {
	/** Inputs explicitly contained by and referenced from the formula. */
	components: CalcComponent[];
	description: string | null;
	source: string | null;
	/**
	 * Optional display key for the calculated value
	 */
	primary: string | null;
	/**
	 * The formula to calculate the value
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
	/** Number of decimal places, or false to disable rounding. */
	round: number | false | null;
}

export const CalcTag = Node.create<CalcTagAttrs>({
	addAttributes() {
		return {
			components: {
				default: [],
				renderHTML: () => ({}),
			},
			description: { default: null, parseHTML: (element) => element.getAttribute("description") },
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
			round: {
				default: null,
				parseHTML: parseRoundAttribute,
				renderHTML: (attributes) => ({
					round: renderRoundAttribute(attributes.round),
				}),
			},
			source: { default: null, parseHTML: (element) => element.getAttribute("source") },
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
		return ReactNodeViewRenderer(CalcTagView);
	},
	atom: true,
	draggable: false,
	group: "inline",
	inline: true,

	name: "calcTag",

	parseHTML() {
		return [
			{
				getAttrs: (element) =>
					element instanceof HTMLElement ? { components: parseCalcComponents(element) } : false,
				tag: "Calc",
			},
			{
				getAttrs: (element) =>
					element instanceof HTMLElement ? { components: parseCalcComponents(element) } : false,
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
		const components = Array.isArray(node.attrs.components)
			? (node.attrs.components as CalcComponent[])
			: [];
		return [
			"Calc",
			mergeAttributes(HTMLAttributes, {
				formula: node.attrs.formula,
				primary: node.attrs.primary,
				renderUnit: node.attrs.renderUnit ? "true" : null,
				round: renderRoundAttribute(node.attrs.round),
				unit: node.attrs.unit,
			}),
			...components.map(renderCalcComponentHtml),
		];
	},

	renderText({ node }: { node: ProseMirrorNode }) {
		return nodeToMarkdoc(node);
	},

	selectable: true,
});
