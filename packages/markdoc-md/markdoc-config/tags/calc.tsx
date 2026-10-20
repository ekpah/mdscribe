"use client";

import type { VariableValue } from "../../render/context/variable-context";
import { useResolvedVariable } from "../../render/hooks/use-resolved-variable";
import type { ResolvedVariable } from "../../render/hooks/use-resolved-variable";
import { CALC_PLACEHOLDER } from "./helpers/config";
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

export interface CalcTagState extends ResolvedVariable {
	/** The variable name, or undefined for an unnamed calculation. */
	name?: string;
	/** The rounded result, or a placeholder until every input is filled in. */
	display: VariableValue;
	/** True until every input of the formula is filled in. */
	isPending: boolean;
	/** Human-readable formula, e.g. "Formula: [weight] / [height]". */
	formulaLabel: string;
}

const formatFormulaForTooltip = (formula: string): string =>
	formula
		.replaceAll(/(\[[\w_]+\])|([^a-zA-Z[\]])/g, (_match, p1, p2) => p1 || ` ${p2} `)
		.replaceAll(/\s+/g, " ")
		.trim();

/** Everything a `calc` renderer needs; components only decide how it looks. */
export const useCalcTag = ({ formula, primary, round }: CalcProps): CalcTagState => {
	const normalizedFormula = typeof formula === "string" ? formula : "";
	const name = typeof primary === "string" ? primary : undefined;
	// A stored value (manual override) wins; otherwise the formula result is
	// used. It stays undefined until every input is filled in.
	const resolved = useResolvedVariable(name, { formula: normalizedFormula });
	const { value } = resolved;
	const isPending = value === undefined || value === null;
	let display = value;
	if (isPending) {
		display = CALC_PLACEHOLDER;
	} else if (typeof value === "number") {
		display = roundNumber(value, round, 2);
	}
	const formattedFormula = formatFormulaForTooltip(normalizedFormula);
	return {
		...resolved,
		display,
		formulaLabel: formattedFormula ? `Formula: ${formattedFormula}` : "No formula",
		isPending,
		name,
	};
};

export const Calc = (props: CalcProps) => {
	const { name, display, formulaLabel } = useCalcTag(props);
	return (
		<InteractiveTag tagName={name}>
			<span
				aria-label={formulaLabel}
				className="cursor-help whitespace-nowrap rounded-md bg-solarized-orange px-1 text-white opacity-90"
				title={formulaLabel}
			>
				{display}
				{props.renderUnit && props.unit && ` ${props.unit}`}
			</span>
		</InteractiveTag>
	);
};
