import type { Location, Node } from "@markdoc/markdoc";
import * as Markdoc from "@markdoc/markdoc";

export type MarkdocContractAttribute = "description" | "formula" | "source" | "type" | "unit";
type MarkdocInputTagKind = "info" | "switch";
type MarkdocValidatedTagKind = MarkdocInputTagKind | "score";

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

const validateScoreTag = (
	node: Node,
	contracts: Map<string, CanonicalTagContract>,
): MarkdocTagDiagnostic | null => {
	const primary = toOptionalString(node.attributes.primary);
	if (!primary) {
		return null;
	}

	const canonical = contracts.get(primary);
	if (!canonical) {
		contracts.set(primary, toCanonicalContract("score", node));
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
		tag: "score",
	};
};

export const validateMarkdocTagContractsInAst = (ast: Node): MarkdocTagDiagnostic[] => {
	const inputContracts = new Map<string, CanonicalTagContract>();
	const scoreContracts = new Map<string, CanonicalTagContract>();
	const diagnostics: MarkdocTagDiagnostic[] = [];

	for (const node of ast.walk()) {
		if (!isTagNode(node)) {
			continue;
		}

		let diagnostic: MarkdocTagDiagnostic | null = null;
		if (node.tag === "info") {
			diagnostic = validateInputTag(node, "info", inputContracts);
		} else if (node.tag === "switch") {
			diagnostic = validateInputTag(node, "switch", inputContracts);
		} else if (node.tag === "score") {
			diagnostic = validateScoreTag(node, scoreContracts);
		}

		if (diagnostic) {
			diagnostics.push(diagnostic);
		}
	}

	return diagnostics;
};

export const validateMarkdocTagContracts = (content: string): MarkdocTagDiagnostic[] =>
	validateMarkdocTagContractsInAst(Markdoc.parse(content));
