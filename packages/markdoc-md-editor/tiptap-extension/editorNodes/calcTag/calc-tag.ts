import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Formula from "fparser";

import {
	parseRoundAttribute,
	renderRoundAttribute,
	serializeRoundAttribute,
} from "../round-attribute";
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

export interface CalcSwitchComponent {
	cases: {
		content?: string;
		primary: string;
		text: string;
		value?: number;
	}[];
	kind: "switch";
	primary: string;
	source?: string | null;
	type?: "boolean" | "string" | null;
}

export type CalcComponent = CalcInfoComponent | CalcSwitchComponent;

const parseCalcSwitchType = (value: string | null): CalcSwitchComponent["type"] => {
	if (value === "checkbox") {
		return "boolean";
	}
	return value === "boolean" || value === "string" ? value : null;
};

const readNumberAttribute = (element: Element, attribute: string): number | undefined => {
	const rawValue = element.getAttribute(attribute);
	if (rawValue === null || !Number.isFinite(Number(rawValue))) {
		return undefined;
	}
	return Number(rawValue);
};

const parseCalcComponents = (element: HTMLElement): CalcComponent[] =>
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
		if (tagName !== "switch") {
			return [];
		}
		return [
			{
				cases: [...child.children]
					.filter(
						(caseElement): caseElement is HTMLElement =>
							caseElement instanceof HTMLElement && caseElement.tagName.toLowerCase() === "case",
					)
					.map((caseElement) => ({
						content: caseElement.dataset.content ?? caseElement.innerHTML,
						primary: caseElement.getAttribute("primary") ?? "",
						text: (caseElement.textContent ?? "").trim(),
						value: readNumberAttribute(caseElement, "value"),
					})),
				kind: "switch",
				primary,
				source: child.getAttribute("source"),
				type: parseCalcSwitchType(child.getAttribute("type")),
			},
		];
	});

const renderCalcComponentHtml = (component: CalcComponent) => {
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
	return [
		"Switch",
		{ primary: component.primary, source: component.source, type: component.type },
		...component.cases.map((caseItem) => [
			"Case",
			{
				"data-content": caseItem.content ?? caseItem.text,
				primary: caseItem.primary,
				value: caseItem.value,
			},
			caseItem.text,
		]),
	];
};

const renderStringAttribute = (name: string, value: string | null | undefined): string =>
	value ? ` ${name}=${JSON.stringify(value)}` : "";

const renderCalcComponentText = (component: CalcComponent): string => {
	if (component.kind === "info") {
		const renderUnit = component.renderUnit ? " renderUnit=true" : "";
		return `{% info ${JSON.stringify(component.primary)}${renderStringAttribute("description", component.description)}${renderStringAttribute("type", component.type)}${renderStringAttribute("unit", component.unit)}${serializeRoundAttribute(component.round)}${renderUnit}${renderStringAttribute("source", component.source)} /%}`;
	}
	const cases = component.cases
		.map((caseItem) => {
			const value = caseItem.value === undefined ? "" : ` value=${caseItem.value}`;
			return `{% case ${JSON.stringify(caseItem.primary)}${value} %}${caseItem.text}{% /case %}`;
		})
		.join("");
	return `{% switch ${JSON.stringify(component.primary)}${renderStringAttribute("type", component.type)}${renderStringAttribute("source", component.source)} %}${cases}{% /switch %}`;
};

const toComponentFromNode = (node: ProseMirrorNode): CalcComponent | null => {
	const primary = typeof node.attrs.primary === "string" ? node.attrs.primary : "";
	if (!primary) {
		return null;
	}
	if (node.type.name === "infoTag") {
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
	if (node.type.name === "switchTag") {
		return {
			cases: Array.isArray(node.attrs.cases) ? node.attrs.cases : [],
			kind: "switch",
			primary,
			source: node.attrs.source,
			type: node.attrs.type,
		};
	}
	return null;
};

/** Adds formula inputs to Calc nodes so legacy and incomplete tags serialize canonically. */
export const ensureCalcFormulaComponents = (tr: Transaction): boolean => {
	const availableComponents = new Map<string, CalcComponent>();
	tr.doc.descendants((node) => {
		const component = toComponentFromNode(node);
		if (component) {
			availableComponents.set(component.primary, component);
		}
		if (node.type.name === "calcTag" && Array.isArray(node.attrs.components)) {
			for (const existing of node.attrs.components as CalcComponent[]) {
				if (existing.primary && !availableComponents.has(existing.primary)) {
					availableComponents.set(existing.primary, existing);
				}
			}
		}
	});

	const updates: { components: CalcComponent[]; pos: number }[] = [];
	tr.doc.descendants((node, pos) => {
		if (node.type.name !== "calcTag" || typeof node.attrs.formula !== "string") {
			return;
		}
		let variables: string[];
		try {
			variables = new Formula(node.attrs.formula).getVariables();
		} catch {
			return;
		}
		const components = Array.isArray(node.attrs.components)
			? (node.attrs.components as CalcComponent[])
			: [];
		const existingPrimaries = new Set(components.map((component) => component.primary));
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
		const primary = node.attrs.primary ? ` primary=${JSON.stringify(node.attrs.primary)}` : "";
		const formula = node.attrs.formula || "";
		const formulaAttribute = ` formula=${JSON.stringify(formula)}`;
		const round = serializeRoundAttribute(node.attrs.round);
		const renderUnit = node.attrs.renderUnit ? " renderUnit=true" : "";
		const unit = node.attrs.unit ? ` unit=${JSON.stringify(node.attrs.unit)}` : "";
		const components = Array.isArray(node.attrs.components)
			? (node.attrs.components as CalcComponent[])
			: [];
		return `{% calc${primary}${formulaAttribute}${unit}${round}${renderUnit} %}${components.map(renderCalcComponentText).join("")}{% /calc %}`;
	},

	selectable: true,
});
