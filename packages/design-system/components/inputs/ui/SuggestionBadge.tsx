"use client";

import { Bot } from "lucide-react";
import { Button } from "../../ui/button";

export type SuggestionBadgeProps = {
	/** The suggested value to display */
	value: string | number;
	/** Label describing the suggestion source (e.g., "KI-Vorschlag") */
	label?: string;
	/** Optional unit to append to the value */
	unit?: string;
	/** Whether the field already has a value (changes button text) */
	hasExistingValue?: boolean;
	/** Callback when user accepts the suggestion */
	onAccept?: () => void;
};

export function SuggestionBadge({
	value,
	label = "Vorschlag",
	unit,
	hasExistingValue = false,
	onAccept,
}: SuggestionBadgeProps) {
	const displayText = unit ? `${value} ${unit}` : `${value}`;

	return (
		<div className="flex items-center justify-between gap-2 rounded-md border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-1 text-xs text-solarized-orange">
			<div className="flex min-w-0 items-center gap-2">
				<Bot aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
				<span className="font-medium">{label}</span>
				<span className="truncate text-solarized-orange/90">{displayText}</span>
			</div>
			{onAccept && (
				<Button
					className="h-6 shrink-0 px-2 text-xs"
					onClick={onAccept}
					size="sm"
					type="button"
					variant="ghost"
				>
					{hasExistingValue ? "Ersetzen" : "Übernehmen"}
				</Button>
			)}
		</div>
	);
}
