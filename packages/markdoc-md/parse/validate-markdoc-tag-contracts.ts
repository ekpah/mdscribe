import type { Location, Node } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import type { CaseCondition } from "./case-conditions";
import { hasCaseCondition, serializeCaseCondition, toCaseCondition } from "./case-conditions";
import { getFormulaVariables } from "./formula";

/**
 * Every named `info`, `switch`, and `calc` tag declares or uses one shared
 * variable identified by its `primary` name. A variable has exactly one
 * contract: a value domain, identity settings that must agree across all
 * mentions, and the roles the template uses it in.
 */
export type VariableDomain = "boolean" | "date" | "enum" | "number" | "text";

export interface VariableRoles {
	/** Declared by `calc`: derived from a formula, manual override allowed. */
	computed: boolean;
	/** Declared by `info`: user-editable and rendered verbatim. */
	field: boolean;
	/** Declared by `switch`: drives case selection. */
	selector: boolean;
}

export interface VariableContract {
	description?: string;
	domain: VariableDomain;
	formula?: string;
	location?: Location;
	name: string;
	roles: VariableRoles;
	source?: string;
	unit?: string;
}

/** Identity settings that must agree across all mentions of a variable. */
export type MarkdocContractAttribute = "description" | "formula" | "source" | "unit";

export interface MarkdocSettingConflict {
	attribute: MarkdocContractAttribute;
	conflictingValue: string;
	firstLocation?: Location;
	firstValue: string;
}

export type CaseConditionIssue =
	| "conflicting-operators"
	| "empty-range"
	| "missing-condition"
	| "primary-and-condition"
	| "requires-number-switch";

export type MarkdocTagDiagnostic =
	| {
			code: "variable-domain-conflict";
			conflictingDomain: VariableDomain;
			conflictingLocation?: Location;
			firstDomain: VariableDomain;
			firstLocation?: Location;
			name: string;
			severity: "error";
	  }
	| {
			code: "variable-settings-conflict";
			conflictingLocation?: Location;
			conflicts: MarkdocSettingConflict[];
			name: string;
			severity: "error";
	  }
	| {
			code: "case-condition-invalid";
			location?: Location;
			reason: CaseConditionIssue;
			severity: "error";
			switch: string;
	  }
	| {
			code: "case-unreachable";
			location?: Location;
			severity: "error";
			switch: string;
	  }
	| {
			caseKey?: string;
			code: "orphan-case";
			location?: Location;
			severity: "error";
	  }
	| {
			code: "calc-components-missing";
			location?: Location;
			missingComponents: string[];
			calc: string;
			severity: "error";
	  }
	| {
			caseKeys: string[];
			code: "calc-case-values-missing";
			location?: Location;
			calc: string;
			severity: "error";
			switch: string;
	  }
	| {
			caseKey: string;
			code: "case-value-conflict";
			conflictingLocation?: Location;
			conflictingValue: number;
			firstLocation?: Location;
			firstValue: number;
			severity: "error";
			switch: string;
	  };

const toOptionalString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const isTagNode = (node: Node): boolean => node.type === "tag" && typeof node.tag === "string";
const isCalcTag = (node: Node): boolean => node.tag === "calc" || node.tag === "score";

const collectImmediateTags = (nodes: Node[], tags: Set<string>): Node[] => {
	const result: Node[] = [];
	for (const node of nodes) {
		if (node.type === "tag") {
			if (node.tag && tags.has(node.tag)) {
				result.push(node);
			}
			continue;
		}
		result.push(...collectImmediateTags(node.children, tags));
	}
	return result;
};

const getImmediateCases = (node: Node): Node[] =>
	collectImmediateTags(node.children, new Set(["case"]));

/**
 * Derives the value domain a single switch occurrence declares. A switch
 * without an explicit `type` whose cases carry condition attributes is
 * inferred to be a number switch.
 */
export const deriveSwitchDomain = (node: Node): VariableDomain => {
	const type = node.attributes.type;
	if (type === "boolean" || type === "checkbox") {
		return "boolean";
	}
	if (type === "number") {
		return "number";
	}
	if (type === undefined || type === null) {
		const hasConditionCase = getImmediateCases(node).some((caseNode) =>
			hasCaseCondition(caseNode.attributes),
		);
		if (hasConditionCase) {
			return "number";
		}
	}
	return "enum";
};

const deriveInfoDomain = (node: Node): VariableDomain => {
	const type = node.attributes.type;
	if (type === "number") {
		return "number";
	}
	if (type === "date") {
		return "date";
	}
	return "text";
};

interface VariableOccurrence {
	domain: VariableDomain;
	location?: Location;
	role: keyof VariableRoles;
	settings: Partial<Record<MarkdocContractAttribute, string>>;
}

const toOccurrence = (node: Node): { name: string; occurrence: VariableOccurrence } | null => {
	const name = toOptionalString(node.attributes.primary);
	if (!name) {
		return null;
	}
	if (node.tag === "info") {
		return {
			name,
			occurrence: {
				domain: deriveInfoDomain(node),
				location: node.location,
				role: "field",
				settings: {
					description: toOptionalString(node.attributes.description),
					source: toOptionalString(node.attributes.source),
					unit: toOptionalString(node.attributes.unit),
				},
			},
		};
	}
	if (node.tag === "switch") {
		return {
			name,
			occurrence: {
				domain: deriveSwitchDomain(node),
				location: node.location,
				role: "selector",
				settings: {
					description: toOptionalString(node.attributes.description),
					source: toOptionalString(node.attributes.source),
					unit: toOptionalString(node.attributes.unit),
				},
			},
		};
	}
	if (isCalcTag(node)) {
		return {
			name,
			occurrence: {
				domain: "number",
				location: node.location,
				role: "computed",
				settings: {
					formula: toOptionalString(node.attributes.formula),
					unit: toOptionalString(node.attributes.unit),
				},
			},
		};
	}
	return null;
};

interface CanonicalVariable {
	contract: VariableContract;
	settingLocations: Partial<Record<MarkdocContractAttribute, Location | undefined>>;
}

export interface VariableContractsResult {
	contracts: Map<string, VariableContract>;
	diagnostics: MarkdocTagDiagnostic[];
}

const mergeOccurrence = (
	canonical: CanonicalVariable,
	occurrence: VariableOccurrence,
	diagnostics: MarkdocTagDiagnostic[],
): void => {
	const { contract } = canonical;
	if (occurrence.domain !== contract.domain) {
		diagnostics.push({
			code: "variable-domain-conflict",
			conflictingDomain: occurrence.domain,
			conflictingLocation: occurrence.location,
			firstDomain: contract.domain,
			firstLocation: contract.location,
			name: contract.name,
			severity: "error",
		});
		return;
	}

	const conflicts: MarkdocSettingConflict[] = [];
	for (const [attribute, value] of Object.entries(occurrence.settings) as [
		MarkdocContractAttribute,
		string | undefined,
	][]) {
		if (value === undefined) {
			continue;
		}
		const existing = contract[attribute];
		if (existing === undefined) {
			contract[attribute] = value;
			canonical.settingLocations[attribute] = occurrence.location;
			continue;
		}
		if (existing !== value) {
			conflicts.push({
				attribute,
				conflictingValue: value,
				firstLocation: canonical.settingLocations[attribute],
				firstValue: existing,
			});
		}
	}
	if (conflicts.length > 0) {
		diagnostics.push({
			code: "variable-settings-conflict",
			conflictingLocation: occurrence.location,
			conflicts,
			name: contract.name,
			severity: "error",
		});
	}
	contract.roles[occurrence.role] = true;
};

/**
 * Builds the unified variable-contract registry for a parsed template. Every
 * named `info`, `switch`, and `calc` mention contributes to one contract per
 * variable name. Tolerant: never throws for malformed templates.
 */
export const buildVariableContracts = (ast: Node): VariableContractsResult => {
	const canonicals = new Map<string, CanonicalVariable>();
	const diagnostics: MarkdocTagDiagnostic[] = [];

	for (const node of ast.walk()) {
		if (!isTagNode(node)) {
			continue;
		}
		const entry = toOccurrence(node);
		if (!entry) {
			continue;
		}
		const canonical = canonicals.get(entry.name);
		if (!canonical) {
			const contract: VariableContract = {
				domain: entry.occurrence.domain,
				location: entry.occurrence.location,
				name: entry.name,
				roles: { computed: false, field: false, selector: false },
			};
			const created: CanonicalVariable = { contract, settingLocations: {} };
			mergeOccurrence(created, entry.occurrence, diagnostics);
			canonicals.set(entry.name, created);
			continue;
		}
		mergeOccurrence(canonical, entry.occurrence, diagnostics);
	}

	const contracts = new Map<string, VariableContract>();
	for (const [name, canonical] of canonicals) {
		contracts.set(name, canonical.contract);
	}
	return { contracts, diagnostics };
};

const validateCaseCondition = (condition: CaseCondition): CaseConditionIssue | null => {
	const hasRange =
		condition.gt !== undefined ||
		condition.gte !== undefined ||
		condition.lt !== undefined ||
		condition.lte !== undefined;
	if (condition.default && (condition.eq !== undefined || hasRange)) {
		return "conflicting-operators";
	}
	if (condition.eq !== undefined && hasRange) {
		return "conflicting-operators";
	}
	if (
		(condition.gt !== undefined && condition.gte !== undefined) ||
		(condition.lt !== undefined && condition.lte !== undefined)
	) {
		return "conflicting-operators";
	}
	const lower = condition.gt ?? condition.gte;
	const upper = condition.lt ?? condition.lte;
	if (lower !== undefined && upper !== undefined) {
		const inclusiveBoth = condition.gte !== undefined && condition.lte !== undefined;
		if (inclusiveBoth ? upper < lower : upper <= lower) {
			return "empty-range";
		}
	}
	return null;
};

const validateSwitchCases = (
	node: Node,
	contracts: Map<string, VariableContract>,
	caseValues: Map<string, { location?: Location; value: number }>,
	diagnostics: MarkdocTagDiagnostic[],
): void => {
	const switchPrimary = toOptionalString(node.attributes.primary);
	const domain = switchPrimary
		? (contracts.get(switchPrimary)?.domain ?? deriveSwitchDomain(node))
		: deriveSwitchDomain(node);
	const switchName = switchPrimary ?? "";
	let seenDefault = false;

	for (const caseNode of getImmediateCases(node)) {
		const condition = toCaseCondition(caseNode.attributes);
		const caseKey = toOptionalString(caseNode.attributes.primary);

		if (seenDefault) {
			diagnostics.push({
				code: "case-unreachable",
				location: caseNode.location,
				severity: "error",
				switch: switchName,
			});
		}

		if (condition) {
			if (domain !== "number") {
				diagnostics.push({
					code: "case-condition-invalid",
					location: caseNode.location,
					reason: "requires-number-switch",
					severity: "error",
					switch: switchName,
				});
			}
			if (caseKey) {
				diagnostics.push({
					code: "case-condition-invalid",
					location: caseNode.location,
					reason: "primary-and-condition",
					severity: "error",
					switch: switchName,
				});
			}
			const issue = validateCaseCondition(condition);
			if (issue) {
				diagnostics.push({
					code: "case-condition-invalid",
					location: caseNode.location,
					reason: issue,
					severity: "error",
					switch: switchName,
				});
			}
			if (condition.default) {
				seenDefault = true;
			}
		} else if (domain === "number") {
			diagnostics.push({
				code: "case-condition-invalid",
				location: caseNode.location,
				reason: "missing-condition",
				severity: "error",
				switch: switchName,
			});
		}

		// Numeric calc-value mapping consistency for equality cases.
		if (switchPrimary && caseKey && typeof caseNode.attributes.value === "number") {
			const contractKey = `${switchPrimary}\u0000${caseKey}`;
			const first = caseValues.get(contractKey);
			if (!first) {
				caseValues.set(contractKey, {
					location: caseNode.location,
					value: caseNode.attributes.value,
				});
			} else if (first.value !== caseNode.attributes.value) {
				diagnostics.push({
					caseKey,
					code: "case-value-conflict",
					conflictingLocation: caseNode.location,
					conflictingValue: caseNode.attributes.value,
					firstLocation: first.location,
					firstValue: first.value,
					severity: "error",
					switch: switchPrimary,
				});
			}
		}
	}
};

const validateCalcComponents = (
	node: Node,
	contracts: Map<string, VariableContract>,
): MarkdocTagDiagnostic[] => {
	const formula = toOptionalString(node.attributes.formula);
	if (!formula) {
		return [];
	}
	let formulaVariables: string[];
	try {
		formulaVariables = getFormulaVariables(formula);
	} catch {
		return [];
	}

	const calc = toOptionalString(node.attributes.primary) ?? formula;
	const components = collectImmediateTags(node.children, new Set(["info", "switch"]));
	const componentsByPrimary = new Map(
		components
			.map((component) => [toOptionalString(component.attributes.primary), component] as const)
			.filter((entry): entry is readonly [string, Node] => Boolean(entry[0])),
	);
	const missingComponents = formulaVariables.filter(
		(variable) => !componentsByPrimary.has(variable),
	);
	const diagnostics: MarkdocTagDiagnostic[] = [];
	if (missingComponents.length > 0) {
		diagnostics.push({
			calc,
			code: "calc-components-missing",
			location: node.location,
			missingComponents,
			severity: "error",
		});
	}

	for (const variable of formulaVariables) {
		const component = componentsByPrimary.get(variable);
		if (component?.tag !== "switch") {
			continue;
		}
		// Only enum switches map options to numbers through case values.
		// Boolean switches contribute 1/0 and number switches contribute the
		// value itself, so neither requires a mapping.
		const domain = contracts.get(variable)?.domain ?? deriveSwitchDomain(component);
		if (domain !== "enum") {
			continue;
		}
		const caseKeys = getImmediateCases(component)
			.filter((caseNode) => typeof caseNode.attributes.value !== "number")
			.map((caseNode) => toOptionalString(caseNode.attributes.primary))
			.filter((caseKey): caseKey is string => Boolean(caseKey));
		if (caseKeys.length > 0) {
			diagnostics.push({
				caseKeys,
				calc,
				code: "calc-case-values-missing",
				location: component.location,
				severity: "error",
				switch: variable,
			});
		}
	}
	return diagnostics;
};

export const validateMarkdocTagContractsInAst = (ast: Node): MarkdocTagDiagnostic[] => {
	const { contracts, diagnostics } = buildVariableContracts(ast);
	const caseValues = new Map<string, { location?: Location; value: number }>();
	const attachedCases = new Set<Node>();

	for (const node of ast.walk()) {
		if (!isTagNode(node)) {
			continue;
		}
		if (node.tag === "switch") {
			for (const caseNode of getImmediateCases(node)) {
				attachedCases.add(caseNode);
			}
			validateSwitchCases(node, contracts, caseValues, diagnostics);
		} else if (isCalcTag(node)) {
			diagnostics.push(...validateCalcComponents(node, contracts));
		}
	}

	for (const node of ast.walk()) {
		if (node.type !== "tag" || node.tag !== "case" || attachedCases.has(node)) {
			continue;
		}
		const condition = toCaseCondition(node.attributes);
		diagnostics.push({
			caseKey:
				toOptionalString(node.attributes.primary) ??
				(condition ? serializeCaseCondition(condition) : undefined),
			code: "orphan-case",
			location: node.location,
			severity: "error",
		});
	}

	return diagnostics;
};

export const validateMarkdocTagContracts = (content: string): MarkdocTagDiagnostic[] =>
	validateMarkdocTagContractsInAst(Markdoc.parse(content));
