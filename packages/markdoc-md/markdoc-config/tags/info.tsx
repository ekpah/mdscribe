"use client";

import { useVariables } from "../../render/context/variable-context";

import { InteractiveTag } from "./interactive-tag";

export interface InfoProps {
	primary: string;
	type?: "date" | "number" | "string";
	unit?: string;
	renderUnit?: boolean;
	description?: string;
	source?: string;
}

export const Info = ({
	primary,
	type: _type,
	unit,
	renderUnit,
	description: _description,
	source: _source,
}: InfoProps) => {
	const variables = useVariables();
	const variableName = typeof primary === "string" ? primary : undefined;
	// Look up the value from context using the 'primary' prop as the key.
	// Provide an empty string as a fallback if the variable doesn't exist.
	const value = variableName ? variables[variableName] : undefined;
	const renderedValue = typeof value === "boolean" ? String(value) : value;

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
