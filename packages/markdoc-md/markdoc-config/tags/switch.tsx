"use client";
import type { ReactNode } from "react";
import React from "react";

import { normalizeBooleanToString } from "../../parse/boolean-coercion";
import type { CaseCondition } from "../../parse/case-conditions";
import {
	resolveMatchedCaseIndex,
	toCaseCondition,
	toNumericSwitchValue,
} from "../../parse/case-conditions";
import { useResolvedVariable } from "../../render/hooks/use-resolved-variable";
import { InteractiveTag } from "./helpers/interactive-tag";

/**
 * String and boolean switches match cases by key equality; every matching case
 * renders. Number switches evaluate structured case conditions in document
 * order and render only the first match.
 */
export type SwitchContextValue =
	| { kind: "number"; matchedIndex: number | null }
	| { kind: "string"; value: string | null }
	| null;

export const SwitchContext = React.createContext<SwitchContextValue>(null);

// this component mainly needs to handle reactivity around the Condition

type SwitchType = "string" | "boolean" | "checkbox" | "number" | null | undefined;

export interface SwitchProps {
	primary: string;
	type?: SwitchType;
	source?: string;
	unit?: string;
	description?: string;
	children?: ReactNode;
}

const isBooleanSwitchType = (type: SwitchType): boolean =>
	type === "boolean" || type === "checkbox";

const normalizeSwitchValue = (value: unknown, type: SwitchType): string | null => {
	if (isBooleanSwitchType(type)) {
		return value === undefined ? "false" : normalizeBooleanToString(value);
	}

	if (typeof value === "string" || value === null) {
		return value;
	}

	return null;
};

interface IndexedCaseCondition {
	condition: CaseCondition | null;
	index: number;
}

/**
 * The switch transform reduces children to case tags and injects their index,
 * so the ordered condition list is read straight from the children's props.
 */
const collectCaseConditions = (children: ReactNode): IndexedCaseCondition[] =>
	React.Children.toArray(children).map((child, position) => {
		if (!React.isValidElement(child)) {
			return { condition: null, index: position };
		}
		const props = child.props as Record<string, unknown>;
		return {
			condition: toCaseCondition(props),
			index: typeof props.index === "number" ? props.index : position,
		};
	});

export const Switch = ({
	primary,
	type,
	source: _source,
	unit: _unit,
	description: _description,
	children,
}: SwitchProps) => {
	const variableName = typeof primary === "string" ? primary : null;
	const { value, contract } = useResolvedVariable(variableName);

	const cases = collectCaseConditions(children);
	const hasConditionCases = cases.some((entry) => entry.condition !== null);
	const isNumberSwitch =
		type === "number" ||
		(type === undefined || type === null
			? contract?.domain === "number" || hasConditionCases
			: false);

	let contextValue: SwitchContextValue = null;
	if (variableName !== null) {
		if (isNumberSwitch) {
			const numericValue = toNumericSwitchValue(value);
			const matched = resolveMatchedCaseIndex(
				numericValue,
				cases.map((entry) => entry.condition),
			);
			contextValue = {
				kind: "number",
				matchedIndex: matched === null ? null : cases[matched]?.index ?? null,
			};
		} else {
			// valueFromContext can be undefined or a non-string/non-null type.
			// Boolean switches normalize truthy/falsey representations to "true"/"false".
			contextValue = { kind: "string", value: normalizeSwitchValue(value, type) };
		}
	}
	// If primary was initially null, contextValue remains null and no case renders.

	return (
		<SwitchContext.Provider value={contextValue}>
			<InteractiveTag tagName={variableName}>
				<span className="rounded-md bg-solarized-green px-1 text-white opacity-90">{children}</span>
			</InteractiveTag>
		</SwitchContext.Provider>
	);
};
