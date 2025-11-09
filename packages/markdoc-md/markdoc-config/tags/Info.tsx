"use client";

import { useVariables } from "../../render/context/VariableContext";

export function Info({
	primary,
	type,
	unit,
	renderUnit,
	description,
}: {
	primary: string;
	type: string;
	unit: string;
	renderUnit: boolean;
	description: string;
}) {
	const variables = useVariables();
	// Look up the value from context using the 'primary' prop as the key.
	// Provide an empty string as a fallback if the variable doesn't exist.
	const value = variables[primary] ?? undefined;

	// TODO: consider adding more robust error handling or logging
	// if a variable is expected but not found.
	// Example: if (variables[primary] === undefined) { console.warn(...) }

	return (
		<span className="rounded-md bg-solarized-blue px-1 text-white opacity-90">
			<span className="inline-flex items-center gap-1">
				{value}
				{renderUnit && unit && ` ${unit}`}
			</span>
		</span>
	);
}
