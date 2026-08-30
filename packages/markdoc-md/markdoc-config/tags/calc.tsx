"use client";

import { useResolvedVariable } from "../../render/hooks/use-resolved-variable";
import { InteractiveTag } from "./helpers/interactive-tag";
import { roundNumber } from "./helpers/round";
import type { RoundValue } from "./helpers/round";

export interface CalcProps {
	formula: string;
	primary?: string;
	unit?: string;
	renderUnit?: boolean;
	round?: RoundValue;
}

const formatFormulaForTooltip = (formula: string): string =>
	formula
		.replaceAll(/(\[[\w_]+\])|([^a-zA-Z[\]])/g, (_match, p1, p2) => p1 || ` ${p2} `)
		.replaceAll(/\s+/g, " ")
		.trim();

const getFormulaTooltipLabel = (formula: string): string => {
	const normalizedFormula = formatFormulaForTooltip(formula);
	return normalizedFormula ? `Formula: ${normalizedFormula}` : "No formula";
};

export const Calc = ({ formula, primary, unit, renderUnit, round }: CalcProps) => {
	const normalizedFormula = typeof formula === "string" ? formula : "";
	const tagName = typeof primary === "string" ? primary : undefined;
	const tooltipLabel = getFormulaTooltipLabel(normalizedFormula);

	// A stored value (manual override) wins; otherwise the formula result is
	// used. `evaluateFormula` returns undefined for unevaluable formulas.
	const { value } = useResolvedVariable(tagName, { formula: normalizedFormula });
	const roundedResult = typeof value === "number" ? roundNumber(value, round, 2) : value;

	return (
		<InteractiveTag tagName={tagName}>
			<span
				aria-label={tooltipLabel}
				className="cursor-help whitespace-nowrap rounded-md bg-solarized-orange px-1 text-white opacity-90"
				title={tooltipLabel}
			>
				{roundedResult ?? "..."}
				{renderUnit && unit && ` ${unit}`}
			</span>
		</InteractiveTag>
	);
};

/** @deprecated Use Calc. Kept for custom component maps that still reference Score. */
export const Score = Calc;
/** @deprecated Use CalcProps. */
export type ScoreProps = CalcProps;
