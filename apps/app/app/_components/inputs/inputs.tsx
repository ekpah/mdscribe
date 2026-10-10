"use client";

/* oxlint-disable eslint/complexity, eslint/no-nested-ternary, eslint/no-use-before-define */

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpRight, Bot, Pencil, RotateCcw, Sigma } from "lucide-react";
import { CALC_PLACEHOLDER } from "markdoc-md/config";
import {
	isBranchVisible,
	resolveCalculatedValues,
	selectedSwitchCases,
	toNumericValue,
	toVoiceBooleanValue as toFillInputsBooleanValue,
} from "markdoc-md/parse";
import type { CalcInputTagType, InputTagType } from "markdoc-md/parse";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ContextDocument } from "@/lib/ocr-types";

import { normalizeDateValue } from "./ui/date-utils";
import { LazyInfoInput } from "./ui/lazy-info-input";
import { SwitchInput } from "./ui/switch-input";

export interface FillInputsAudioFile {
	data: string;
	mimeType: string;
	wavFallback?: {
		data: string;
		mimeType: "audio/wav";
	};
}

export type FillInputsContextFile = ContextDocument;

export interface FillInputsTextContext {
	anamnese?: string;
	befunde?: string;
	diagnoseblock?: string;
	epikrise?: string;
	notes?: string;
}

interface InputsProps {
	activeInputFocusKey?: string | number;
	activeInputName?: string | null;
	inputTags: InputTagType[];
	onChange: (data: Record<string, unknown>) => void;
	onInputBlur?: (inputName: string) => void;
	onInputSelect?: (inputName: string) => void;
	showFillInputs?: boolean;
	onFillInputs?: (
		inputFields: FillInputsInputField[],
		audioFiles: FillInputsAudioFile[],
		textContext: FillInputsTextContext,
		contextFiles: FillInputsContextFile[],
	) => Promise<FillInputsResult>;
	renderFillControls?: (props: {
		onSubmit: (
			audioFiles: FillInputsAudioFile[],
			textContext: FillInputsTextContext,
			contextFiles: FillInputsContextFile[],
		) => Promise<void>;
	}) => React.ReactNode;
	suggestedValues?: Record<string, SuggestedValue>;
	onSuggestedValuesChange?: (values: Record<string, SuggestedValue>) => void;
}

export interface FillInputsInputField {
	label: string;
	calculation?: {
		components: string[];
		formula: string;
	};
	description?: string;
	options?: string[];
	unit?: string;
	type?: InputMeta["type"];
}

type FillInputsResult = Record<string, boolean | number | string>;

type SuggestedValueSource = "ai" | "note" | "document" | "prefill";

interface SuggestedValue {
	value: string | number | boolean;
	source?: SuggestedValueSource;
	label?: string;
}

interface InputMeta {
	calculation?: FillInputsInputField["calculation"];
	options?: string[];
	type: "string" | "number" | "date" | "switch" | "boolean";
}

type InputSource = "ai" | "manual";

export const collectFillInputFields = (inputTags: InputTagType[]) => {
	const fields: FillInputsInputField[] = [];
	const meta = new Map<string, InputMeta>();
	const indexes = new Map<string, number>();

	const pushField = (
		label: string | undefined,
		description: string | undefined,
		type: InputMeta["type"],
		options?: string[],
		unit?: string,
		calculation?: FillInputsInputField["calculation"],
	) => {
		if (!label) {
			return;
		}
		const index = indexes.get(label);
		const previous = index === undefined ? undefined : fields[index];
		if (index !== undefined && previous) {
			const mergedOptions = [...new Set([...(previous.options ?? []), ...(options ?? [])])];
			const merged = {
				calculation: calculation ?? previous.calculation,
				description: previous.description ?? description,
				label,
				options: mergedOptions.length ? mergedOptions : undefined,
				type: calculation ? "number" : previous.type,
				unit: previous.unit ?? unit,
			} satisfies FillInputsInputField;
			fields[index] = merged;
			meta.set(label, {
				calculation: merged.calculation,
				options: merged.options,
				type: merged.type ?? "string",
			});
			return;
		}
		indexes.set(label, fields.length);
		fields.push({ calculation, description, label, options, type, unit });
		meta.set(label, { calculation, options, type });
	};

	const visit = (input: InputTagType) => {
		if (input.name === "Info") {
			pushField(
				input.attributes.primary,
				input.attributes.description,
				input.attributes.type ?? "string",
				undefined,
				input.attributes.unit,
			);
			for (const child of input.children ?? []) {
				visit(child);
			}
			return;
		}

		if (input.name === "Switch") {
			const options = [
				...new Set(
					input.children
						.filter((child) => child.name === "Case")
						.map((child) => child.attributes.primary)
						.filter(Boolean),
				),
			];
			const switchType =
				input.attributes.type === "boolean" || input.attributes.type === "checkbox"
					? "boolean"
					: "switch";
			pushField(
				input.attributes.primary,
				input.attributes.description,
				switchType,
				options,
				input.attributes.unit,
			);
			for (const child of input.children ?? []) {
				visit(child);
			}
			return;
		}

		if (input.name === "Case") {
			for (const child of input.children ?? []) {
				visit(child);
			}
			return;
		}

		if (input.name === "Calc") {
			const components = input.children.map((child) => child.attributes.primary).filter(Boolean);
			pushField(
				input.attributes.primary,
				undefined,
				"number",
				undefined,
				input.attributes.unit,
				input.attributes.formula ? { components, formula: input.attributes.formula } : undefined,
			);
			for (const child of input.children ?? []) {
				visit(child);
			}
		}
	};

	for (const inputTag of inputTags) {
		visit(inputTag);
	}

	return { fields, meta };
};

const normalizeFillInputsValue = (
	value: boolean | number | string,
	meta?: InputMeta,
): string | number | boolean | undefined => {
	if (!meta) {
		return value;
	}

	if (meta.type === "number") {
		const normalized = typeof value === "number" ? value : Number(String(value).replace(",", "."));
		return Number.isNaN(normalized) ? undefined : normalized;
	}

	if (meta.type === "date") {
		return normalizeDateValue(String(value));
	}

	if (meta.type === "boolean") {
		if (typeof value === "boolean") {
			return value;
		}
		return toFillInputsBooleanValue(String(value));
	}

	if (meta.type === "switch") {
		const stringValue = String(value);
		return meta.options?.includes(stringValue) ? stringValue : undefined;
	}

	return String(value);
};

const isEmptyValue = (value: unknown) => value === "" || value === undefined || value === null;

const withoutRecordKey = <T extends Record<string, unknown>>(record: T, key: string): T => {
	const { [key]: _removed, ...remaining } = record;
	return remaining as T;
};

const SUGGESTION_SOURCE_LABELS: Record<SuggestedValueSource, string> = {
	ai: "KI-Vorschlag",
	document: "Dokument",
	note: "Notiz",
	prefill: "Vorausgefüllt",
};

const getSuggestionLabel = (suggestion?: SuggestedValue): string => {
	if (!suggestion) {
		return "Vorschlag";
	}
	if (suggestion.label) {
		return suggestion.label;
	}
	if (suggestion.source) {
		return SUGGESTION_SOURCE_LABELS[suggestion.source];
	}
	return "Vorschlag";
};

const toTextOrNumberSuggestion = (
	value: SuggestedValue["value"] | undefined,
): string | number | undefined => (typeof value === "boolean" ? undefined : value);

const getInputStateClassName = (source?: InputSource) => {
	if (source === "ai") {
		return "border-solarized-orange/60 focus-visible:border-solarized-orange focus-visible:ring-solarized-orange/30 data-focus-within:border-solarized-orange data-focus-within:ring-solarized-orange/30";
	}
	if (source === "manual") {
		return "border-solarized-green/60 focus-visible:border-solarized-green focus-visible:ring-solarized-green/30 data-focus-within:border-solarized-green data-focus-within:ring-solarized-green/30";
	}
	return "";
};

const getInputWrapperClassName = (isActive: boolean, canSelect: boolean) =>
	cn(
		"relative rounded-lg border border-transparent p-1 transition-colors",
		canSelect && "cursor-pointer",
		canSelect && !isActive && "hover:bg-muted/40",
		isActive && "border-solarized-orange/60 bg-solarized-orange/10",
	);

const isInteractiveElement = (element: HTMLElement): boolean =>
	Boolean(
		element.closest(
			'a,button,input,select,textarea,[role="button"],[role="combobox"],[tabindex]:not([tabindex="-1"])',
		),
	);

const focusFirstInputControl = (container: HTMLElement): void => {
	const focusSelectors = [
		'input:not([type="hidden"]):not([disabled])',
		"textarea:not([disabled])",
		"select:not([disabled])",
		'[role="combobox"]:not([aria-disabled="true"])',
		'[role="checkbox"]:not([aria-disabled="true"])',
		'button:not([disabled]):not([aria-label="Mehr Informationen"])',
		'[tabindex]:not([tabindex="-1"])',
	];

	for (const selector of focusSelectors) {
		const control = container.querySelector<HTMLElement>(selector);
		if (control) {
			control.focus();
			return;
		}
	}
};

const SourceIndicator = ({ source }: { source: InputSource | undefined }) => {
	if (!source) {
		return null;
	}

	const config = {
		ai: {
			className: "text-solarized-orange",
			icon: Bot,
			label: "KI-Erkennung",
		},
		manual: {
			className: "text-solarized-green",
			icon: Pencil,
			label: "Manuell bearbeitet",
		},
	}[source];

	if (!config) {
		return null;
	}

	const Icon = config.icon;

	return (
		<TooltipProvider delay={200}>
			<Tooltip>
				<TooltipTrigger
					render={
						<span className={cn("inline-flex cursor-help", config.className)}>
							<Icon className="h-3.5 w-3.5" />
						</span>
					}
				/>
				<TooltipContent side="top" className="text-xs">
					{config.label}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

interface RenderContext {
	activeInputName?: string | null;
	/** Every named calculation; any other mention of one mirrors and links to it. */
	calculations: Map<string, CalcInputTagType>;
	/** Per variable, the mention that focusing it from the document scrolls to. */
	scrollRanks: Map<InputTagType, number>;
	changeHandlers: Record<string, (value: unknown) => void>;
	/**
	 * Drops a field's manual value, revealing its AI suggestion. For a calculation
	 * without a manual value, drops the AI suggestion, revealing the calculation.
	 */
	clearHandlers: Record<string, () => void>;
	/** Every shown mention per variable, with its scroll-target rank. */
	fieldRefs: React.MutableRefObject<FieldRefs>;
	fieldSources: Record<string, InputSource>;
	isFocusSelectionSuppressed: React.MutableRefObject<boolean>;
	onInputBlur?: (inputName: string) => void;
	onInputSelect?: (inputName: string) => void;
	suggestedValues: Record<string, SuggestedValue>;
	values: Record<string, unknown>;
}

const getSelectableFieldHandlers = (
	fieldKey: string,
	context: RenderContext,
): {
	onBlurCapture?: (event: React.FocusEvent<HTMLDivElement>) => void;
	onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
	onFocusCapture?: () => void;
	onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
	role?: "group";
} => {
	const handleInputSelect = context.onInputSelect
		? () => {
				if (context.isFocusSelectionSuppressed.current) {
					return;
				}
				context.onInputSelect?.(fieldKey);
			}
		: undefined;

	return {
		onBlurCapture: context.onInputBlur
			? (event) => {
					const { currentTarget, relatedTarget } = event;
					if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
						return;
					}
					context.onInputBlur?.(fieldKey);
				}
			: undefined,
		onClick: handleInputSelect
			? (event) => {
					const { target } = event;
					if (!(target instanceof HTMLElement) || isInteractiveElement(target)) {
						return;
					}
					handleInputSelect();
					focusFirstInputControl(event.currentTarget);
				}
			: undefined,
		onFocusCapture: handleInputSelect,
		onKeyDown: handleInputSelect
			? (event) => {
					if (event.target !== event.currentTarget || ![" ", "Enter"].includes(event.key)) {
						return;
					}
					event.preventDefault();
					handleInputSelect();
					focusFirstInputControl(event.currentTarget);
				}
			: undefined,
		role: handleInputSelect ? "group" : undefined,
	};
};

/**
 * The value control of a calculation: its result, editable as a manual
 * override, with the override state, formula tooltip, and reset.
 */
const CalcValueField = ({
	calculation,
	context,
	trailing,
}: {
	calculation: CalcInputTagType;
	context: RenderContext;
	/** Extra controls after the value, e.g. a link to the calculation. */
	trailing?: React.ReactNode;
}) => {
	const fieldKey = calculation.attributes.primary;
	const controlId = useId();
	const inputState = context.fieldSources[fieldKey];
	const inputStateClassName = getInputStateClassName(inputState);
	const isOverridden = inputState !== undefined;
	const [isEditing, setIsEditing] = useState(false);
	const [calcDraft, setCalcDraft] = useState("");
	const dirty = useRef(false);
	const handleCalcChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		dirty.current = true;
		setCalcDraft(event.target.value);
	};
	const handleCalcBlur = (event: React.FocusEvent<HTMLInputElement>) => {
		const nextDraft = event.currentTarget.value;
		setIsEditing(false);
		if (!dirty.current) {
			return;
		}
		const nextValue = toNumericValue(nextDraft);
		if (nextValue === null) {
			context.clearHandlers[fieldKey]?.();
			return;
		}
		// Explicit edits remain manual even when they equal the current calculation.
		// Only clearing/resetting removes the manual layer.
		context.changeHandlers[fieldKey]?.(nextValue);
	};

	return (
		<>
			<div className="mb-1 flex items-center gap-1.5">
				<Label className="font-medium text-foreground text-sm" htmlFor={controlId}>
					{fieldKey}
				</Label>
				<TooltipProvider delay={0}>
					<Tooltip>
						<TooltipTrigger
							render={
								<Badge
									className={cn(
										inputState === "ai"
											? "border-solarized-orange/40 text-solarized-orange"
											: inputState === "manual"
												? "border-solarized-green/40 text-solarized-green"
												: "border-transparent bg-muted text-muted-foreground",
									)}
									variant={isOverridden ? "outline" : "secondary"}
								>
									{inputState === "manual" ? (
										<Pencil aria-hidden="true" size={11} />
									) : inputState === "ai" ? (
										<Bot aria-hidden="true" size={11} />
									) : (
										<Sigma aria-hidden="true" size={11} />
									)}
									{inputState === "manual"
										? "Überschrieben"
										: inputState === "ai"
											? "KI-Vorschlag"
											: "Berechnet"}
								</Badge>
							}
						/>
						<TooltipContent className="overflow-hidden px-2 py-1 text-sm">
							<div className="space-y-1">
								<p className="font-medium text-[13px]">Formel</p>
								<p className="text-wrap font-mono text-muted-foreground text-xs">
									{calculation.attributes.formula || "Keine Formel"}
								</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
			<div className="flex w-full max-w-full items-center gap-1.5">
				<Input
					className={cn(
						"h-9 w-full max-w-full font-medium text-foreground",
						isOverridden ? "bg-background" : "bg-muted",
						inputStateClassName,
					)}
					id={controlId}
					onBlur={handleCalcBlur}
					onChange={handleCalcChange}
					onFocus={(event) => {
						dirty.current = false;
						setCalcDraft(event.currentTarget.value);
						setIsEditing(true);
					}}
					placeholder={CALC_PLACEHOLDER}
					step="any"
					type="number"
					value={isEditing ? calcDraft : ((context.values[fieldKey] as number | undefined) ?? "")}
				/>
				{calculation.attributes.unit ? (
					<span className="shrink-0 text-muted-foreground text-sm">
						{calculation.attributes.unit}
					</span>
				) : null}
				{inputState ? (
					<TooltipProvider delay={200}>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										aria-label={
											inputState === "manual"
												? "Manuelle Überschreibung entfernen"
												: "KI-Vorschlag verwerfen"
										}
										onClick={context.clearHandlers[fieldKey]}
										size="icon"
										type="button"
										variant="outline"
									>
										<RotateCcw aria-hidden="true" />
									</Button>
								}
							/>
							<TooltipContent side="top" className="text-xs">
								{inputState === "manual"
									? "Aktuellen KI-Vorschlag oder berechneten Wert verwenden"
									: "Wieder aus der Formel berechnen"}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : null}
				{trailing}
			</div>
		</>
	);
};

const CalcInputField = ({
	input,
	context,
	renderChildren,
}: {
	input: CalcInputTagType;
	context: RenderContext;
	renderChildren: (inputs: InputTagType[]) => React.ReactNode;
}) => {
	const fieldKey = input.attributes.primary;
	const inputState = context.fieldSources[fieldKey];
	const { children } = input;

	return (
		<div
			className={getInputWrapperClassName(
				context.activeInputName === fieldKey,
				Boolean(context.onInputSelect),
			)}
			ref={registerFieldRef(context, fieldKey, input)}
			{...getSelectableFieldHandlers(fieldKey, context)}
		>
			{inputState && (
				<div className="absolute -top-1 right-0 z-10">
					<SourceIndicator source={inputState} />
				</div>
			)}
			<CalcValueField calculation={input} context={context} />
			{children.length > 0 && (
				<div className="ml-4 max-w-full space-y-2 border-muted border-l-2 pr-4 pl-4">
					{renderChildren(children)}
				</div>
			)}
		</div>
	);
};

type FieldRefs = Map<string, Map<HTMLElement, number>>;

/**
 * How well each input suits as the scroll target of its variable (lower is
 * better): less nested, and outside conditional branches.
 */
const collectScrollRanks = (inputTags: InputTagType[]): Map<InputTagType, number> => {
	const ranks = new Map<InputTagType, number>();
	const visit = (input: InputTagType, depth: number, guarded: boolean) => {
		// Inputs reached through a case count as guarded, like branch-guarded ones.
		const isGuarded = guarded || Boolean(input.visibility);
		ranks.set(input, (isGuarded ? 1000 : 0) + depth);
		for (const child of input.children ?? []) {
			visit(child, depth + 1, isGuarded || input.name === "Case");
		}
	};
	for (const input of inputTags) {
		visit(input, 0, false);
	}
	return ranks;
};

/**
 * Registers a rendered mention of a variable as a possible scroll target.
 * Every shown mention registers, so focusing works whichever case is active.
 */
const registerFieldRef =
	(context: RenderContext, name: string, input: InputTagType, penalty = 0) =>
	(node: HTMLDivElement | null) => {
		if (!node) {
			return;
		}
		const mentions = context.fieldRefs.current.get(name) ?? new Map<HTMLElement, number>();
		context.fieldRefs.current.set(name, mentions);
		mentions.set(node, (context.scrollRanks.get(input) ?? 5000) + penalty);
		return () => {
			mentions.delete(node);
		};
	};

/** The best shown mention of a variable to scroll to, other than `except`. */
const findFieldTarget = (
	refs: FieldRefs,
	name: string,
	except?: Element | null,
): HTMLElement | undefined => {
	let best: HTMLElement | undefined;
	let bestRank = Infinity;
	for (const [element, rank] of refs.get(name) ?? []) {
		if (element.isConnected && element !== except && rank < bestRank) {
			best = element;
			bestRank = rank;
		}
	}
	return best;
};

/**
 * A calc component that is itself calculated elsewhere mirrors that
 * calculation's value control, so it can be overridden in place, and links
 * to the calculation instead of offering a second, independent input.
 */
const CalcReference = ({
	calculation,
	context,
	mention,
}: {
	calculation: CalcInputTagType;
	context: RenderContext;
	/** The input tag shown as this reference. */
	mention: InputTagType;
}) => {
	const fieldKey = calculation.attributes.primary;
	return (
		// Also a scroll target, so the variable stays reachable when the
		// calculation itself sits in a hidden case; the real control wins.
		<div
			className="my-2"
			data-calc-reference=""
			ref={registerFieldRef(context, fieldKey, mention, 500)}
		>
			<CalcValueField
				calculation={calculation}
				context={context}
				trailing={
					<button
						aria-label={`${fieldKey} – ursprüngliche Berechnung öffnen`}
						className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						title="Berechneter Wert – ursprüngliche Berechnung öffnen"
						type="button"
						onFocus={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							const target = findFieldTarget(
								context.fieldRefs.current,
								fieldKey,
								event.currentTarget.closest("[data-calc-reference]"),
							);
							target?.scrollIntoView({ behavior: "smooth", block: "center" });
							if (target) {
								focusFirstInputControl(target);
							}
							context.onInputSelect?.(fieldKey);
						}}
					>
						berechnet
						<ArrowUpRight aria-hidden="true" className="size-4" />
					</button>
				}
			/>
		</div>
	);
};

/** A list may mention one variable more than once, so positions key its entries. */
const renderInputList = (
	inputs: InputTagType[],
	context: RenderContext,
	parentCalcKey?: string,
): React.ReactNode =>
	inputs.map((input, index) => (
		<Fragment key={`${input.name}:${input.attributes.primary}:${index}`}>
			{renderInputTag(input, context, parentCalcKey)}
		</Fragment>
	));

const renderInputTag = (
	input: InputTagType,
	context: RenderContext,
	parentCalcKey?: string,
): React.ReactNode | null => {
	if (!input.attributes.primary || !isBranchVisible(input.visibility, context.values)) {
		return null;
	}

	const fieldKey = input.attributes.primary;
	// Any other mention of a calculated variable mirrors and links to the calculation.
	const calculation = input.name !== "Calc" && context.calculations.get(fieldKey);
	if (calculation) {
		return <CalcReference calculation={calculation} context={context} mention={input} />;
	}
	const selectionFieldKey = parentCalcKey ?? fieldKey;
	const suggestedValue = context.suggestedValues[fieldKey];
	const inputState = context.fieldSources[fieldKey];
	const inputStateClassName = getInputStateClassName(inputState);
	const handleFieldChange = context.changeHandlers[fieldKey];
	const handleApplySuggestion = context.clearHandlers[fieldKey];
	const isActiveInput = !parentCalcKey && context.activeInputName === fieldKey;
	const selectableFieldHandlers = getSelectableFieldHandlers(selectionFieldKey, context);
	const handleFieldRef = registerFieldRef(context, fieldKey, input);

	if (input.name === "Info") {
		return (
			<div
				className={getInputWrapperClassName(isActiveInput, Boolean(context.onInputSelect))}
				ref={handleFieldRef}
				{...selectableFieldHandlers}
			>
				{inputState && (
					<div className="absolute -top-1 right-0 z-10">
						<SourceIndicator source={inputState} />
					</div>
				)}
				<LazyInfoInput
					input={input}
					inputClassName={inputStateClassName}
					onAcceptSuggestedValue={suggestedValue ? handleApplySuggestion : undefined}
					onChange={handleFieldChange}
					suggestedValue={toTextOrNumberSuggestion(suggestedValue?.value)}
					suggestionLabel={getSuggestionLabel(suggestedValue)}
					value={context.values[fieldKey] as string | number | undefined}
				/>
			</div>
		);
	}

	if (input.name === "Switch") {
		const currentValue = context.values[fieldKey] as string | number | boolean | undefined;
		const selectedCaseChildren = selectedSwitchCases(input, context.values).flatMap(
			(branch) => branch.children,
		);

		return (
			<div
				className={getInputWrapperClassName(isActiveInput, Boolean(context.onInputSelect))}
				ref={handleFieldRef}
				{...selectableFieldHandlers}
			>
				{inputState && (
					<div className="absolute -top-1 right-0 z-10">
						<SourceIndicator source={inputState} />
					</div>
				)}
				<SwitchInput
					input={input}
					onChange={handleFieldChange}
					onAcceptSuggestedValue={suggestedValue ? handleApplySuggestion : undefined}
					inputClassName={inputStateClassName}
					suggestedValue={suggestedValue?.value}
					suggestionLabel={getSuggestionLabel(suggestedValue)}
					value={currentValue}
				/>
				{/* Render children of selected case */}
				{selectedCaseChildren.length > 0 && (
					<div className="mt-2.5 ml-4 space-y-2.5">
						{renderInputList(selectedCaseChildren, context, parentCalcKey)}
					</div>
				)}
			</div>
		);
	}

	if (input.name === "Calc") {
		return (
			<CalcInputField
				context={context}
				input={input}
				renderChildren={(children) => renderInputList(children, context, fieldKey)}
			/>
		);
	}

	return null;
};

export default function Inputs({
	activeInputFocusKey,
	activeInputName,
	inputTags = [],
	onChange,
	onInputBlur,
	onInputSelect,
	showFillInputs = false,
	onFillInputs,
	renderFillControls,
	suggestedValues: suggestedValuesProp,
	onSuggestedValuesChange,
}: InputsProps) {
	const [userValues, setUserValues] = useState<Record<string, unknown>>({});
	const [suggestedValues, setSuggestedValues] = useState<Record<string, SuggestedValue>>(
		suggestedValuesProp ?? {},
	);
	const fieldRefs = useRef<FieldRefs>(new Map());
	const scrollRanks = useMemo(() => collectScrollRanks(inputTags), [inputTags]);
	const calculations = useMemo(() => {
		const found = new Map<string, CalcInputTagType>();
		const visit = (input: InputTagType) => {
			if (
				input.name === "Calc" &&
				input.attributes.primary &&
				!found.has(input.attributes.primary)
			) {
				found.set(input.attributes.primary, input);
			}
			for (const child of input.children ?? []) {
				visit(child);
			}
		};
		for (const input of inputTags) {
			visit(input);
		}
		return found;
	}, [inputTags]);
	const isFocusSelectionSuppressed = useRef(false);
	const lastHandledFocusKeyRef = useRef(activeInputFocusKey);
	const aiValues = useMemo(
		() =>
			Object.fromEntries(Object.entries(suggestedValues).map(([key, item]) => [key, item.value])),
		[suggestedValues],
	);
	const explicitValues = useMemo(() => ({ ...aiValues, ...userValues }), [aiValues, userValues]);
	const resolvedValues = useMemo(
		() => resolveCalculatedValues(inputTags, explicitValues),
		[inputTags, explicitValues],
	);
	const fieldSources = useMemo<Record<string, InputSource>>(() => {
		const sources = new Map<string, InputSource>(
			Object.keys(suggestedValues).map((key) => [key, "ai"]),
		);
		for (const [key, value] of Object.entries(userValues)) {
			if (isEmptyValue(value)) {
				sources.delete(key);
			} else {
				sources.set(key, "manual");
			}
		}
		return Object.fromEntries(sources);
	}, [suggestedValues, userValues]);

	useEffect(() => {
		onChange(resolvedValues);
	}, [resolvedValues, onChange]);

	useEffect(() => {
		if (
			activeInputFocusKey === undefined ||
			Object.is(lastHandledFocusKeyRef.current, activeInputFocusKey)
		) {
			return;
		}
		lastHandledFocusKeyRef.current = activeInputFocusKey;
		if (!activeInputName) {
			return;
		}
		const activeField = findFieldTarget(fieldRefs.current, activeInputName);
		if (!activeField) {
			return;
		}
		activeField.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
		isFocusSelectionSuppressed.current = true;
		try {
			focusFirstInputControl(activeField);
		} finally {
			isFocusSelectionSuppressed.current = false;
		}
	}, [activeInputFocusKey, activeInputName]);

	useEffect(() => {
		if (!suggestedValuesProp) {
			return;
		}
		setSuggestedValues(suggestedValuesProp);
	}, [suggestedValuesProp]);

	// Dropping a manual value reveals the AI suggestion, or else the calculation.
	const clearUserValue = useCallback((key: string) => {
		setUserValues((previous) => withoutRecordKey(previous, key));
	}, []);

	// Emptying a calculated field resumes calculation; any other field keeps an
	// explicit empty value instead of reviving its AI suggestion.
	const handleInputChange = useCallback(
		(key: string, value: unknown) => {
			if (isEmptyValue(value) && calculations.has(key)) {
				clearUserValue(key);
				return;
			}
			setUserValues((previous) => ({ ...previous, [key]: value }));
		},
		[calculations, clearUserValue],
	);

	const fieldKeys = useMemo(() => {
		const keys = new Set<string>();
		const visit = (inputTag: InputTagType) => {
			const fieldKey = inputTag.attributes.primary;
			if (fieldKey && inputTag.name !== "Case") {
				keys.add(fieldKey);
			}
			for (const child of inputTag.children ?? []) {
				visit(child);
			}
		};

		for (const inputTag of inputTags) {
			visit(inputTag);
		}

		return [...keys];
	}, [inputTags]);

	const changeHandlers = useMemo<Record<string, (value: unknown) => void>>(() => {
		const handlers: Record<string, (value: unknown) => void> = {};
		for (const fieldKey of fieldKeys) {
			handlers[fieldKey] = (value) => {
				handleInputChange(fieldKey, value);
			};
		}
		return handlers;
	}, [fieldKeys, handleInputChange]);

	// Accepting a suggestion and resetting a calc peel off one explicit layer.
	const clearHandlers = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const fieldKey of fieldKeys) {
			handlers[fieldKey] = () => {
				if (Object.hasOwn(userValues, fieldKey) || !calculations.has(fieldKey)) {
					clearUserValue(fieldKey);
					return;
				}
				const nextSuggestions = withoutRecordKey(suggestedValues, fieldKey);
				setSuggestedValues(nextSuggestions);
				onSuggestedValuesChange?.(nextSuggestions);
			};
		}
		return handlers;
	}, [
		calculations,
		clearUserValue,
		fieldKeys,
		onSuggestedValuesChange,
		suggestedValues,
		userValues,
	]);

	const { fields: fillInputFields, meta: fillInputMeta } = useMemo(
		() => collectFillInputFields(inputTags),
		[inputTags],
	);

	const handleFillInputs = useCallback(
		async (
			audioFiles: FillInputsAudioFile[],
			textContext: FillInputsTextContext,
			contextFiles: FillInputsContextFile[],
		) => {
			if (!onFillInputs) {
				return;
			}

			if (fillInputFields.length === 0) {
				toast.error("Keine Eingabefelder verfügbar");
				return;
			}

			toast.loading("Felder werden ausgefüllt...", {
				id: "fill-inputs",
			});

			try {
				const fieldValues = await onFillInputs(
					fillInputFields,
					audioFiles,
					textContext,
					contextFiles,
				);

				const nextSuggestions: Record<string, SuggestedValue> = {};
				for (const [field, value] of Object.entries(fieldValues)) {
					const normalizedValue = normalizeFillInputsValue(value, fillInputMeta.get(field));
					if (normalizedValue === undefined || isEmptyValue(normalizedValue)) {
						continue;
					}
					nextSuggestions[field] = {
						source: "ai",
						value: normalizedValue,
					};
				}

				setSuggestedValues(nextSuggestions);
				onSuggestedValuesChange?.(nextSuggestions);
				// A field the user emptied takes a new suggestion; other manual values stay.
				setUserValues((previous) =>
					Object.fromEntries(
						Object.entries(previous).filter(
							([field, value]) => !(isEmptyValue(value) && field in nextSuggestions),
						),
					),
				);

				toast.success("Felder ausgefüllt", {
					id: "fill-inputs",
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
				toast.error(`Ausfüllen fehlgeschlagen: ${errorMessage}`, {
					id: "fill-inputs",
				});
			}
		},
		[fillInputFields, fillInputMeta, onFillInputs, onSuggestedValuesChange],
	);

	if (inputTags.length === 0 || !inputTags) {
		return null;
	}

	const shouldShowFillInputs = Boolean(showFillInputs && onFillInputs && renderFillControls);
	const renderContext: RenderContext = {
		activeInputName,
		calculations,
		changeHandlers,
		clearHandlers,
		fieldRefs,
		fieldSources,
		isFocusSelectionSuppressed,
		onInputBlur,
		onInputSelect,
		scrollRanks,
		suggestedValues,
		values: resolvedValues,
	};

	return (
		<form className="flex h-full w-full flex-col overflow-hidden">
			{/* Scrollable inputs area */}
			<div
				className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-none p-3 pr-3"
				key="inputs-list"
			>
				{renderInputList(inputTags, renderContext)}
			</div>
			{/* Fixed autofill footer */}
			{shouldShowFillInputs && renderFillControls
				? renderFillControls({ onSubmit: handleFillInputs })
				: null}
		</form>
	);
}
