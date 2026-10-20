"use client";

import type { VariableValue } from "../../render/context/variable-context";
import { useResolvedVariable } from "../../render/hooks/use-resolved-variable";
import type { ResolvedVariable } from "../../render/hooks/use-resolved-variable";
import { CALC_PLACEHOLDER } from "./helpers/config";
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

export interface InfoTagState extends ResolvedVariable {
	/** The variable name, or undefined for a malformed tag. */
	name?: string;
	/** The value as the default renderer shows it: rounded, placeholder, or stringified boolean. */
	display: VariableValue;
	/** True while a computed variable waits for its inputs. */
	isPending: boolean;
}

/** Everything an `info` renderer needs; components only decide how it looks. */
export const useInfoTag = ({ primary, type, round }: InfoProps): InfoTagState => {
	const name = typeof primary === "string" ? primary : undefined;
	// A stored value wins; a computed variable (declared by a calc with the same
	// name) derives its value from the formula.
	const resolved = useResolvedVariable(name);
	const { contract, value, isComputed } = resolved;
	const isPending = value === undefined && Boolean(contract?.roles.computed);
	let display = value;
	if (isPending) {
		display = CALC_PLACEHOLDER;
	} else if (typeof value === "number" && (type === "number" || isComputed)) {
		display = roundNumber(value, round, isComputed ? 2 : undefined);
	} else if (typeof value === "boolean") {
		display = String(value);
	}
	return { ...resolved, display, isPending, name };
};

export const Info = (props: InfoProps) => {
	const { name, display } = useInfoTag(props);
	// Missing variables intentionally render as empty to keep template output stable.
	return (
		<InteractiveTag tagName={name}>
			<span
				className="rounded-md bg-solarized-blue px-1 text-white opacity-90"
				style={{ boxDecorationBreak: "clone", overflowWrap: "anywhere" }}
			>
				{display}
				{props.renderUnit && props.unit && ` ${props.unit}`}
			</span>
		</InteractiveTag>
	);
};
