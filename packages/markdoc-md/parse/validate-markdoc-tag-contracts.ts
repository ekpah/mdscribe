import type { Location, Node } from "@markdoc/markdoc";
import * as Markdoc from "@markdoc/markdoc";

export type MarkdocContractAttribute = "description" | "formula" | "type" | "unit";
export type MarkdocInputTagKind = "info" | "switch";
export type MarkdocValidatedTagKind = MarkdocInputTagKind | "score";

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

const addCanonicalSetting = (
	contract: CanonicalTagContract,
	attribute: MarkdocContractAttribute,
	value: string | undefined,
	location: Location | undefined,
): void => {
	if (value === undefined) {
		return;
	}

	contract.settings[attribute] = { location, value };
};

const compareSetting = ({
	attribute,
	canonical,
	conflicts,
	currentLocation,
	currentValue,
}: {
	attribute: MarkdocContractAttribute;
	canonical: CanonicalTagContract;
	conflicts: MarkdocSettingConflict[];
	currentLocation?: Location;
	currentValue: string | undefined;
}): void => {
	if (currentValue === undefined) {
		return;
	}

	const firstSetting = canonical.settings[attribute];
	if (!firstSetting) {
		addCanonicalSetting(canonical, attribute, currentValue, currentLocation);
		return;
	}

	if (firstSetting.value === currentValue) {
		return;
	}

	conflicts.push({
		attribute,
		conflictingValue: currentValue,
		firstLocation: firstSetting.location,
		firstValue: firstSetting.value,
	});
};

const toInfoContract = (node: Node): CanonicalTagContract => {
	const contract: CanonicalTagContract = {
		kind: "info",
		location: node.location,
		settings: {},
	};

	addCanonicalSetting(contract, "type", toInfoType(node.attributes.type), node.location);
	addCanonicalSetting(contract, "unit", toOptionalString(node.attributes.unit), node.location);
	addCanonicalSetting(
		contract,
		"description",
		toOptionalString(node.attributes.description),
		node.location,
	);
	return contract;
};

const toSwitchContract = (node: Node): CanonicalTagContract => {
	const contract: CanonicalTagContract = {
		kind: "switch",
		location: node.location,
		settings: {},
	};

	addCanonicalSetting(contract, "type", toSwitchContractType(node.attributes.type), node.location);
	return contract;
};

const toScoreContract = (node: Node): CanonicalTagContract => {
	const contract: CanonicalTagContract = {
		kind: "score",
		location: node.location,
		settings: {},
	};

	addCanonicalSetting(
		contract,
		"formula",
		toOptionalString(node.attributes.formula),
		node.location,
	);
	return contract;
};

const compareInfoContract = (
	canonical: CanonicalTagContract,
	node: Node,
): MarkdocSettingConflict[] => {
	const conflicts: MarkdocSettingConflict[] = [];
	compareSetting({
		attribute: "type",
		canonical,
		conflicts,
		currentLocation: node.location,
		currentValue: toInfoType(node.attributes.type),
	});
	compareSetting({
		attribute: "unit",
		canonical,
		conflicts,
		currentLocation: node.location,
		currentValue: toOptionalString(node.attributes.unit),
	});
	compareSetting({
		attribute: "description",
		canonical,
		conflicts,
		currentLocation: node.location,
		currentValue: toOptionalString(node.attributes.description),
	});
	return conflicts;
};

const compareSwitchContract = (
	canonical: CanonicalTagContract,
	node: Node,
): MarkdocSettingConflict[] => {
	const conflicts: MarkdocSettingConflict[] = [];
	compareSetting({
		attribute: "type",
		canonical,
		conflicts,
		currentLocation: node.location,
		currentValue: toSwitchContractType(node.attributes.type),
	});
	return conflicts;
};

const compareScoreContract = (
	canonical: CanonicalTagContract,
	node: Node,
): MarkdocSettingConflict[] => {
	const conflicts: MarkdocSettingConflict[] = [];
	compareSetting({
		attribute: "formula",
		canonical,
		conflicts,
		currentLocation: node.location,
		currentValue: toOptionalString(node.attributes.formula),
	});
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
		contracts.set(primary, kind === "info" ? toInfoContract(node) : toSwitchContract(node));
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

	const conflicts =
		kind === "info" ? compareInfoContract(canonical, node) : compareSwitchContract(canonical, node);
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
		contracts.set(primary, toScoreContract(node));
		return null;
	}

	const conflicts = compareScoreContract(canonical, node);
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
