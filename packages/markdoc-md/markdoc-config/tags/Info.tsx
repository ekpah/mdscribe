"use client";

import { useState } from "react";
import { useVariables } from "../../render/context/VariableContext";
import { HelpCircle } from "lucide-react";

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
	const [showPopover, setShowPopover] = useState(false);
	// Look up the value from context using the 'primary' prop as the key.
	// Provide an empty string as a fallback if the variable doesn't exist.
	const value = variables[primary] ?? undefined;

	// TODO: consider adding more robust error handling or logging
	// if a variable is expected but not found.
	// Example: if (variables[primary] === undefined) { console.warn(...) }

	// Show the popover only if description is non-empty and non-whitespace
	const hasDescription =
		typeof description === "string" && description.trim().length > 0;

	return (
		<span className="inline-flex items-center gap-1 rounded-md bg-solarized-blue px-1 text-white opacity-90">
			<span>
				{value}
				{renderUnit && unit && ` ${unit}`}
			</span>
			{hasDescription && (
				<span className="relative">
					<button
						type="button"
						className="h-5 w-5 p-0 ml-0.5 opacity-75 hover:opacity-100 flex items-center justify-center rounded bg-transparent focus:outline-none"
						aria-label="Information"
						onClick={(e) => {
							e.preventDefault();
							setShowPopover((prev) => !prev);
						}}
						onKeyDown={(e) => {
							if (e.key === " " || e.key === "Enter") {
								e.preventDefault();
								setShowPopover((prev) => !prev);
							}
						}}
					>
						<HelpCircle className="h-4 w-4" />
					</button>
					{showPopover && (
						<div
							className="absolute z-10 left-1/2 -translate-x-1/2 bottom-full mb-2 min-w-40 max-w-[280px] py-3 px-4 rounded-md border bg-background text-foreground shadow-lg"
							style={{ whiteSpace: "normal" }}
							role="tooltip"
							tabIndex={-1}
							onClick={(e) => {
								// Dismiss when clicking inside
								setShowPopover(false);
							}}
						>
							<p className="text-xs text-muted-foreground">{description}</p>
						</div>
					)}
				</span>
			)}
		</span>
	);
}
