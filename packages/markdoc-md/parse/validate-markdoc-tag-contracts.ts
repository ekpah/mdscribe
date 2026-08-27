import type { Location, Node } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { getFormulaVariables } from "./formula";

export type MarkdocContractAttribute = "description" | "formula" | "source" | "type" | "unit";
type MarkdocInputTagKind = "info" | "switch";
type MarkdocValidatedTagKind = MarkdocInputTagKind | "calc";

export interface MarkdocSettingConflict {
	attribute: MarkdocContractAttribute;
	conflictingValue: string;
	firstLocation?: Location;
	firstValue: string;
}

export type MarkdocTagDiagnostic =
	| {
			code: "tag-kind-conflict";
			conflictingLocation?: Location;
			conflictingTag: MarkdocInputTagKind;
			firstLocation?: Location;
			firstTag: MarkdocInputTagKind;
			primary: string;
			severity: "error";
	  }
	| {
			code: "tag-settings-conflict";
			conflictingLocation?: Location;
			conflicts: MarkdocSettingConflict[];
			primary: string;
			severity: "error";
			tag: MarkdocValidatedTagKind;
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

interface CanonicalSetting {
	location?: Location;
	value: string;
}

interface CanonicalTagContract {
	kind: MarkdocValidatedTagKind;
	location?: Location;
	settings: Partial<Record<MarkdocContractAttribute, CanonicalSetting>>;
}

type ContractSetting = readonly [MarkdocContractAttribute, string | undefined];

const toOptionalString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const toInfoType = (value: unknown): string => toOptionalString(value) ?? "string";

const toSwitchContractType = (value: unknown): string => {
	if (value === "boolean" || value === "checkbox") {
		return "boolean";
	}
	return "string";
};

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

const validateCalcComponents = (node: Node): MarkdocTagDiagnostic[] => {
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
		if (
			component?.tag !== "switch" ||
			component.attributes.type === "boolean" ||
			component.attributes.type === "checkbox"
		) {
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

const getContractSettings = (kind: MarkdocValidatedTagKind, node: Node): ContractSetting[] => {
	if (kind === "info") {
		return [
			["type", toInfoType(node.attributes.type)],
			["unit", toOptionalString(node.attributes.unit)],
			["description", toOptionalString(node.attributes.description)],
			["source", toOptionalString(node.attributes.source)],
		];
	}
	if (kind === "switch") {
		return [
			["type", toSwitchContractType(node.attributes.type)],
			["source", toOptionalString(node.attributes.source)],
		];
	}
	return [["formula", toOptionalString(node.attributes.formula)]];
};

const toCanonicalContract = (kind: MarkdocValidatedTagKind, node: Node): CanonicalTagContract => {
	const settings: CanonicalTagContract["settings"] = {};
	for (const [attribute, value] of getContractSettings(kind, node)) {
		if (value !== undefined) {
			settings[attribute] = { location: node.location, value };
		}
	}
	return { kind, location: node.location, settings };
};

const compareContract = (canonical: CanonicalTagContract, node: Node): MarkdocSettingConflict[] => {
	const conflicts: MarkdocSettingConflict[] = [];
	for (const [attribute, currentValue] of getContractSettings(canonical.kind, node)) {
		if (currentValue === undefined) {
			continue;
		}

		const firstSetting = canonical.settings[attribute];
		if (!firstSetting) {
			canonical.settings[attribute] = { location: node.location, value: currentValue };
			continue;
		}

		if (firstSetting.value !== currentValue) {
			conflicts.push({
				attribute,
				conflictingValue: currentValue,
				firstLocation: firstSetting.location,
				firstValue: firstSetting.value,
			});
		}
	}
	return conflicts;
};

const validateInputTag = (
	node: Node,
	kind: MarkdocInputTagKind,
	contracts: Map<string, CanonicalTagContract>,
): MarkdocTagDiagnostic | null => {
	const primary = toOptionalString(node.attributes.primary);
	if (!primary) {
		return null;
	}

	const canonical = contracts.get(primary);
	if (!canonical) {
		contracts.set(primary, toCanonicalContract(kind, node));
		return null;
	}

	if (canonical.kind !== kind) {
		return {
			code: "tag-kind-conflict",
			conflictingLocation: node.location,
			conflictingTag: kind,
			firstLocation: canonical.location,
			firstTag: canonical.kind as MarkdocInputTagKind,
			primary,
			severity: "error",
		};
	}

	const conflicts = compareContract(canonical, node);
	if (conflicts.length === 0) {
		return null;
	}

	return {
		code: "tag-settings-conflict",
		conflictingLocation: node.location,
		conflicts,
		primary,
		severity: "error",
		tag: kind,
	};
};

const validateCalcTag = (
	node: Node,
	contracts: Map<string, CanonicalTagContract>,
): MarkdocTagDiagnostic | null => {
	const primary = toOptionalString(node.attributes.primary);
	if (!primary) {
		return null;
	}

	const canonical = contracts.get(primary);
	if (!canonical) {
		contracts.set(primary, toCanonicalContract("calc", node));
		return null;
	}

	const conflicts = compareContract(canonical, node);
	if (conflicts.length === 0) {
		return null;
	}

	return {
		code: "tag-settings-conflict",
		conflictingLocation: node.location,
		conflicts,
		primary,
		severity: "error",
		tag: "calc",
	};
};

export const validateMarkdocTagContractsInAst = (ast: Node): MarkdocTagDiagnostic[] => {
	const inputContracts = new Map<string, CanonicalTagContract>();
	const calcContracts = new Map<string, CanonicalTagContract>();
	const diagnostics: MarkdocTagDiagnostic[] = [];
	const caseValues = new Map<string, { location?: Location; value: number }>();

	for (const node of ast.walk()) {
		if (!isTagNode(node)) {
			continue;
		}

		let diagnostic: MarkdocTagDiagnostic | null = null;
		if (node.tag === "info") {
			diagnostic = validateInputTag(node, "info", inputContracts);
		} else if (node.tag === "switch") {
			diagnostic = validateInputTag(node, "switch", inputContracts);
			const switchPrimary = toOptionalString(node.attributes.primary);
			if (switchPrimary) {
				for (const caseNode of getImmediateCases(node)) {
					const caseKey = toOptionalString(caseNode.attributes.primary);
					const caseValue = caseNode.attributes.value;
					if (!caseKey || typeof caseValue !== "number") {
						continue;
					}
					const contractKey = `${switchPrimary}\u0000${caseKey}`;
					const first = caseValues.get(contractKey);
					if (!first) {
						caseValues.set(contractKey, { location: caseNode.location, value: caseValue });
					} else if (first.value !== caseValue) {
						diagnostics.push({
							caseKey,
							code: "case-value-conflict",
							conflictingLocation: caseNode.location,
							conflictingValue: caseValue,
							firstLocation: first.location,
							firstValue: first.value,
							severity: "error",
							switch: switchPrimary,
						});
					}
				}
			}
		} else if (isCalcTag(node)) {
			diagnostic = validateCalcTag(node, calcContracts);
			diagnostics.push(...validateCalcComponents(node));
		}

		if (diagnostic) {
			diagnostics.push(diagnostic);
		}
	}

	return diagnostics;
};

export const validateMarkdocTagContracts = (content: string): MarkdocTagDiagnostic[] =>
	validateMarkdocTagContractsInAst(Markdoc.parse(content));
