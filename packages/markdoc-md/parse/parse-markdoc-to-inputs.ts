import type { Config, RenderableTreeNode } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { markdocConfig as config } from "../markdoc-config";
import { getFormulaVariables } from "./formula";
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
		type?: "string" | "boolean" | "checkbox";
	};
};

/**
 * Represents a case tag used within switch tags.
 * Defines a specific condition and its content.
 * @example
 * {% case "male" %}Male{% /case %}
 */
export type CaseInputTagType = BaseInputTag & {
	name: "Case";
	attributes: {
		primary: string;
		value?: number;
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

const toSwitchType = (value: unknown): "string" | "boolean" | undefined => {
	if (value === "string" || value === "boolean") {
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
			return `Case:${parentContext?.path ?? "root"}:${primary}`;
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

const toSwitchTag = (node: MarkdocTagNode, children: InputTagType[]): SwitchInputTagType =>
	({
		attributes: {
			primary: node.attributes.primary ?? "",
			source: toKeyPart(node.attributes.source) || undefined,
			type: toSwitchType(node.attributes.type),
		},
		children,
		name: "Switch" as const,
	}) as SwitchInputTagType;

const toCaseTag = (node: MarkdocTagNode, children: InputTagType[]): CaseInputTagType =>
	({
		attributes: {
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
	return inputs;
};

export interface MarkdocTemplateAnalysis {
	diagnostics: MarkdocTemplateDiagnostic[];
	inputs: InputTagType[];
}

export const analyzeMarkdocTemplate = (
	content: string,
	markdocConfig: Config = config,
): MarkdocTemplateAnalysis => {
	const ast = Markdoc.parse(content);
	const diagnostics = validateMarkdocTemplateAst(ast, markdocConfig);
	const nodes = Markdoc.transform(ast, markdocConfig);
	return { diagnostics, inputs: parseTagsToInputs({ nodes }) };
};

// function to take markdoc content and return parsed tags
const parseMarkdocToInputs = (content: string, markdocConfig: Config = config): InputTagType[] => {
	const ast = Markdoc.parse(content);
	const nodes = Markdoc.transform(ast, markdocConfig);
	return parseTagsToInputs({ nodes });
};

export default parseMarkdocToInputs;
