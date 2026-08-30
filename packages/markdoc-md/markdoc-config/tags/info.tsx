"use client";

import { useVariables } from "../../render/context/variable-context";
import { InteractiveTag } from "./helpers/interactive-tag";
import { roundNumber } from "./helpers/round";
import type { RoundValue } from "./helpers/round";

export interface InfoProps {
	primary: string;
	type?: "date" | "number" | "string";
	unit?: string;
	renderUnit?: boolean;
	description?: string;
	source?: string;
	round?: RoundValue;
}

export const Info = ({
	primary,
	type: _type,
	unit,
	renderUnit,
	description: _description,
	source: _source,
	round,
}: InfoProps) => {
	const variables = useVariables();
	const variableName = typeof primary === "string" ? primary : undefined;
	// Look up the value from context using the 'primary' prop as the key.
	// Provide an empty string as a fallback if the variable doesn't exist.
	const value = variableName ? variables[variableName] : undefined;
	let renderedValue = value;
	if (_type === "number" && typeof value === "number") {
		renderedValue = roundNumber(value, round);
	} else if (typeof value === "boolean") {
		renderedValue = String(value);
	}

	// Missing variables intentionally render as empty to keep template output stable.

	return (
		<InteractiveTag tagName={variableName}>
			<span className="rounded-md bg-solarized-blue px-1 text-white opacity-90">
				<span className="inline-flex items-center gap-1">
					{renderedValue}
					{renderUnit && unit && ` ${unit}`}
				</span>
			</span>
		</InteractiveTag>
	);
};
