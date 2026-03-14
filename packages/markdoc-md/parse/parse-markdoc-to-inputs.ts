import type { RenderableTreeNode } from "@markdoc/markdoc";
import * as Markdoc from "@markdoc/markdoc";
import Formula from "fparser";
import config from "@/markdoc-config";

/**
 * Union type representing all possible input tag types in the Markdoc template.
 * Extends RenderableTreeNode to include Markdoc's base node properties.
 */
export type InputTagType = RenderableTreeNode &
	(
		| InfoInputTagType
		| SwitchInputTagType
		| CaseInputTagType
		| ScoreInputTagType
	);

/**
 * Represents an info tag that captures single values.
 * @example
 * {% info "patient_name" /%}
 */
export type InfoInputTagType = RenderableTreeNode & {
	name: "Info";
	attributes: {
		primary: string;
		type?: "string" | "number" | "date";
		unit?: string;
		description?: string;
		renderUnit?: boolean;
	};
	children: InputTagType[];
};

/**
 * Represents a switch tag for conditional content rendering.
 * Contains case tags as children for different conditions.
 * @example
 * {% switch "gender" %}
 *   {% case "male" %}Male{% /case %}
 * {% /switch %}
 */
export type SwitchInputTagType = RenderableTreeNode & {
	name: "Switch";
	attributes: {
		primary: string;
	};
	children: InputTagType[];
};

/**
 * Represents a case tag used within switch tags.
 * Defines a specific condition and its content.
 * @example
 * {% case "male" %}Male{% /case %}
 */
type CaseInputTagType = RenderableTreeNode & {
	name: "Case";
	attributes: {
		primary: string;
	};
	children: InputTagType[];
};

/**
 * Represents a score tag for calculating values based on a formula.
 * @example
 * {% score formula="[age]*2+[gender_score]*3" unit="points" /%}
 */
type ScoreInputTagType = RenderableTreeNode & {
	name: "Score";
	attributes: {
		primary: string;
		formula?: string;
		unit?: string;
	};
	children: InputTagType[];
};

// Constants for better performance
const VALID_TAG_NAMES = new Set(["Info", "Case", "Switch", "Score"]);
type ValidTagName = "Info" | "Case" | "Score" | "Switch";
interface NodeContext {
	path: string;
	type: ValidTagName;
}
interface MarkdocTagNode extends RenderableTreeNode {
	$$mdtype: "Tag";
	name: ValidTagName;
	attributes: {
		primary?: string;
		formula?: string;
		[key: string]: unknown;
	};
	children?: RenderableTreeNode | RenderableTreeNode[];
}

const isValidTagName = (name: unknown): name is ValidTagName =>
	typeof name === "string" && VALID_TAG_NAMES.has(name);

const isMarkdocTagNode = (node: RenderableTreeNode): node is MarkdocTagNode =>
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

const toTagKey = (node: MarkdocTagNode): string =>
	`${node.name}_${node.attributes.primary}`;

const toInfoTag = (
	node: MarkdocTagNode,
	children: InputTagType[],
): InfoInputTagType =>
	({
		attributes: node.attributes,
		children,
		name: "Info" as const,
	}) as InfoInputTagType;

const toSwitchTag = (
	node: MarkdocTagNode,
	children: InputTagType[],
): SwitchInputTagType =>
	({
		attributes: { primary: node.attributes.primary ?? "" },
		children,
		name: "Switch" as const,
	}) as SwitchInputTagType;

const toCaseTag = (
	node: MarkdocTagNode,
	children: InputTagType[],
): CaseInputTagType =>
	({
		attributes: { primary: node.attributes.primary ?? "" },
		children,
		name: "Case" as const,
	}) as CaseInputTagType;

const appendFormulaVariables = (scoreTag: ScoreInputTagType, formulaValue: string) => {
	try {
		const formula = new Formula(formulaValue);
		for (const variable of formula.getVariables()) {
			scoreTag.children.push({
				attributes: {
					primary: variable,
					type: "number",
				},
				name: "Info" as const,
			} as InfoInputTagType);
		}
	} catch (error) {
		console.error("Error parsing formula", error);
	}
};

const toScoreTag = (
	node: MarkdocTagNode,
	children: InputTagType[],
): ScoreInputTagType => {
	const scoreTag = {
		attributes: node.attributes,
		children,
		name: "Score" as const,
	} as ScoreInputTagType;
	appendFormulaVariables(scoreTag, node.attributes.formula ?? "");
	return scoreTag;
};

const tagBuilders: Record<
	ValidTagName,
	(node: MarkdocTagNode, children: InputTagType[]) => InputTagType
> = {
	Case: toCaseTag,
	Info: toInfoTag,
	Score: toScoreTag,
	Switch: toSwitchTag,
};

const collectChildTags = (
	children: RenderableTreeNode | RenderableTreeNode[] | undefined,
	uniqueTags: Set<string>,
	processNode: (
		node: RenderableTreeNode,
		uniqueTags: Set<string>,
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
		result.push(...processNode(child, uniqueTags, parentContext));
	}
	return result;
};

const buildTagFromNode = (
	node: MarkdocTagNode,
	tagKey: string,
	uniqueTags: Set<string>,
	processNode: (
		node: RenderableTreeNode,
		uniqueTags: Set<string>,
		parentContext?: NodeContext,
	) => InputTagType[],
): InputTagType | null => {
	if (node.name === "Switch" && !node.attributes.primary) {
		return null;
	}

	const childContext = toNodeContext(tagKey, node.name);
	const children = collectChildTags(
		node.children,
		uniqueTags,
		processNode,
		childContext,
	);
	const builder = tagBuilders[node.name];
	return builder ? builder(node, children) : null;
};

const processMarkdocTagNode = (
	node: MarkdocTagNode,
	uniqueTags: Set<string>,
	processNode: (
		node: RenderableTreeNode,
		uniqueTags: Set<string>,
		parentContext?: NodeContext,
	) => InputTagType[],
): InputTagType[] => {
	const tagKey = toTagKey(node);
	if (uniqueTags.has(tagKey)) {
		return [];
	}

	const tag = buildTagFromNode(node, tagKey, uniqueTags, processNode);
	if (!tag) {
		return [];
	}

	uniqueTags.add(tagKey);
	return [tag];
};

const hasNonTagChildren = (
	node: RenderableTreeNode,
): node is RenderableTreeNode & {
	children: RenderableTreeNode | RenderableTreeNode[];
} => "children" in node && !("name" in node && isValidTagName(node.name));

const processNodeToInputTags = (
	node: RenderableTreeNode,
	uniqueTags: Set<string>,
	parentContext?: NodeContext,
): InputTagType[] => {
	if (typeof node !== "object" || node === null) {
		return [];
	}
	if (isMarkdocTagNode(node)) {
		return processMarkdocTagNode(node, uniqueTags, processNodeToInputTags);
	}
	if (hasNonTagChildren(node)) {
		return collectChildTags(
			node.children,
			uniqueTags,
			processNodeToInputTags,
			parentContext,
		);
	}
	return [];
};

const parseTagsToInputs = ({ nodes }: { nodes: RenderableTreeNode }) => {
	const uniqueTags = new Set<string>();
	return processNodeToInputTags(nodes, uniqueTags);
};

// function to take markdoc content and return parsed tags
const parseMarkdocToInputs = (content: string): InputTagType[] => {
	const ast = Markdoc.parse(content);
	const nodes = Markdoc.transform(ast, config);
	return parseTagsToInputs({ nodes });
};

export default parseMarkdocToInputs;
