"use client";

/* oxlint-disable eslint/no-nested-ternary */

import { cn } from "@repo/design-system/lib/utils";
import { Bot, Pencil, RotateCcw, Sigma } from "lucide-react";
import { getFormulaVariables, toNumericValue } from "markdoc-md/parse";
import {
	useCalcTag,
	useMarkdocInteraction,
	useVariableContract,
	useVariables,
} from "markdoc-md/react";
import type { CalcProps, VariableValue } from "markdoc-md/react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useState } from "react";

import { detailButtonClassName, FieldDetails, FieldSourceBadge } from "./field-details";
import { useLayoutValue, useFieldState } from "./field-state";
import {
	CALC_PLACEHOLDER,
	touchInputClassName,
	fieldClassName,
	parseNumberDraft,
	useDraft,
	useFrozenWidth,
} from "./shared";
import { TagPopover } from "./tag-popover";

/**
 * Typing over a calculated value overrides it, exactly like the side inputs:
 * the edit commits on blur or Enter, and clearing it resumes the formula.
 */
const useCalcOverride = (
	name: string | undefined,
	value: VariableValue,
	display: VariableValue,
) => {
	const { fields } = useFieldState(name);
	const [draft, setDraft] = useState<string | null>(null);
	const commit = () => {
		if (draft === null || !name || !fields) {
			return;
		}
		setDraft(null);
		const next = toNumericValue(draft);
		if (next === null) {
			fields.clearValue(name);
		} else if (!Object.is(next, value)) {
			fields.setValue(name, next);
		}
	};
	return {
		canEdit: Boolean(name && fields),
		commit,
		commitOnEnter: (event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				event.preventDefault();
				commit();
			}
		},
		setDraft,
		text: draft ?? (value === undefined || value === null ? "" : String(display ?? "")),
	};
};
/**
 * A field that another tag depends on, listed in that tag's details and edited
 * like an inline field, whether or not the text mentions it elsewhere.
 */
export const DependencyField = ({ name, unit: fallbackUnit }: { name: string; unit?: string }) => {
	const values = useVariables();
	const contract = useVariableContract(name);
	const { onVariableChange } = useMarkdocInteraction();
	const value = values[name];
	const number = useDraft(value);
	// Plain number fields are typed here; options and nested calculations have their own tags.
	const isComputed = Boolean(contract?.roles.computed);
	const isEditable = !isComputed && (contract?.domain ?? "number") === "number";
	const unit = contract?.unit ?? fallbackUnit;
	const override = useCalcOverride(isComputed ? name : undefined, value, value);

	return (
		<label className="flex items-center justify-between gap-3 py-2">
			<span className="flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
				{name}
				<FieldSourceBadge name={name} value={value} />
			</span>
			<span className="flex shrink-0 items-center gap-1">
				{isEditable ? (
					<span className={cn(fieldClassName("info", false, false), "inline-flex items-baseline")}>
						<input
							aria-label={name}
							className={cn(
								"w-16 border-0 bg-transparent py-0.5 text-right text-solarized-blue tabular-nums outline-none placeholder:text-solarized-blue/50",
								touchInputClassName,
							)}
							inputMode="decimal"
							onBlur={number.endEditing}
							onChange={(event) => {
								number.setDraft(event.target.value);
								const parsed = parseNumberDraft(event.target.value);
								if (parsed !== null) {
									onVariableChange?.(name, parsed);
								}
							}}
							placeholder="…"
							type="text"
							value={number.draft}
						/>
						{unit ? <small className="pl-1 text-[0.8em]">{unit}</small> : null}
					</span>
				) : isComputed && override.canEdit ? (
					// A nested calculation can be overridden here like its own tag.
					<span className={cn(fieldClassName("calc", false, false), "inline-flex items-baseline")}>
						<Sigma aria-hidden className="mr-1 inline h-3 w-3 self-center" />
						<input
							aria-label={`${name} überschreiben`}
							className={cn(
								"w-16 border-0 bg-transparent py-0.5 text-right text-solarized-violet tabular-nums outline-none placeholder:text-solarized-violet/50",
								touchInputClassName,
							)}
							inputMode="decimal"
							onBlur={override.commit}
							onChange={(event) => override.setDraft(event.target.value)}
							onKeyDown={override.commitOnEnter}
							placeholder={CALC_PLACEHOLDER}
							type="text"
							value={override.text}
						/>
						{unit ? <small className="pl-1 text-[0.8em]">{unit}</small> : null}
					</span>
				) : (
					<span
						className={cn(
							fieldClassName(isComputed ? "calc" : "select", false, false),
							"tabular-nums",
						)}
					>
						{isComputed ? <Sigma aria-hidden className="mr-1 inline h-3 w-3" /> : null}
						{value === undefined || value === "" ? "…" : String(value)}
						{unit ? <small className="pl-1 text-[0.8em]">{unit}</small> : null}
					</span>
				)}
			</span>
		</label>
	);
};
/**
 * The result, editable as a manual override exactly like the side inputs: an
 * edit commits on blur or Enter, and clearing it or resetting resumes the formula.
 */
const CalcResult = ({
	display,
	name,
	unit,
	value,
}: {
	display: VariableValue;
	name?: string;
	unit?: string;
	value: VariableValue;
}) => {
	const { fields, state } = useFieldState(name);
	const override = useCalcOverride(name, value, display);
	const source = state?.source;
	const status =
		source === "manual" ? "Überschrieben" : source === "ai" ? "KI-Vorschlag" : "Berechnet";
	const StatusIcon = source === "manual" ? Pencil : source === "ai" ? Bot : Sigma;
	return (
		<div className="mt-3 rounded border border-solarized-violet/20 bg-solarized-violet/10 p-3 text-solarized-violet">
			<label className="flex items-center justify-between gap-3">
				<span className="flex items-center gap-1.5 text-xs">
					<StatusIcon aria-hidden className="h-3.5 w-3.5" />
					{status}
				</span>
				<span className="flex items-baseline gap-1.5">
					{name && fields ? (
						<input
							aria-label={`${name} überschreiben`}
							className={cn(
								"w-24 rounded border border-solarized-violet/30 bg-background px-2 py-0.5 text-right font-medium text-2xl text-solarized-violet tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-solarized-violet",
								touchInputClassName,
							)}
							inputMode="decimal"
							onBlur={override.commit}
							onChange={(event) => override.setDraft(event.target.value)}
							onKeyDown={override.commitOnEnter}
							placeholder={CALC_PLACEHOLDER}
							type="text"
							value={override.text}
						/>
					) : (
						<strong className="font-medium text-2xl tabular-nums">{display}</strong>
					)}
					{unit ? <small className="text-xs">{unit}</small> : null}
				</span>
			</label>
			{source && name && fields ? (
				<button
					className={cn(detailButtonClassName, "mt-2 -ml-1.5")}
					onClick={() => fields.clearValue(name)}
					type="button"
				>
					<RotateCcw aria-hidden className="h-3.5 w-3.5" />
					{source === "manual" ? "Überschreibung entfernen" : "Wieder aus der Formel berechnen"}
				</button>
			) : (
				<p className="mt-1 text-xs opacity-80">
					Wert eintippen, um die Berechnung zu überschreiben.
				</p>
			)}
		</div>
	);
};
export const InlineCalc = (props: CalcProps) => {
	const { name, display, formulaLabel, isPending, value } = useCalcTag(props);
	const shownDisplay = useLayoutValue(display);
	const shownValue = useLayoutValue(value);
	const { state } = useFieldState(name);
	const override = useCalcOverride(name, shownValue, shownDisplay);
	const width = useFrozenWidth();
	const { activeTagName, onVariableChange } = useMarkdocInteraction();
	const unitText = props.renderUnit && props.unit ? ` ${props.unit}` : "";
	if (!onVariableChange) {
		return (
			<>
				{display}
				{unitText}
			</>
		);
	}
	const title = name ?? "Berechnung";
	// markdoc-md lists the dependencies and evaluates the formula.
	const dependencies = getFormulaVariables(props.formula);

	return (
		<TagPopover
			citations={state?.citations}
			icon={<Sigma aria-hidden className="h-4 w-4 shrink-0" />}
			isActive={Boolean(name) && activeTagName === name}
			kind="calc"
			name={name ?? ""}
			title={title}
			trigger={({ className, isOpen, onFocus, openPanel, panelId }) =>
				override.canEdit ? (
					// Typed like an information field; the details show formula and sources.
					<span
						className={cn(
							className,
							"has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-solarized-violet",
						)}
					>
						{/* Inline icons: block icons in flex boxes become line breaks in copied text. */}
						<Sigma aria-hidden className="mr-1 inline h-3 w-3 align-[-0.1em]" />
						<input
							aria-controls={isOpen ? panelId : undefined}
							aria-label={`${title} (berechnet)`}
							className={cn(
								"inline-block w-(--field-width) min-w-[2ch] max-w-full border-0 bg-transparent p-0 text-inherit tabular-nums outline-none [field-sizing:content] placeholder:text-solarized-violet/60 [font:inherit] supports-[field-sizing:content]:w-auto",
								touchInputClassName,
								"pointer-coarse:scroll-mb-24",
							)}
							data-inline-input={title}
							data-source={state?.source}
							data-tag-focus
							data-unit={props.unit}
							inputMode="decimal"
							onBlur={() => {
								override.commit();
								width.release();
							}}
							onChange={(event) => override.setDraft(event.target.value)}
							onClick={openPanel}
							onFocus={(event) => {
								const input = event.currentTarget;
								width.freeze(input);
								onFocus();
								// A result is replaced, not edited: select it once focus has settled.
								requestAnimationFrame(() => {
									if (document.activeElement === input) {
										input.select();
									}
								});
							}}
							onKeyDown={override.commitOnEnter}
							// Safari moves the caret to the tap on mouseup, undoing that selection.
							onPointerDown={(event) => {
								const input = event.currentTarget;
								if (input !== document.activeElement) {
									input.addEventListener("mouseup", (up) => up.preventDefault(), { once: true });
								}
							}}
							placeholder={CALC_PLACEHOLDER}
							style={
								{
									"--field-width": `${(override.text || CALC_PLACEHOLDER).length + 1}ch`,
									...width.style,
								} as CSSProperties
							}
							type="text"
							value={override.text}
						/>
						{/* A real space keeps the unit separate in copied text. */}
						{unitText ? (
							<>
								{" "}
								<span className="text-[0.85em]">{props.unit}</span>
							</>
						) : null}
					</span>
				) : (
					<button
						aria-controls={isOpen ? panelId : undefined}
						aria-expanded={isOpen}
						aria-haspopup="dialog"
						aria-label={`${title}: ${shownDisplay}${unitText}, Berechnung anzeigen`}
						className={cn(
							className,
							"outline-none focus-visible:ring-2 focus-visible:ring-solarized-violet",
						)}
						data-tag-focus
						onClick={openPanel}
						onFocus={onFocus}
						tabIndex={0}
						type="button"
					>
						{/* Inline icons: block icons in flex boxes become line breaks in copied text. */}
						<Sigma aria-hidden className="mr-1 inline h-3 w-3 align-[-0.1em]" />
						<span>
							{shownDisplay}
							{unitText}
						</span>
					</button>
				)
			}
			unit={props.unit}
		>
			{() => (
				<>
					<div
						aria-label={formulaLabel}
						className="my-3 rounded bg-muted p-2.5 text-center font-mono text-xs [overflow-wrap:anywhere]"
					>
						{props.formula}
					</div>
					<div className="divide-y">
						{dependencies.map((dependency) => (
							<DependencyField key={dependency} name={dependency} />
						))}
					</div>
					<CalcResult display={display} name={name} unit={props.unit} value={value} />
					{isPending ? (
						<output className="mt-2 block text-muted-foreground text-xs">
							Bitte alle Quellwerte ausfüllen.
						</output>
					) : null}
					<FieldDetails isCalc name={name} value={value} />
				</>
			)}
		</TagPopover>
	);
};
