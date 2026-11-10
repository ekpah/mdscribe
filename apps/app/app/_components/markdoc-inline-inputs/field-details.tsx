"use client";

/* oxlint-disable eslint/no-nested-ternary */

import { cn } from "@repo/design-system/lib/utils";
import { Bot, FileSearch, Pencil } from "lucide-react";
import type { VariableValue } from "markdoc-md/react";

import type { FieldState, InputSource } from "../inputs/inputs";
import { useFieldState } from "./field-state";

export const SOURCE_LABELS: Record<
	InputSource,
	{ className: string; icon: typeof Bot; label: string }
> = {
	ai: { className: "text-solarized-orange", icon: Bot, label: "KI-Erkennung" },
	"ai-confirmed": {
		className: "text-solarized-green",
		icon: Bot,
		label: "KI-Vorschlag bestätigt",
	},
	manual: { className: "text-solarized-green", icon: Pencil, label: "Manuell bearbeitet" },
};
export const detailButtonClassName =
	"inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** Whether the details offer anything to act on, which makes an info tooltip interactive. */
export const hasFieldActions = (
	state: FieldState | undefined,
	value: VariableValue,
	isCalc = false,
) =>
	Boolean(
		state?.citations?.length ||
		(!isCalc && state?.suggestion && String(value ?? "") !== String(state.suggestion.value)),
	);
/**
 * Provenance, AI suggestion and sources of one field, as the form inputs show
 * them. Calculations show their AI value and reset in the result section instead.
 */
export const FieldDetails = ({
	isCalc = false,
	name,
	unit,
	value,
}: {
	isCalc?: boolean;
	name?: string;
	unit?: string;
	value: VariableValue;
}) => {
	const { fields, state } = useFieldState(name);
	if (!fields || !state || !name) {
		return null;
	}
	const source = state.source ? SOURCE_LABELS[state.source] : undefined;
	const { suggestion } = state;
	const hasValue = value !== undefined && value !== null && value !== "";
	const showSuggestion = !isCalc && suggestion && String(value ?? "") !== String(suggestion.value);
	const citations = state.citations ?? [];
	return (
		<div className="mt-2 space-y-1.5 border-t pt-2 text-xs">
			{source ? (
				<p className={cn("flex items-center gap-1.5", source.className)}>
					<source.icon aria-hidden className="h-3.5 w-3.5" />
					{source.label}
				</p>
			) : null}
			{showSuggestion ? (
				<div className="flex items-center gap-1.5 rounded border border-solarized-orange/20 bg-solarized-orange/10 px-1.5 py-1 text-solarized-orange">
					<Bot aria-hidden className="h-3.5 w-3.5 shrink-0" />
					<span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
						{state.suggestionLabel}: {String(suggestion.value)}
						{unit ? ` ${unit}` : ""}
					</span>
					{suggestion.citations?.length ? (
						<button
							aria-label="Quellen des Vorschlags anzeigen"
							className={detailButtonClassName}
							onClick={() => fields.showSources(suggestion.citations ?? [])}
							type="button"
						>
							<FileSearch aria-hidden className="h-3.5 w-3.5" />
						</button>
					) : null}
					<button
						className={detailButtonClassName}
						onClick={() => fields.clearValue(name)}
						type="button"
					>
						{hasValue ? "Ersetzen" : "Übernehmen"}
					</button>
				</div>
			) : null}
			{citations.length ? (
				<button
					className={cn(detailButtonClassName, "-mx-1.5 w-full items-start text-left")}
					onClick={() => fields.showSources(citations)}
					type="button"
				>
					<FileSearch aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
					<span className="min-w-0">
						{citations.length === 1 ? "Quelle anzeigen" : `${citations.length} Quellen anzeigen`}
						{citations
							.filter((citation) => citation.quote)
							.slice(0, 2)
							.map((citation) => (
								<q
									className="mt-0.5 block text-muted-foreground [overflow-wrap:anywhere]"
									key={`${citation.source}:${citation.quote}`}
								>
									{citation.quote}
								</q>
							))}
					</span>
				</button>
			) : null}
		</div>
	);
};
/**
 * The compact provenance of a field listed inside another tag's details: its
 * source icon, opening its sources, and its AI suggestion when it differs.
 */
export const FieldSourceBadge = ({ name, value }: { name: string; value: VariableValue }) => {
	const { fields, state } = useFieldState(name);
	if (!fields || !state) {
		return null;
	}
	const source = state.source ? SOURCE_LABELS[state.source] : undefined;
	const { suggestion } = state;
	const showSuggestion = suggestion && String(value ?? "") !== String(suggestion.value);
	const citations = state.citations ?? [];
	return (
		<>
			{source ? (
				citations.length ? (
					<button
						aria-label={`${source.label} – Quellen anzeigen`}
						className={cn(detailButtonClassName, "px-1", source.className)}
						onClick={() => fields.showSources(citations)}
						title={`${source.label} – Quellen anzeigen`}
						type="button"
					>
						<source.icon aria-hidden className="h-3.5 w-3.5" />
						<FileSearch aria-hidden className="h-3.5 w-3.5" />
					</button>
				) : (
					<span className={cn("inline-flex", source.className)} title={source.label}>
						<source.icon aria-hidden className="h-3.5 w-3.5" />
						<span className="sr-only">{source.label}</span>
					</span>
				)
			) : null}
			{showSuggestion ? (
				<button
					className={cn(detailButtonClassName, "px-1 text-solarized-orange")}
					onClick={() => fields.clearValue(name)}
					title={`${state.suggestionLabel ?? "Vorschlag"} übernehmen`}
					type="button"
				>
					<Bot aria-hidden className="h-3.5 w-3.5" />
					{String(suggestion.value)}
				</button>
			) : null}
		</>
	);
};
