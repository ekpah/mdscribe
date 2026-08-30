import type { Config, RenderableTreeNode } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { markdocConfig as config } from "../markdoc-config";
import { serializeCaseCondition, toCaseCondition } from "./case-conditions";
import { getFormulaVariables } from "./formula";
import type { VariableContract } from "./validate-markdoc-tag-contracts";
import { buildVariableContracts } from "./validate-markdoc-tag-contracts";
import type { MarkdocTemplateDiagnostic } from "./validate-markdoc-template";
import { validateMarkdocTemplateAst } from "./validate-markdoc-template";

/**
 * Union type representing all possible input tag types in the Markdoc template.
 */
export type InputTagType =
	| InfoInputTagType
	| SwitchInputTagType
	| CaseInputTagType
	| CalcInputTagType;

export interface BaseInputTag {
	$$mdtype?: "Tag";
	children: InputTagType[];
}

/**
 * Represents an info tag that captures single values.
 * @example
 * {% info "patient_name" /%}
 */
export type InfoInputTagType = BaseInputTag & {
	name: "Info";
	attributes: {
		primary: string;
		type?: "string" | "number" | "date";
		unit?: string;
		description?: string;
		renderUnit?: boolean;
		round?: number | false;
		source?: string;
	};
};

/**
 * Represents a switch tag for conditional content rendering.
 * Contains case tags as children for different conditions.
 * @example
 * {% switch "gender" %}
 *   {% case "male" %}Male{% /case %}
 * {% /switch %}
 */
export type SwitchInputTagType = BaseInputTag & {
	name: "Switch";
	attributes: {
		primary: string;
		source?: string;
		type?: "string" | "boolean" | "checkbox" | "number";
		unit?: string;
		description?: string;
	};
};

/**
 * Represents a case tag used within switch tags.
 * Defines a specific condition and its content. Equality cases carry a
 * `primary` key; number-switch cases carry structured condition attributes
 * (`eq`, `gt`, `gte`, `lt`, `lte`, `default`) instead.
 * @example
 * {% case "male" %}Male{% /case %}
 * @example
 * {% case gte=4 lt=10 %}...{% /case %}
 */
export type CaseInputTagType = BaseInputTag & {
	name: "Case";
	attributes: {
		primary: string;
		value?: number;
		eq?: number;
		gt?: number;
		gte?: number;
		lt?: number;
		lte?: number;
		default?: boolean;
		index?: number;
	};
};

/**
 * Represents a calc tag for calculating values based on a formula.
 * @example
 * {% calc formula="[age]*2+[gender_score]*3" unit="points" /%}
 */
export type CalcInputTagType = BaseInputTag & {
	name: "Calc";
	attributes: {
		primary: string;
		formula?: string;
		unit?: string;
		renderUnit?: boolean;
		round?: number | false;
	};
};

/** @deprecated Use CalcInputTagType. */
export type ScoreInputTagType = CalcInputTagType;

// Constants for better performance
const VALID_TAG_NAMES = new Set(["Calc", "Info", "Case", "Switch"]);
type ValidTagName = "Calc" | "Info" | "Case" | "Switch";
interface NodeContext {
	path: string;
	type: ValidTagName;
}
type MarkdocTagNode = RenderableTreeNode & {
	$$mdtype: "Tag";
	name: ValidTagName;
	attributes: {
		primary?: string;
		formula?: string;
		type?: string;
		[key: string]: unknown;
	};
	children?: RenderableTreeNode | RenderableTreeNode[];
};

const isValidTagName = (name: unknown): name is ValidTagName =>
	typeof name === "string" && VALID_TAG_NAMES.has(name);

const isMarkdocTagNode = (node: unknown): node is MarkdocTagNode =>
	typeof node === "object" &&
	node !== null &&
	"$$mdtype" in node &&
	node.$$mdtype === "Tag" &&
	"name" in node &&
	isValidTagName(node.name);

const toNodeContext = (path: string, type: ValidTagName): NodeContext => ({
	path,
	type,
});

const toKeyPart = (value: unknown): string => (typeof value === "string" ? value : "");

const toSwitchType = (value: unknown): "string" | "boolean" | "number" | undefined => {
	if (value === "string" || value === "boolean" || value === "number") {
		return value;
	}
	if (value === "checkbox") {
		return "boolean";
	}
	return undefined;
};

const assertNeverTagNode = (node: never): never => {
	throw new Error(`Unsupported Markdoc tag node: ${JSON.stringify(node)}`);
};

const toTagKey = (node: MarkdocTagNode, parentContext?: NodeContext): string => {
	const primary = toKeyPart(node.attributes.primary);
	const formula = toKeyPart(node.attributes.formula);

	switch (node.name) {
		case "Info": {
			return primary ? `Info:${primary}` : `Info:${parentContext?.path ?? "root"}`;
		}
		case "Switch": {
			return primary ? `Switch:${primary}` : `Switch:${parentContext?.path ?? "root"}`;
		}
		case "Case": {
			const condition = primary ? null : toCaseCondition(node.attributes);
			const caseKey = condition ? serializeCaseCondition(condition) : primary;
			return `Case:${parentContext?.path ?? "root"}:${caseKey}`;
		}
		case "Calc": {
			if (primary) {
				return `Calc:${primary}`;
			}
			if (formula) {
				return `CalcFormula:${formula}`;
			}
			return `Calc:${parentContext?.path ?? "root"}`;
		}
		default: {
			return assertNeverTagNode(node);
		}
	}
};

const toInputTagMergeKey = (tag: InputTagType): string => {
	const primary = toKeyPart(tag.attributes.primary);

	if (tag.name === "Calc") {
		const formula = toKeyPart(tag.attributes.formula);
		if (primary) {
			return `Calc:${primary}`;
		}
		if (formula) {
			return `CalcFormula:${formula}`;
		}
	}

	if (tag.name === "Case" && !primary) {
		const condition = toCaseCondition(tag.attributes);
		if (condition) {
			return `Case:${serializeCaseCondition(condition)}`;
		}
	}

	return `${tag.name}:${primary}`;
};

const mergeInfoAttributes = (target: InfoInputTagType, source: InfoInputTagType): void => {
	if (!target.attributes.description && source.attributes.description) {
		target.attributes.description = source.attributes.description;
	}
	if (!target.attributes.type && source.attributes.type) {
		target.attributes.type = source.attributes.type;
	}
	if (!target.attributes.unit && source.attributes.unit) {
		target.attributes.unit = source.attributes.unit;
	}
	if (!target.attributes.source && source.attributes.source) {
		target.attributes.source = source.attributes.source;
	}
};

const mergeCalcAttributes = (target: CalcInputTagType, source: CalcInputTagType): boolean => {
	const hasFormulaConflict = Boolean(
		target.attributes.formula &&
		source.attributes.formula &&
		target.attributes.formula !== source.attributes.formula,
	);
	if (!target.attributes.formula && source.attributes.formula) {
		target.attributes.formula = source.attributes.formula;
	}
	if (!target.attributes.primary && source.attributes.primary) {
		target.attributes.primary = source.attributes.primary;
	}
	if (!target.attributes.unit && source.attributes.unit) {
		target.attributes.unit = source.attributes.unit;
	}
	return !hasFormulaConflict;
};

const mergeSwitchAttributes = (target: SwitchInputTagType, source: SwitchInputTagType): void => {
	if (!target.attributes.source && source.attributes.source) {
		target.attributes.source = source.attributes.source;
	}
	if (!target.attributes.type && source.attributes.type) {
		target.attributes.type = source.attributes.type;
	}
	if (!target.attributes.unit && source.attributes.unit) {
		target.attributes.unit = source.attributes.unit;
	}
	if (!target.attributes.description && source.attributes.description) {
		target.attributes.description = source.attributes.description;
	}
};

const mergeInputTagArrays = (
	targetChildren: InputTagType[],
	sourceChildren: InputTagType[],
	mergeTags: (target: InputTagType, source: InputTagType) => void,
): InputTagType[] => {
	const mergedChildren = [...targetChildren];
	const childIndices = new Map<string, number>();

	for (const [index, child] of mergedChildren.entries()) {
		childIndices.set(toInputTagMergeKey(child), index);
	}

	for (const sourceChild of sourceChildren) {
		const childKey = toInputTagMergeKey(sourceChild);
		const existingChildIndex = childIndices.get(childKey);

		if (existingChildIndex === undefined) {
			childIndices.set(childKey, mergedChildren.length);
			mergedChildren.push(sourceChild);
			continue;
		}

		const existingChild = mergedChildren[existingChildIndex];
		if (existingChild) {
			mergeTags(existingChild, sourceChild);
		}
	}

	return mergedChildren;
};

const mergeInputTags = (target: InputTagType, source: InputTagType): void => {
	if (target.name !== source.name) {
		return;
	}

	if (target.name === "Info" && source.name === "Info") {
		mergeInfoAttributes(target, source);
		return;
	}

	if (target.name === "Calc" && source.name === "Calc") {
		if (mergeCalcAttributes(target, source)) {
			target.children = mergeInputTagArrays(target.children, source.children, mergeInputTags);
		}
		return;
	}

	if (
		(target.name === "Switch" && source.name === "Switch") ||
		(target.name === "Case" && source.name === "Case")
	) {
		if (target.name === "Switch" && source.name === "Switch") {
			mergeSwitchAttributes(target, source);
		}
		target.children = mergeInputTagArrays(target.children, source.children, mergeInputTags);
	}
};

const toInfoTag = (node: MarkdocTagNode, children: InputTagType[]): InfoInputTagType =>
	({
		attributes: node.attributes,
		children,
		name: "Info" as const,
	}) as InfoInputTagType;

const toSwitchTag = (node: MarkdocTagNode, children: InputTagType[]): SwitchInputTagType => {
	let type = toSwitchType(node.attributes.type);
	if (!type) {
		// A switch without an explicit type whose cases carry condition
		// attributes is a number switch (mirrors deriveSwitchDomain).
		const hasConditionCase = children.some(
			(child) => child.name === "Case" && toCaseCondition(child.attributes) !== null,
		);
		if (hasConditionCase) {
			type = "number";
		}
	}
	return {
		attributes: {
			description: toKeyPart(node.attributes.description) || undefined,
			primary: node.attributes.primary ?? "",
			source: toKeyPart(node.attributes.source) || undefined,
			type,
			unit: toKeyPart(node.attributes.unit) || undefined,
		},
		children,
		name: "Switch" as const,
	} as SwitchInputTagType;
};

const toOptionalNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

const toCaseTag = (node: MarkdocTagNode, children: InputTagType[]): CaseInputTagType =>
	({
		attributes: {
			default: node.attributes.default === true ? true : undefined,
			eq: toOptionalNumber(node.attributes.eq),
			gt: toOptionalNumber(node.attributes.gt),
			gte: toOptionalNumber(node.attributes.gte),
			index: toOptionalNumber(node.attributes.index),
			lt: toOptionalNumber(node.attributes.lt),
			lte: toOptionalNumber(node.attributes.lte),
			primary: node.attributes.primary ?? "",
			value: typeof node.attributes.value === "number" ? node.attributes.value : undefined,
		},
		children,
		name: "Case" as const,
	}) as CaseInputTagType;

const appendFormulaVariables = (calcTag: CalcInputTagType, formulaValue: string) => {
	try {
		const existingInputs = new Set<string>();
		const collectExistingInputs = (input: InputTagType) => {
			if (input.name !== "Case" && input.attributes.primary) {
				existingInputs.add(input.attributes.primary);
			}
			for (const child of input.children ?? []) {
				collectExistingInputs(child);
			}
		};
		for (const child of calcTag.children) {
			collectExistingInputs(child);
		}

		for (const variable of getFormulaVariables(formulaValue)) {
			if (existingInputs.has(variable)) {
				continue;
			}
			calcTag.children.push({
				attributes: {
					primary: variable,
					type: "number",
				},
				name: "Info" as const,
			} as InfoInputTagType);
		}
	} catch {
		// Input discovery is intentionally tolerant. Validation reports malformed
		// formulas at editor and mutation boundaries.
	}
};

const toCalcTag = (node: MarkdocTagNode, children: InputTagType[]): CalcInputTagType =>
	({
		attributes: {
			formula: toKeyPart(node.attributes.formula) || undefined,
			primary: toKeyPart(node.attributes.primary),
			renderUnit:
				typeof node.attributes.renderUnit === "boolean" ? node.attributes.renderUnit : undefined,
			round:
				typeof node.attributes.round === "number" || node.attributes.round === false
					? node.attributes.round
					: undefined,
			unit: toKeyPart(node.attributes.unit) || undefined,
		},
		children,
		name: "Calc" as const,
	}) as CalcInputTagType;

const tagBuilders: Record<
	ValidTagName,
	(node: MarkdocTagNode, children: InputTagType[]) => InputTagType
> = {
	Case: toCaseTag,
	Info: toInfoTag,
	Calc: toCalcTag,
	Switch: toSwitchTag,
};

const collectChildTags = (
	children: RenderableTreeNode | RenderableTreeNode[] | undefined,
	tagMap: Map<string, InputTagType>,
	processNode: (
		node: RenderableTreeNode,
		tagMap: Map<string, InputTagType>,
		parentContext?: NodeContext,
	) => InputTagType[],
	parentContext?: NodeContext,
): InputTagType[] => {
	if (!children) {
		return [];
	}

	const childrenArray = Array.isArray(children) ? children : [children];
	const result: InputTagType[] = [];
	for (const child of childrenArray) {
		result.push(...processNode(child, tagMap, parentContext));
	}
	return result;
};

const buildTagFromNode = (
	node: MarkdocTagNode,
	tagKey: string,
	tagMap: Map<string, InputTagType>,
	processNode: (
		node: RenderableTreeNode,
		tagMap: Map<string, InputTagType>,
		parentContext?: NodeContext,
	) => InputTagType[],
): InputTagType | null => {
	if (node.name === "Switch" && !node.attributes.primary) {
		return null;
	}

	const childContext = toNodeContext(tagKey, node.name);
	const children = collectChildTags(node.children, tagMap, processNode, childContext);
	const builder = tagBuilders[node.name];
	return builder ? builder(node, children) : null;
};

const processMarkdocTagNode = (
	node: MarkdocTagNode,
	tagMap: Map<string, InputTagType>,
	processNode: (
		node: RenderableTreeNode,
		tagMap: Map<string, InputTagType>,
		parentContext?: NodeContext,
	) => InputTagType[],
	parentContext?: NodeContext,
): InputTagType[] => {
	const tagKey = toTagKey(node, parentContext);
	const tag = buildTagFromNode(node, tagKey, tagMap, processNode);
	if (!tag) {
		return [];
	}

	const existingTag = tagMap.get(tagKey);
	if (existingTag) {
		mergeInputTags(existingTag, tag);
		return [];
	}

	tagMap.set(tagKey, tag);
	return [tag];
};

const hasNonTagChildren = (
	node: unknown,
): node is {
	children: RenderableTreeNode | RenderableTreeNode[];
} =>
	typeof node === "object" &&
	node !== null &&
	"children" in node &&
	(!("name" in node) || !isValidTagName((node as { name?: unknown }).name));

const processNodeToInputTags = (
	node: RenderableTreeNode,
	tagMap: Map<string, InputTagType>,
	parentContext?: NodeContext,
): InputTagType[] => {
	if (typeof node !== "object" || node === null) {
		return [];
	}
	if (isMarkdocTagNode(node)) {
		return processMarkdocTagNode(node, tagMap, processNodeToInputTags, parentContext);
	}
	if (hasNonTagChildren(node)) {
		return collectChildTags(node.children, tagMap, processNodeToInputTags, parentContext);
	}
	return [];
};

interface VariableOccurrences {
	calc?: CalcInputTagType;
	info?: InfoInputTagType;
	infoOrder: number;
	switch?: SwitchInputTagType;
	switchOrder: number;
}

/**
 * Collapses multiple tag kinds that share one variable name into a single
 * input, so one variable always yields exactly one input control:
 *
 * - Calc + Info: the calc wins (the value is computed); the info's unit fills
 *   a missing calc unit.
 * - Calc + Switch: the calc wins; the switch selects on the computed value and
 *   needs no input of its own. Inputs nested inside its cases are hoisted so
 *   they stay reachable.
 * - Info + Switch (both number): one number input. The info's identity
 *   attributes merge into the switch-shaped input, which takes the earlier
 *   document position of the two.
 */
const deduplicateVariableInputs = (inputs: InputTagType[]): InputTagType[] => {
	const byName = new Map<string, VariableOccurrences>();
	let order = 0;
	const collect = (input: InputTagType) => {
		const sequence = order++;
		const primary = input.attributes.primary;
		if (input.name !== "Case" && primary) {
			const entry = byName.get(primary) ?? { infoOrder: -1, switchOrder: -1 };
			if (input.name === "Calc" && !entry.calc) {
				entry.calc = input;
			} else if (input.name === "Info" && !entry.info) {
				entry.info = input;
				entry.infoOrder = sequence;
			} else if (input.name === "Switch" && !entry.switch) {
				entry.switch = input;
				entry.switchOrder = sequence;
			}
			byName.set(primary, entry);
		}
		for (const child of input.children ?? []) {
			collect(child);
		}
	};
	for (const input of inputs) {
		collect(input);
	}

	const dropped = new Set<InputTagType>();
	const replacements = new Map<InputTagType, InputTagType>();
	const hoisted: InputTagType[] = [];

	for (const entry of byName.values()) {
		if (entry.calc) {
			if (entry.info) {
				if (!entry.calc.attributes.unit && entry.info.attributes.unit) {
					entry.calc.attributes.unit = entry.info.attributes.unit;
				}
				dropped.add(entry.info);
			}
			if (entry.switch) {
				for (const child of entry.switch.children) {
					if (child.name === "Case") {
						hoisted.push(...(child.children ?? []));
					} else {
						hoisted.push(child);
					}
				}
				dropped.add(entry.switch);
			}
			continue;
		}
		if (
			entry.info &&
			entry.switch &&
			entry.info.attributes.type === "number" &&
			entry.switch.attributes.type === "number"
		) {
			const switchAttributes = entry.switch.attributes;
			const infoAttributes = entry.info.attributes;
			if (!switchAttributes.unit && infoAttributes.unit) {
				switchAttributes.unit = infoAttributes.unit;
			}
			if (!switchAttributes.description && infoAttributes.description) {
				switchAttributes.description = infoAttributes.description;
			}
			if (!switchAttributes.source && infoAttributes.source) {
				switchAttributes.source = infoAttributes.source;
			}
			if (entry.infoOrder < entry.switchOrder) {
				// The info appears first: the merged input takes its position.
				replacements.set(entry.info, entry.switch);
				dropped.add(entry.switch);
			} else {
				dropped.add(entry.info);
			}
		}
	}

	if (dropped.size === 0 && hoisted.length === 0) {
		return inputs;
	}

	const prune = (list: InputTagType[]): InputTagType[] => {
		const result: InputTagType[] = [];
		for (const input of list) {
			const replacement = replacements.get(input);
			if (replacement) {
				replacement.children = prune(replacement.children ?? []);
				result.push(replacement);
				continue;
			}
			if (dropped.has(input)) {
				continue;
			}
			input.children = prune(input.children ?? []);
			result.push(input);
		}
		return result;
	};

	return [...prune(inputs), ...prune(hoisted)];
};

const parseTagsToInputs = ({ nodes }: { nodes: RenderableTreeNode }) => {
	const tagMap = new Map<string, InputTagType>();
	const inputs = processNodeToInputTags(nodes, tagMap);
	const appendMissingCalcInputs = (input: InputTagType) => {
		if (input.name === "Calc") {
			appendFormulaVariables(input, input.attributes.formula ?? "");
		}
		for (const child of input.children ?? []) {
			appendMissingCalcInputs(child);
		}
	};
	for (const input of inputs) {
		appendMissingCalcInputs(input);
	}
	return deduplicateVariableInputs(inputs);
};

export interface MarkdocTemplateAnalysis {
	diagnostics: MarkdocTemplateDiagnostic[];
	inputs: InputTagType[];
	variables: VariableContract[];
}

export const analyzeMarkdocTemplate = (
	content: string,
	markdocConfig: Config = config,
): MarkdocTemplateAnalysis => {
	const ast = Markdoc.parse(content);
	const diagnostics = validateMarkdocTemplateAst(ast, markdocConfig);
	const nodes = Markdoc.transform(ast, markdocConfig);
	const variables = [...buildVariableContracts(ast).contracts.values()];
	return { diagnostics, inputs: parseTagsToInputs({ nodes }), variables };
};

// function to take markdoc content and return parsed tags
const parseMarkdocToInputs = (content: string, markdocConfig: Config = config): InputTagType[] => {
	const ast = Markdoc.parse(content);
	const nodes = Markdoc.transform(ast, markdocConfig);
	return parseTagsToInputs({ nodes });
};

export default parseMarkdocToInputs;
