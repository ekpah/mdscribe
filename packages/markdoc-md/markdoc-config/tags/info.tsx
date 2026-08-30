"use client";

import { useResolvedVariable } from "../../render/hooks/use-resolved-variable";
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
	const variableName = typeof primary === "string" ? primary : undefined;
	// Resolve the value through the shared read path: a stored value wins;
	// a computed variable (declared by a calc with the same name) derives its
	// value from the formula.
	const { value, isComputed } = useResolvedVariable(variableName);
	let renderedValue = value;
	if (typeof value === "number" && (_type === "number" || isComputed)) {
		renderedValue = roundNumber(value, round, isComputed ? 2 : undefined);
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
