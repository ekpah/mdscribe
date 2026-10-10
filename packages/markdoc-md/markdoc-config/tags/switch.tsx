"use client";
import type { ReactNode } from "react";
import React from "react";

import { selectSwitchCase } from "../../parse/switch-selection";
import { useVariables } from "../../render/context/variable-context";
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

/** Renders the occurrence's selected case; selection never depends on other occurrences. */
const Branch = ({ primary, type, children }: SwitchProps) => {
	const variables = useVariables();
	const cases = React.Children.toArray(children).map((child) =>
		React.isValidElement(child) ? (child.props as Record<string, unknown>) : {},
	);
	const matched = selectSwitchCase({ cases, primary, type: type ?? undefined }, variables);
	if (matched === null) {
		return null;
	}
	return (
		<SwitchContext.Provider value={{ matchedIndex: matched }}>
			<InteractiveTag tagName={typeof primary === "string" ? primary : null}>
				<span className="rounded-md bg-solarized-green px-1 text-white opacity-90">{children}</span>
			</InteractiveTag>
		</SwitchContext.Provider>
	);
};

/** Categorical selection; numeric or multi-field switches are invalid and render nothing. */
export const Switch = (props: SwitchProps) =>
	props.type === "number" || Array.isArray(props.primary) ? null : <Branch {...props} />;

/** Numeric comparisons belong exclusively to condition. */
export const Condition = (props: SwitchProps) => <Branch {...props} type="number" />;
