import { normalizeBooleanToString } from "./boolean-coercion";
import { selectConditionCase } from "./case-conditions";
import type { SwitchInputTagType } from "./parse-markdoc-to-inputs";

/**
 * One occurrence's branch selection: a numeric `condition` (`type: "number"`)
 * or a categorical `switch`. Never an input or value-store identity.
 */
export interface SwitchSelection {
	primary: string | string[];
	type?: string;
	cases: Record<string, unknown>[];
}

/** Requires the occurrence `selection` to select its case at `index`. */
export interface BranchVisibility {
	selection: SwitchSelection;
	index: number;
}

/** Index of the case an occurrence renders, or `null`. */
export const selectSwitchCase = (
	{ primary, cases, type }: SwitchSelection,
	values: Record<string, unknown>,
): number | null => {
	if (type === "number") {
		return selectConditionCase(primary, cases, values);
	}
	if (typeof primary !== "string") {
		return null;
	}
	const raw = values[primary];
	// Checkbox controls report booleans, also for an untyped "true"/"false" switch.
	const value =
		type === "boolean" || type === "checkbox"
			? normalizeBooleanToString(raw ?? false)
			: typeof raw === "boolean"
				? String(raw)
				: raw;
	// A case without a key never matches; validation reports it.
	const index = cases.findIndex(
		(attributes) =>
			typeof attributes.primary === "string" &&
			attributes.primary !== "" &&
			attributes.primary === value,
	);
	const fallback = cases.findIndex((attributes) => attributes.default === true);
	return index >= 0 ? index : fallback >= 0 ? fallback : null;
};

export const isBranchVisible = (
	visibility: readonly BranchVisibility[] | undefined,
	values: Record<string, unknown>,
): boolean =>
	!visibility ||
	visibility.every(({ selection, index }) => selectSwitchCase(selection, values) === index);

/** Cases of a merged switch input whose own occurrence currently selects them. */
export const selectedSwitchCases = (input: SwitchInputTagType, values: Record<string, unknown>) =>
	input.children.filter(
		(branch) =>
			branch.name === "Case" && branch.visibility && isBranchVisible(branch.visibility, values),
	);
