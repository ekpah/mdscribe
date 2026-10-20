"use client";
import type { ReactNode } from "react";
import React from "react";

import { selectSwitchCase } from "../../parse/switch-selection";
import { useVariables } from "../../render/context/variable-context";
import type { CaseProps } from "./case";
import { InteractiveTag } from "./helpers/interactive-tag";

/** The index of the case the enclosing switch or condition renders. */
export type SwitchContextValue = { matchedIndex: number | null } | null;
export const SwitchContext = React.createContext<SwitchContextValue>(null);

export interface SwitchProps {
	primary: string | string[];
	type?: "string" | "boolean" | "checkbox" | "number" | null;
	source?: string;
	unit?: string;
	description?: string;
	children?: ReactNode;
}

export interface BranchTagState {
	/** The variable name of a scalar primary; undefined for array conditions. */
	name?: string;
	/** Every case of this occurrence in source order, without content. */
	cases: Omit<CaseProps, "children">[];
	/** Position in `cases` of the case that renders, or null. */
	selectedIndex: number | null;
	/** The selected case's content, including nested tags; null when no case matches. */
	selected: ReactNode;
}

/**
 * Everything a `switch` or `condition` renderer needs; components only decide
 * how it looks. Selection never depends on other occurrences. A numeric or
 * multi-field `switch` is invalid and selects nothing; numeric comparisons
 * belong to `condition`.
 */
export const useBranchTag = (
	{ primary, type, children }: SwitchProps,
	kind: "condition" | "switch",
): BranchTagState => {
	const variables = useVariables();
	const cases = React.Children.toArray(children).map((child) => {
		if (!React.isValidElement(child)) {
			return {};
		}
		const { children: _content, ...attributes } = child.props as CaseProps;
		return attributes;
	});
	const isInvalid = kind === "switch" && (type === "number" || Array.isArray(primary));
	const selectedIndex = isInvalid
		? null
		: selectSwitchCase(
				{
					cases: cases as Record<string, unknown>[],
					primary,
					type: kind === "condition" ? "number" : (type ?? undefined),
				},
				variables,
			);
	return {
		cases,
		name: typeof primary === "string" ? primary : undefined,
		selected:
			selectedIndex === null ? null : (
				<SwitchContext.Provider value={{ matchedIndex: selectedIndex }}>
					{children}
				</SwitchContext.Provider>
			),
		selectedIndex,
	};
};

const Branch = ({ name, selected }: BranchTagState) =>
	selected === null ? null : (
		<InteractiveTag tagName={name}>
			<span className="rounded-md bg-solarized-green px-1 text-white opacity-90">{selected}</span>
		</InteractiveTag>
	);

/** Categorical selection. */
export const Switch = (props: SwitchProps) => <Branch {...useBranchTag(props, "switch")} />;

/** Numeric comparisons belong exclusively to condition. */
export const Condition = (props: SwitchProps) => <Branch {...useBranchTag(props, "condition")} />;
