"use client";
import { normalizeBooleanToString } from "../../parse/boolean-coercion";
import { useVariables } from "../../render/context/variable-context";
import type { ReactNode } from "react";
import React from "react";

import { InteractiveTag } from "./interactive-tag";

export const SwitchContext = React.createContext<string | null>(null);

// this component mainly needs to handle reactivity around the Condition

type SwitchType = "string" | "boolean" | "checkbox" | null | undefined;

export interface SwitchProps {
	primary: string;
	type?: SwitchType;
	source?: string;
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

export const Switch = ({
	primary,
	type,
	source: _source,
	children,
}: SwitchProps) => {
	const variables = useVariables();
	const variableName = typeof primary === "string" ? primary : null;
	let resolvedSwitchValue: string | null = null;
	if (variableName !== null) {
		const valueFromContext = variables[variableName];
		// valueFromContext can be undefined or a non-string/non-null type.
		// Boolean switches normalize truthy/falsey representations to "true"/"false".
		resolvedSwitchValue = normalizeSwitchValue(valueFromContext, type);
	}
	// If primary was initially null, resolvedSwitchValue remains null.

	return (
		<SwitchContext.Provider value={resolvedSwitchValue}>
			<InteractiveTag tagName={variableName}>
				<span className="rounded-md bg-solarized-green px-1 text-white opacity-90">{children}</span>
			</InteractiveTag>
		</SwitchContext.Provider>
	);
};
