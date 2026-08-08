"use client";

import { useVariables } from "@repo/markdoc-md/render/context/variable-context";

import { InteractiveTag } from "./interactive-tag";

export const Info = ({
	primary,
	type: _type,
	unit,
	renderUnit,
	description: _description,
	source: _source,
}: {
	primary: string;
	type: string;
	unit: string;
	renderUnit: boolean;
	description: string;
	source?: string;
}) => {
	const variables = useVariables();
	// Look up the value from context using the 'primary' prop as the key.
	// Provide an empty string as a fallback if the variable doesn't exist.
	const value = variables[primary] ?? undefined;
	const renderedValue = typeof value === "boolean" ? String(value) : value;

	// Missing variables intentionally render as empty to keep template output stable.

	return (
		<InteractiveTag tagName={primary}>
			<span className="rounded-md bg-solarized-blue px-1 text-white opacity-90">
				<span className="inline-flex items-center gap-1">
					{renderedValue}
					{renderUnit && unit && ` ${unit}`}
				</span>
			</span>
		</InteractiveTag>
	);
};
