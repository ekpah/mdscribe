import type { Config, Node, RenderableTreeNode } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { markdocConfig as config } from "../markdoc-config";
import { getFormulaVariables } from "./formula";
import type { BranchVisibility, SwitchSelection } from "./switch-selection";
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
	/** Occurrence visibility is separate from scalar field attributes. */
	visibility?: BranchVisibility[];
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
 * Represents a categorical switch tag for conditional content rendering.
 * Contains case tags as children for its options.
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
		unit?: string;
		description?: string;
	};
};

/**
 * Represents a case tag used within switch tags: an option key with its
 * content, or the occurrence's `default` rendering fallback.
 * @example
 * {% case "male" value=1 %}Male{% /case %}
 */
export type CaseInputTagType = BaseInputTag & {
	name: "Case";
	attributes: {
		primary: string;
		value?: number;
		default?: boolean;
		index?: number;
	};
};

/**
 * Represents a calc tag for calculating values based on a formula.
 * @example
 * {% calc "risk" formula="[age]*2+[gender_score]*3" unit="points" /%}
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
const VALID_TAG_NAMES = new Set(["Calc", "Info", "Case", "Switch", "Condition"]);
type ValidTagName = "Calc" | "Info" | "Case" | "Switch" | "Condition";
interface NodeContext {
	path: string;
	type: ValidTagName;
}
type MarkdocTagNode = RenderableTreeNode & {
	$$mdtype: "Tag";
	name: ValidTagName;
	attributes: {
		primary?: string | string[];
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
		case "Condition": {
			return `Condition:${parentContext?.path ?? "root"}`;
		}
		case "Case": {
			return `Case:${parentContext?.path ?? "root"}:${toCaseKey(node.attributes)}`;
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

/** Switch options are keyed by `primary`; the rendering fallback has none. */
const toCaseKey = (attributes: Record<string, unknown>): string =>
	toKeyPart(attributes.primary) || (attributes.default === true ? "default" : "");

const toInputTagMergeKey = (tag: InputTagType): string => {
	const primary = toKeyPart(tag.attributes.primary);
	if (tag.visibility?.length) {
		return `${tag.name}:${primary}:${JSON.stringify(tag.visibility)}`;
	}

	if (tag.name === "Calc") {
		const formula = toKeyPart(tag.attributes.formula);
		if (primary) {
			return `Calc:${primary}`;
		}
		if (formula) {
			return `CalcFormula:${formula}`;
		}
	}

	if (tag.name === "Case") {
		return `Case:${toCaseKey(tag.attributes)}`;
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
	const type = toSwitchType(node.attributes.type);
	// Capture selection before same-field occurrences merge their input controls.
	const cases = children.filter((child) => child.name === "Case");
	const selection: SwitchSelection = {
		primary: node.attributes.primary ?? "",
		type,
		cases: cases.map((branch) => branch.attributes),
	};
	for (const [index, branch] of cases.entries()) {
		branch.visibility = [{ selection, index }];
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
			index: toOptionalNumber(node.attributes.index),
			primary: toKeyPart(node.attributes.primary),
			value: toOptionalNumber(node.attributes.value),
		},
		children,
		name: "Case" as const,
	}) as CaseInputTagType;

const appendFormulaVariables = (
	calcTag: CalcInputTagType,
	formulaValue: string,
	selectors: Map<string, SwitchInputTagType>,
) => {
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
			// A formula reference inherits the declared selector, not a synthetic number input.
			const selector = selectors.get(variable);
			if (selector) {
				calcTag.children.push({ ...selector, children: [...selector.children] });
				continue;
			}
			calcTag.children.push({
				attributes: { primary: variable, type: "number" },
				children: [],
				name: "Info",
			});
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
	Exclude<ValidTagName, "Condition">,
	(node: MarkdocTagNode, children: InputTagType[]) => InputTagType
> = {
	Case: toCaseTag,
	Info: toInfoTag,
	Calc: toCalcTag,
	Switch: toSwitchTag,
};

type ProcessNode = (
	node: RenderableTreeNode,
	tagMap: Map<string, InputTagType>,
	parentContext?: NodeContext,
) => InputTagType[];

const collectChildTags = (
	children: RenderableTreeNode | RenderableTreeNode[] | undefined,
	tagMap: Map<string, InputTagType>,
	processNode: ProcessNode,
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

/**
 * A condition declares no input of its own: it contributes one numeric field
 * per primary member, followed by its cases' inputs, each guarded by that
 * occurrence's branch selection. Array-group metadata stays local.
 */
const toConditionInputs = (
	node: MarkdocTagNode,
	processNode: ProcessNode,
	parentContext?: NodeContext,
): InputTagType[] => {
	const { primary } = node.attributes;
	const names = (Array.isArray(primary) ? primary : [primary]).filter(
		(name): name is string => typeof name === "string" && name !== "",
	);
	const fields: InputTagType[] = names.map((name) => ({
		attributes: {
			primary: name,
			type: "number",
			...(Array.isArray(primary)
				? {}
				: {
						description: toKeyPart(node.attributes.description) || undefined,
						source: toKeyPart(node.attributes.source) || undefined,
						unit: toKeyPart(node.attributes.unit) || undefined,
					}),
		},
		children: [],
		name: "Info",
	}));
	const children = Array.isArray(node.children) ? node.children : [node.children];
	const branches = children.filter(
		(child): child is MarkdocTagNode => isMarkdocTagNode(child) && child.name === "Case",
	);
	const selection: SwitchSelection = {
		cases: branches.map((branch) => branch.attributes),
		primary: primary ?? "",
		type: "number",
	};
	for (const [index, branch] of branches.entries()) {
		for (const input of collectChildTags(branch.children, new Map(), processNode, parentContext)) {
			input.visibility = [{ index, selection }, ...(input.visibility ?? [])];
			fields.push(input);
		}
	}
	return fields;
};

const processMarkdocTagNode = (
	node: MarkdocTagNode,
	tagMap: Map<string, InputTagType>,
	processNode: ProcessNode,
	parentContext?: NodeContext,
): InputTagType[] => {
	if (node.name === "Condition") {
		return toConditionInputs(node, processNode, parentContext);
	}
	// Switches are categorical; numeric or multi-field switches are invalid and declare nothing.
	if (
		node.name === "Switch" &&
		(typeof node.attributes.primary !== "string" ||
			!node.attributes.primary ||
			node.attributes.type === "number")
	) {
		return [];
	}
	const tagKey = toTagKey(node, parentContext);
	// Children get their own merge scope, so a nested mention never absorbs an
	// independent mention elsewhere in the document.
	const children = collectChildTags(
		node.children,
		new Map(),
		processNode,
		toNodeContext(tagKey, node.name),
	);
	const tag = tagBuilders[node.name](node, children);

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

/**
 * Collapses mentions of a variable within each input list: repeated mentions
 * merge, and a calc replaces an info of the same name (the value is computed
 * and the info's unit fills a missing calc unit). Branch-guarded inputs stay
 * separate, so nested controls never suppress independent ones.
 */
const deduplicateVariableInputs = (inputs: InputTagType[]): InputTagType[] => {
	const calculations = new Map<string, CalcInputTagType>();
	for (const input of inputs) {
		input.children = deduplicateVariableInputs(input.children ?? []);
		const { primary } = input.attributes;
		if (input.name === "Calc" && primary && !input.visibility && !calculations.has(primary)) {
			calculations.set(primary, input);
		}
	}
	const remaining = inputs.filter((input) => {
		if (input.name !== "Info" || input.visibility) {
			return true;
		}
		const calculation = calculations.get(input.attributes.primary);
		if (calculation) {
			calculation.attributes.unit ||= input.attributes.unit;
		}
		return !calculation;
	});
	return mergeInputTagArrays([], remaining, mergeInputTags);
};

/**
 * Every categorical switch variable as one selector offering all options of
 * all its occurrences, with their shared numeric mappings and no content.
 */
const collectSelectors = (inputs: InputTagType[]): Map<string, SwitchInputTagType> => {
	const selectors = new Map<string, SwitchInputTagType>();
	const visit = (input: InputTagType) => {
		if (input.name === "Switch") {
			const selector = selectors.get(input.attributes.primary) ?? {
				attributes: { ...input.attributes },
				children: [],
				name: "Switch",
			};
			for (const option of input.children) {
				if (option.name !== "Case" || !option.attributes.primary) {
					continue;
				}
				const existing = selector.children.find(
					(child): child is CaseInputTagType =>
						child.name === "Case" && child.attributes.primary === option.attributes.primary,
				);
				if (existing) {
					existing.attributes.value ??= option.attributes.value;
					continue;
				}
				selector.children.push({
					attributes: { primary: option.attributes.primary, value: option.attributes.value },
					children: [],
					name: "Case",
				});
			}
			selectors.set(input.attributes.primary, selector);
		}
		for (const child of input.children ?? []) {
			visit(child);
		}
	};
	for (const input of inputs) {
		visit(input);
	}
	return selectors;
};

const parseTagsToInputs = ({ nodes }: { nodes: RenderableTreeNode }) => {
	const tagMap = new Map<string, InputTagType>();
	const inputs = processNodeToInputTags(nodes, tagMap);
	const selectors = collectSelectors(inputs);
	const complete = (input: InputTagType) => {
		if (input.name === "Calc") {
			appendFormulaVariables(input, input.attributes.formula ?? "", selectors);
		}
		if (input.name === "Switch") {
			// Every control offers the shared options and mappings; borrowed options have no content.
			for (const option of selectors.get(input.attributes.primary)?.children ?? []) {
				if (option.name !== "Case") {
					continue;
				}
				const matches = input.children.filter(
					(child): child is CaseInputTagType =>
						child.name === "Case" && child.attributes.primary === option.attributes.primary,
				);
				for (const match of matches) {
					match.attributes.value = option.attributes.value;
				}
				if (matches.length === 0) {
					input.children.push({ ...option, attributes: { ...option.attributes }, children: [] });
				}
			}
		}
		for (const child of input.children ?? []) {
			complete(child);
		}
	};
	for (const input of inputs) {
		complete(input);
	}
	return deduplicateVariableInputs(inputs);
};

const applyFieldContracts = (
	inputs: InputTagType[],
	contracts: Map<string, VariableContract>,
): InputTagType[] => {
	for (const input of inputs) {
		if (input.name !== "Case") {
			const contract = contracts.get(input.attributes.primary);
			if (contract) {
				for (const key of ["unit", "description", "source"] as const) {
					if (contract[key] !== undefined) {
						Object.assign(input.attributes, { [key]: contract[key] });
					}
				}
			}
		}
		applyFieldContracts(input.children ?? [], contracts);
	}
	return inputs;
};

export interface MarkdocTemplateAnalysis {
	diagnostics: MarkdocTemplateDiagnostic[];
	inputs: InputTagType[];
	variables: VariableContract[];
}

/** Inputs and variable contracts of a parsed template, from one transform. */
export const extractTemplateInputs = (
	ast: Node,
	markdocConfig: Config = config,
): { contracts: Map<string, VariableContract>; inputs: InputTagType[] } => {
	const { contracts } = buildVariableContracts(ast);
	const nodes = Markdoc.transform(ast, markdocConfig);
	return { contracts, inputs: applyFieldContracts(parseTagsToInputs({ nodes }), contracts) };
};

export const analyzeMarkdocTemplate = (
	content: string,
	markdocConfig: Config = config,
): MarkdocTemplateAnalysis => {
	const ast = Markdoc.parse(content);
	const { contracts, inputs } = extractTemplateInputs(ast, markdocConfig);
	return {
		diagnostics: validateMarkdocTemplateAst(ast, markdocConfig),
		inputs,
		variables: [...contracts.values()],
	};
};

// function to take markdoc content and return parsed tags
const parseMarkdocToInputs = (content: string, markdocConfig: Config = config): InputTagType[] =>
	extractTemplateInputs(Markdoc.parse(content), markdocConfig).inputs;

export default parseMarkdocToInputs;
