"use client";

import Formula from "fparser";

import { toFormulaValue } from "../../parse/boolean-coercion";
import { useVariables } from "../../render/context/variable-context";
import { InteractiveTag } from "./helpers/interactive-tag";
import { roundNumber } from "./helpers/round";
import type { RoundValue } from "./helpers/round";

interface ValueObject {
	[key: string]: number | string | ValueObject;
}

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
	const variables = useVariables();
	const normalizedFormula = typeof formula === "string" ? formula : "";
	const tagName = typeof primary === "string" ? primary : undefined;
	const tooltipLabel = getFormulaTooltipLabel(normalizedFormula);
	const formulaVariables: ValueObject = Object.fromEntries(
		Object.entries(variables).map(([key, value]) => [key, toFormulaValue(value)]),
	) as ValueObject;

	try {
		const override = tagName ? variables[tagName] : undefined;
		const hasOverride = override !== undefined && override !== null && override !== "";
		const result = hasOverride
			? override
			: new Formula(normalizedFormula).evaluate(formulaVariables);

		const roundedResult = typeof result === "number" ? roundNumber(result, round, 2) : result;

		return (
			<InteractiveTag tagName={tagName}>
				<span
					aria-label={tooltipLabel}
					className="cursor-help whitespace-nowrap rounded-md bg-solarized-orange px-1 text-white opacity-90"
					title={tooltipLabel}
				>
					{roundedResult ?? result}
					{renderUnit && unit && ` ${unit}`}
				</span>
			</InteractiveTag>
		);
	} catch {
		return (
			<InteractiveTag tagName={tagName}>
				<span
					aria-label={tooltipLabel}
					className="cursor-help whitespace-nowrap rounded-md bg-solarized-orange px-1 text-white opacity-90"
					title={tooltipLabel}
				>
					...
					{renderUnit && unit && ` ${unit}`}
				</span>
			</InteractiveTag>
		);
	}
};

/** @deprecated Use Calc. Kept for custom component maps that still reference Score. */
export const Score = Calc;
/** @deprecated Use CalcProps. */
export type ScoreProps = CalcProps;
