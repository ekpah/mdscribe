import type { Location, Node } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { immediateCases } from "../markdoc-config/tags/helpers/cases";
import type { CaseCondition } from "./case-conditions";
import {
	CASE_CONDITION_OPERATORS,
	parseConditionCase,
	toConditionMembers,
} from "./case-conditions";
import { getFormulaVariables } from "./formula";

/**
 * Every named `info`, `switch`, `condition`, and `calc` tag declares or uses
 * one shared variable identified by its `primary` name (each member of an
 * array `condition` primary is one variable). A variable has exactly one
 * contract: a value domain, identity settings that must agree across all
 * mentions, and the roles the template uses it in.
 */
export type VariableDomain = "boolean" | "date" | "enum" | "number" | "text";

export interface VariableRoles {
	/** Declared by `calc`: derived from a formula, manual override allowed. */
	computed: boolean;
	/** Declared by `info`: user-editable and rendered verbatim. */
	field: boolean;
	/** Declared by `switch` or `condition`: drives case selection. */
	selector: boolean;
}

export interface VariableContract {
	description?: string;
	domain: VariableDomain;
	formula?: string;
	/** Canonical shared calc rounding policy; omitted calc round means 2. */
	round?: string;
	location?: Location;
	name: string;
	roles: VariableRoles;
	source?: string;
	unit?: string;
}

/** Identity settings that must agree across all mentions of a variable. */
export type MarkdocContractAttribute = "description" | "formula" | "round" | "source" | "unit";

export interface MarkdocSettingConflict {
	attribute: MarkdocContractAttribute;
	conflictingValue: string;
	firstLocation?: Location;
	firstValue: string;
}

export type CaseConditionIssue =
	| "invalid-literal"
	| "duplicate-predicate"
	| "invalid-members"
	| "group-source-unsupported"
	| "invalid-case-value"
	| "condition-case-value"
	| "conflicting-operators"
	| "empty-range"
	| "missing-condition"
	| "primary-and-condition"
	| "comparison-in-switch"
	| "missing-option"
	| "number-switch-unsupported"
	| "array-switch-unsupported";

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
			calc: string;
			code: "calc-variable-not-numeric";
			domain: "date" | "text";
			location?: Location;
			severity: "error";
			variable: string;
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
			calc: string;
			code: "calc-cycle";
			location?: Location;
			severity: "error";
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

/** Derives the value domain a single (categorical) switch occurrence declares. */
export const deriveSwitchDomain = (node: Node): VariableDomain =>
	node.attributes.type === "boolean" || node.attributes.type === "checkbox" ? "boolean" : "enum";

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

const identitySettings = (node: Node) => ({
	description: toOptionalString(node.attributes.description),
	source: toOptionalString(node.attributes.source),
	unit: toOptionalString(node.attributes.unit),
});

const toOccurrences = (node: Node): { name: string; occurrence: VariableOccurrence }[] => {
	const { location, attributes } = node;
	// Each member of an array condition is a numeric variable; group metadata stays local.
	if (node.tag === "condition" && Array.isArray(attributes.primary)) {
		return attributes.primary
			.filter((name): name is string => typeof name === "string" && name.trim() !== "")
			.map((name) => ({
				name,
				occurrence: { domain: "number", location, role: "selector", settings: {} },
			}));
	}
	const name = toOptionalString(attributes.primary);
	if (!name) {
		return [];
	}
	const occurrence = ((): VariableOccurrence | null => {
		if (node.tag === "info") {
			return {
				domain: deriveInfoDomain(node),
				location,
				role: "field",
				settings: identitySettings(node),
			};
		}
		if (node.tag === "switch") {
			return {
				domain: deriveSwitchDomain(node),
				location,
				role: "selector",
				settings: identitySettings(node),
			};
		}
		if (node.tag === "condition") {
			return { domain: "number", location, role: "selector", settings: identitySettings(node) };
		}
		if (isCalcTag(node)) {
			return {
				domain: "number",
				location,
				role: "computed",
				settings: {
					formula: toOptionalString(attributes.formula),
					round: String(attributes.round ?? 2),
					unit: toOptionalString(attributes.unit),
				},
			};
		}
		return null;
	})();
	return occurrence ? [{ name, occurrence }] : [];
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
 * named mention contributes to one contract per variable name. Tolerant:
 * never throws for malformed templates.
 */
export const buildVariableContracts = (ast: Node): VariableContractsResult => {
	const canonicals = new Map<string, CanonicalVariable>();
	const diagnostics: MarkdocTagDiagnostic[] = [];

	for (const node of ast.walk()) {
		if (!isTagNode(node)) {
			continue;
		}
		for (const { name, occurrence } of toOccurrences(node)) {
			const canonical = canonicals.get(name) ?? {
				contract: {
					domain: occurrence.domain,
					location: occurrence.location,
					name,
					roles: { computed: false, field: false, selector: false },
				},
				settingLocations: {},
			};
			mergeOccurrence(canonical, occurrence, diagnostics);
			canonicals.set(name, canonical);
		}
	}

	const contracts = new Map<string, VariableContract>();
	for (const [name, canonical] of canonicals) {
		contracts.set(name, canonical.contract);
	}
	return { contracts, diagnostics };
};

/** Issues of one member's comparisons that parsing alone does not detect. */
const validateCaseCondition = (condition: CaseCondition): CaseConditionIssue | null => {
	const hasLower = condition.gt !== undefined || condition.gte !== undefined;
	const hasUpper = condition.lt !== undefined || condition.lte !== undefined;
	if (
		(condition.eq !== undefined && (hasLower || hasUpper)) ||
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

type CaseIssueReporter = (reason: CaseConditionIssue, target?: Node) => void;

const caseIssueReporter =
	(node: Node, name: string, diagnostics: MarkdocTagDiagnostic[]): CaseIssueReporter =>
	(reason, target = node) =>
		diagnostics.push({
			code: "case-condition-invalid",
			location: target.location,
			reason,
			severity: "error",
			switch: name,
		});

const reportUnreachableCases = (
	node: Node,
	name: string,
	diagnostics: MarkdocTagDiagnostic[],
): void => {
	let seenDefault = false;
	for (const caseNode of immediateCases(node)) {
		if (seenDefault) {
			diagnostics.push({
				code: "case-unreachable",
				location: caseNode.location,
				severity: "error",
				switch: name,
			});
		}
		seenDefault ||= caseNode.attributes.default === true;
	}
};

/** Numeric `condition` cases: well-formed, satisfiable, and distinct comparisons. */
const validateConditionCases = (node: Node, diagnostics: MarkdocTagDiagnostic[]): void => {
	const { primary } = node.attributes;
	const name = Array.isArray(primary) ? primary.join(", ") : String(primary ?? "");
	const report = caseIssueReporter(node, name, diagnostics);
	if (!toConditionMembers(primary)) {
		report("invalid-members");
	}
	if (Array.isArray(primary) && node.attributes.source !== undefined) {
		report("group-source-unsupported");
	}
	reportUnreachableCases(node, name, diagnostics);
	const predicates = new Set<string>();
	for (const caseNode of immediateCases(node)) {
		if (caseNode.attributes.primary !== undefined) {
			report("primary-and-condition", caseNode);
		}
		if (caseNode.attributes.value !== undefined) {
			report("condition-case-value", caseNode);
		}
		const condition = parseConditionCase(caseNode.attributes, primary);
		if (typeof condition === "string") {
			report(condition, caseNode);
			continue;
		}
		for (const member of condition.members) {
			const issue = member && validateCaseCondition(member);
			if (issue) {
				report(issue, caseNode);
			}
		}
		const predicate = JSON.stringify(condition);
		if (predicates.has(predicate)) {
			report("duplicate-predicate", caseNode);
		}
		predicates.add(predicate);
	}
};

/** Categorical `switch` cases: distinct option keys with consistent global numeric values. */
const validateSwitchCases = (
	node: Node,
	caseValues: Map<string, { location?: Location; value: number }>,
	diagnostics: MarkdocTagDiagnostic[],
): void => {
	const { primary } = node.attributes;
	const name = Array.isArray(primary) ? primary.join(", ") : String(primary ?? "");
	const report = caseIssueReporter(node, name, diagnostics);
	if (Array.isArray(primary)) {
		report("array-switch-unsupported");
	}
	if (node.attributes.type === "number") {
		report("number-switch-unsupported");
	}
	// A switch default is a fallback wherever it stands, so later keyed cases stay reachable.

	const keys = new Set<string>();
	for (const caseNode of immediateCases(node)) {
		const isDefault = caseNode.attributes.default === true;
		const caseKey = toOptionalString(caseNode.attributes.primary);
		const { value } = caseNode.attributes;
		const hasComparison = CASE_CONDITION_OPERATORS.some(
			(operator) => caseNode.attributes[operator] !== undefined,
		);
		if (hasComparison) {
			report(isDefault ? "conflicting-operators" : "comparison-in-switch", caseNode);
		}
		if (isDefault && caseKey) {
			report("primary-and-condition", caseNode);
		}
		if (
			value !== undefined &&
			(isDefault || typeof value !== "number" || !Number.isFinite(value))
		) {
			report("invalid-case-value", caseNode);
		}
		if (!caseKey) {
			// Only the rendering fallback has no option key.
			if (!isDefault && !hasComparison) {
				report("missing-option", caseNode);
			}
			continue;
		}
		if (keys.has(caseKey)) {
			report("duplicate-predicate", caseNode);
		}
		keys.add(caseKey);

		// A numeric mapping is shared by every switch with this primary.
		if (typeof primary !== "string" || typeof value !== "number") {
			continue;
		}
		const contractKey = `${primary}\u0000${caseKey}`;
		const first = caseValues.get(contractKey);
		if (!first) {
			caseValues.set(contractKey, { location: caseNode.location, value });
		} else if (first.value !== value) {
			diagnostics.push({
				caseKey,
				code: "case-value-conflict",
				conflictingLocation: caseNode.location,
				conflictingValue: value,
				firstLocation: first.location,
				firstValue: first.value,
				severity: "error",
				switch: primary,
			});
		}
	}
};

/**
 * A formula needs numbers: a text or date field it uses (an info without
 * `type="number"`) would silently count as 0, and every option of an enum
 * switch it uses needs a numeric value somewhere.
 */
const validateCalcVariables = (
	node: Node,
	contracts: Map<string, VariableContract>,
	switches: Map<string, Node[]>,
): MarkdocTagDiagnostic[] => {
	const formula = toOptionalString(node.attributes.formula);
	let formulaVariables: string[] = [];
	try {
		formulaVariables = formula ? getFormulaVariables(formula) : [];
	} catch {
		return [];
	}

	const calc = toOptionalString(node.attributes.primary) ?? formula ?? "";
	const diagnostics: MarkdocTagDiagnostic[] = [];
	for (const variable of formulaVariables) {
		const contract = contracts.get(variable);
		if (contract?.domain === "text" || contract?.domain === "date") {
			diagnostics.push({
				calc,
				code: "calc-variable-not-numeric",
				domain: contract.domain,
				location: contract.location,
				severity: "error",
				variable,
			});
			continue;
		}
		if (contract?.domain !== "enum") {
			continue;
		}
		const occurrences = switches.get(variable) ?? [];
		const mapped = new Map<string, boolean>();
		for (const caseNode of occurrences.flatMap(immediateCases)) {
			const key = toOptionalString(caseNode.attributes.primary);
			if (key) {
				mapped.set(key, mapped.get(key) || typeof caseNode.attributes.value === "number");
			}
		}
		const caseKeys = [...mapped].filter(([, hasValue]) => !hasValue).map(([key]) => key);
		if (caseKeys.length > 0) {
			diagnostics.push({
				caseKeys,
				calc,
				code: "calc-case-values-missing",
				location: occurrences[0]?.location,
				severity: "error",
				switch: variable,
			});
		}
	}
	return diagnostics;
};

/** Named calculations that depend on themselves, directly or through other calcs. */
const validateCalcCycles = (calcs: Node[]): MarkdocTagDiagnostic[] => {
	const dependencies = new Map<string, { location?: Location; names: string[] }>();
	for (const node of calcs) {
		const name = toOptionalString(node.attributes.primary);
		if (!name || dependencies.has(name)) {
			continue;
		}
		let names: string[] = [];
		try {
			names = getFormulaVariables(toOptionalString(node.attributes.formula) ?? "");
		} catch {
			/* Malformed formulas are reported by the calc schema. */
		}
		dependencies.set(name, { location: node.location, names });
	}
	const cyclic = new Set<string>();
	const finished = new Set<string>();
	const path: string[] = [];
	const visit = (name: string) => {
		if (finished.has(name) || !dependencies.has(name)) {
			return;
		}
		const start = path.indexOf(name);
		if (start >= 0) {
			for (const member of path.slice(start)) {
				cyclic.add(member);
			}
			return;
		}
		path.push(name);
		for (const dependency of dependencies.get(name)?.names ?? []) {
			visit(dependency);
		}
		path.pop();
		finished.add(name);
	};
	for (const name of dependencies.keys()) {
		visit(name);
	}
	return [...cyclic].map((calc) => ({
		calc,
		code: "calc-cycle",
		location: dependencies.get(calc)?.location,
		severity: "error",
	}));
};

export const validateMarkdocTagContractsInAst = (ast: Node): MarkdocTagDiagnostic[] => {
	const { contracts, diagnostics } = buildVariableContracts(ast);
	const caseValues = new Map<string, { location?: Location; value: number }>();
	const attachedCases = new Set<Node>();
	const switches = new Map<string, Node[]>();
	const calcs: Node[] = [];

	for (const node of ast.walk()) {
		if (!isTagNode(node)) {
			continue;
		}
		if (node.tag === "switch" || node.tag === "condition") {
			for (const caseNode of immediateCases(node)) {
				attachedCases.add(caseNode);
			}
		}
		if (node.tag === "condition") {
			validateConditionCases(node, diagnostics);
		} else if (node.tag === "switch") {
			validateSwitchCases(node, caseValues, diagnostics);
			const name = toOptionalString(node.attributes.primary);
			if (name) {
				switches.set(name, [...(switches.get(name) ?? []), node]);
			}
		} else if (isCalcTag(node)) {
			calcs.push(node);
		}
	}
	for (const calc of calcs) {
		diagnostics.push(...validateCalcVariables(calc, contracts, switches));
	}
	diagnostics.push(...validateCalcCycles(calcs));

	for (const node of ast.walk()) {
		if (node.type !== "tag" || node.tag !== "case" || attachedCases.has(node)) {
			continue;
		}
		diagnostics.push({
			caseKey: toOptionalString(node.attributes.primary),
			code: "orphan-case",
			location: node.location,
			severity: "error",
		});
	}

	return diagnostics;
};

export const validateMarkdocTagContracts = (content: string): MarkdocTagDiagnostic[] =>
	validateMarkdocTagContractsInAst(Markdoc.parse(content));
