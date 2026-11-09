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
import { ArrowUpRight, Bot, FileSearch, Pencil, RotateCcw, Sigma } from "lucide-react";
import type { CitationRequest } from "markdoc-md/citations";
import { CALC_PLACEHOLDER } from "markdoc-md/config";
import {
	isBranchVisible,
	resolveCalculatedValues,
	selectedSwitchCases,
	toNumericValue,
	toVoiceBooleanValue as toFillInputsBooleanValue,
} from "markdoc-md/parse";
import type { CalcInputTagType, InputTagType } from "markdoc-md/parse";
import { useCitationModifier } from "markdoc-md/react";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ContextDocument, OcrResult } from "@/lib/ocr-types";

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
	onCitationsSelect?: (citations: CitationRequest[]) => void;
	showFillInputs?: boolean;
	onFillInputs?: (
		inputFields: FillInputsInputField[],
		audioFiles: FillInputsAudioFile[],
		textContext: FillInputsTextContext,
		contextFiles: FillInputsContextFile[],
		/** Values appear before the separate citation pass finishes. */
		onProgress?: (result: FillInputsResult, stage: "decisions" | "values") => void,
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

export interface FieldState {
	source?: InputSource;
	suggestion?: SuggestedValue;
	suggestionLabel?: string;
	/** Sources of the value currently in use; only AI values have them. */
	citations?: CitationRequest[];
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

interface FillInputSuggestion {
	citations?: CitationRequest[];
	value: boolean | number | string;
}

export interface FillInputsResult {
	citationError?: boolean;
	ocrResults: OcrResult[];
	suggestions: Record<string, FillInputSuggestion>;
}

type SuggestedValueSource = "ai" | "note" | "document" | "prefill";

interface SuggestedValue {
	citations?: CitationRequest[];
	value: string | number | boolean;
	source?: SuggestedValueSource;
	label?: string;
}

interface InputMeta {
	calculation?: FillInputsInputField["calculation"];
	options?: string[];
	type: "string" | "number" | "date" | "switch" | "boolean";
}

export type InputSource = "ai" | "ai-confirmed" | "manual";

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
	if (source === "ai-confirmed" || source === "manual") {
		return "border-solarized-green/60 focus-visible:border-solarized-green focus-visible:ring-solarized-green/30 data-focus-within:border-solarized-green data-focus-within:ring-solarized-green/30";
	}
	return "";
};

const getInputWrapperClassName = (
	isActive: boolean,
	canSelect: boolean,
	isCitationHighlighted: boolean,
) =>
	cn(
		"relative rounded-lg border border-transparent p-1 transition-colors",
		canSelect && "cursor-pointer",
		canSelect && !isActive && "hover:bg-muted/40",
		isActive && "border-solarized-orange/60 bg-solarized-orange/10",
		isCitationHighlighted && "border-solarized-blue/60 bg-solarized-blue/10",
	);

const isInteractiveElement = (element: HTMLElement): boolean =>
	Boolean(
		element.closest(
			'a,button,input,select,textarea,[role="button"],[role="combobox"],[tabindex]:not([tabindex="-1"])',
		),
	);

const focusFirstInputControl = (container: HTMLElement): boolean => {
	const focusSelectors = [
		// Date fields carry a hidden form input; their segments are the controls.
		'input:not([type="hidden"]):not([hidden]):not([tabindex="-1"]):not([disabled])',
		'[role="spinbutton"]:not([aria-disabled="true"])',
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
			return true;
		}
	}
	return false;
};

const SourceIndicator = ({
	onShowSource,
	source,
}: {
	onShowSource?: () => void;
	source: InputSource | undefined;
}) => {
	if (!source) {
		return null;
	}

	const config = {
		ai: {
			className: "text-solarized-orange",
			icon: Bot,
			label: "KI-Erkennung",
		},
		"ai-confirmed": {
			className: "text-solarized-green",
			icon: Bot,
			label: "KI-Vorschlag bestätigt",
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

	if (onShowSource) {
		return (
			<TooltipProvider delay={200}>
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								aria-label="Quellen des KI-Werts anzeigen"
								className={cn(
									"inline-flex h-9 items-center justify-center gap-2 rounded-md bg-background px-2 shadow-xs hover:bg-solarized-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solarized-blue/40 sm:h-7",
									config.className,
								)}
								onClick={onShowSource}
								type="button"
							>
								<Icon aria-hidden="true" className="h-3.5 w-3.5" />
								<FileSearch aria-hidden="true" className="h-3.5 w-3.5" />
							</button>
						}
					/>
					<TooltipContent side="top" className="text-xs">
						{config.label} – Quellen anzeigen
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

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
	areCitationsHighlighted: boolean;
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
	onCitationsSelect?: (citations: CitationRequest[]) => void;
	suggestedValues: Record<string, SuggestedValue>;
	values: Record<string, unknown>;
}

const getAppliedCitations = (
	fieldKey: string,
	context: RenderContext,
): CitationRequest[] | undefined => {
	if (!["ai", "ai-confirmed"].includes(context.fieldSources[fieldKey])) {
		return undefined;
	}
	return context.suggestedValues[fieldKey]?.citations;
};

const createCitationsSelectHandler = (
	citations: CitationRequest[] | undefined,
	onCitationsSelect: RenderContext["onCitationsSelect"],
): (() => void) | undefined => {
	if (!citations?.length || !onCitationsSelect) {
		return undefined;
	}
	return () => onCitationsSelect(citations);
};

const isFieldCitationHighlighted = (
	citations: CitationRequest[] | undefined,
	context: RenderContext,
): boolean =>
	Boolean(citations?.length && context.onCitationsSelect && context.areCitationsHighlighted);

const getSelectableFieldHandlers = (
	fieldKey: string,
	context: RenderContext,
	citationFieldKey = fieldKey,
): {
	onBlurCapture?: (event: React.FocusEvent<HTMLDivElement>) => void;
	onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
	onFocusCapture?: () => void;
	onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
	role?: "group";
} => {
	const citations = getAppliedCitations(citationFieldKey, context);
	const handleInputSelect = context.onInputSelect
		? () => {
				if (context.isFocusSelectionSuppressed.current) {
					return;
				}
				context.onInputSelect?.(fieldKey);
			}
		: undefined;
	const handleCitationsSelect = createCitationsSelectHandler(citations, context.onCitationsSelect);

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
		onClick:
			handleInputSelect || handleCitationsSelect
				? (event) => {
						if ((event.metaKey || event.ctrlKey) && handleCitationsSelect) {
							event.preventDefault();
							event.stopPropagation();
							handleCitationsSelect();
							return;
						}
						const { target } = event;
						if (
							!handleInputSelect ||
							!(target instanceof HTMLElement) ||
							isInteractiveElement(target)
						) {
							return;
						}
						handleInputSelect();
						focusFirstInputControl(event.currentTarget);
					}
				: undefined,
		onFocusCapture: handleInputSelect,
		onKeyDown:
			handleInputSelect || handleCitationsSelect
				? (event) => {
						if (
							(event.metaKey || event.ctrlKey) &&
							event.key === "Enter" &&
							handleCitationsSelect
						) {
							event.preventDefault();
							event.stopPropagation();
							handleCitationsSelect();
							return;
						}
						if (event.target !== event.currentTarget || ![" ", "Enter"].includes(event.key)) {
							return;
						}
						if (!handleInputSelect) {
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
	const activeCitations = getAppliedCitations(fieldKey, context);
	const handleShowSource = createCitationsSelectHandler(activeCitations, context.onCitationsSelect);

	return (
		<div
			className={getInputWrapperClassName(
				context.activeInputName === fieldKey,
				Boolean(context.onInputSelect),
				isFieldCitationHighlighted(activeCitations, context),
			)}
			ref={registerFieldRef(context, fieldKey, input)}
			{...getSelectableFieldHandlers(fieldKey, context)}
		>
			{inputState && (
				<div className="absolute -top-1 right-0 z-10">
					<SourceIndicator source={inputState} onShowSource={handleShowSource} />
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
			{...getSelectableFieldHandlers(fieldKey, context)}
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

/**
 * A list may mention one variable more than once, so positions key its entries.
 * Of several branch-guarded infos of one variable, only the first shown renders.
 */
const renderInputList = (
	inputs: InputTagType[],
	context: RenderContext,
	parentCalcKey?: string,
): React.ReactNode => {
	const shownInfos = new Set<string>();
	return inputs.map((input, index) => {
		if (input.name === "Info" && isBranchVisible(input.visibility, context.values)) {
			if (shownInfos.has(input.attributes.primary)) {
				return null;
			}
			shownInfos.add(input.attributes.primary);
		}
		return (
			<Fragment key={`${input.name}:${input.attributes.primary}:${index}`}>
				{renderInputTag(input, context, parentCalcKey)}
			</Fragment>
		);
	});
};

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
	const activeCitations = getAppliedCitations(fieldKey, context);
	const handleShowSource = createCitationsSelectHandler(activeCitations, context.onCitationsSelect);
	const isCitationHighlighted = isFieldCitationHighlighted(activeCitations, context);
	const handleShowSuggestedSource = createCitationsSelectHandler(
		suggestedValue?.citations,
		context.onCitationsSelect,
	);
	const selectableFieldHandlers = getSelectableFieldHandlers(selectionFieldKey, context, fieldKey);
	const handleFieldRef = registerFieldRef(context, fieldKey, input);

	if (input.name === "Info") {
		return (
			<div
				className={getInputWrapperClassName(
					isActiveInput,
					Boolean(context.onInputSelect),
					isCitationHighlighted,
				)}
				ref={handleFieldRef}
				{...selectableFieldHandlers}
			>
				{inputState && (
					<div className="absolute -top-1 right-0 z-10">
						<SourceIndicator onShowSource={handleShowSource} source={inputState} />
					</div>
				)}
				<LazyInfoInput
					input={input}
					inputClassName={inputStateClassName}
					onAcceptSuggestedValue={suggestedValue ? handleApplySuggestion : undefined}
					onChange={handleFieldChange}
					onShowSuggestedValueSource={handleShowSuggestedSource}
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
				className={getInputWrapperClassName(
					isActiveInput,
					Boolean(context.onInputSelect),
					isCitationHighlighted,
				)}
				ref={handleFieldRef}
				{...selectableFieldHandlers}
			>
				{inputState && (
					<div className="absolute -top-1 right-0 z-10">
						<SourceIndicator onShowSource={handleShowSource} source={inputState} />
					</div>
				)}
				<SwitchInput
					input={input}
					onChange={handleFieldChange}
					onAcceptSuggestedValue={suggestedValue ? handleApplySuggestion : undefined}
					inputClassName={inputStateClassName}
					onShowSuggestedValueSource={handleShowSuggestedSource}
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

interface FieldsSnapshot {
	user: Record<string, unknown>;
	suggested: Record<string, SuggestedValue>;
}

const MAX_HISTORY = 100;

/** The shared field state of a template or document, and its write paths. */
export interface TemplateFields {
	/** Explicit values over calculations; what the text and the PDF show. */
	values: Record<string, unknown>;
	calculations: Map<string, CalcInputTagType>;
	fieldSources: Record<string, InputSource>;
	suggestedValues: Record<string, SuggestedValue>;
	/** Provenance, AI suggestion and sources per field, for editors outside the side form. */
	states: Record<string, FieldState>;
	changeHandlers: Record<string, (value: unknown) => void>;
	/**
	 * Drops a field's manual value, revealing its AI suggestion. For a calculation
	 * without a manual value, drops the AI suggestion, revealing the calculation.
	 */
	clearHandlers: Record<string, () => void>;
	setValue: (key: string, value: unknown) => void;
	/** Fills the fields with AI from the given context; undefined without a fill backend. */
	fill?: (
		audioFiles: FillInputsAudioFile[],
		textContext: FillInputsTextContext,
		contextFiles: FillInputsContextFile[],
	) => Promise<void>;
	/** Drops typed values and AI suggestions together; `forgetHistory` also drops undo. */
	reset: (forgetHistory?: boolean) => void;
	/** Steps back or forward through edits, AI fills and resets; one step per edited field. */
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
}

/**
 * Owns typed values, AI suggestions and their provenance for one template or
 * document, independent of which editor shows them.
 */
export const useTemplateFields = (
	inputTags: InputTagType[],
	{
		onFillInputs,
		onSuggestedValuesChange,
		suggestedValues: suggestedValuesProp,
	}: Pick<InputsProps, "onFillInputs" | "onSuggestedValuesChange" | "suggestedValues"> = {},
): TemplateFields => {
	const [userValues, setUserValues] = useState<Record<string, unknown>>({});
	const [suggestedValues, setSuggestedValues] = useState<Record<string, SuggestedValue>>(
		suggestedValuesProp ?? {},
	);
	const activeFillRef = useRef<{ edited: Set<string>; discarded: Set<string> } | null>(null);
	// Undo history of whole states. Consecutive edits of one field form one step.
	const [history, setHistory] = useState<{ past: FieldsSnapshot[]; future: FieldsSnapshot[] }>({
		future: [],
		past: [],
	});
	const currentRef = useRef<FieldsSnapshot>({ suggested: suggestedValues, user: userValues });
	const lastEditedRef = useRef<string | null>(null);
	useEffect(() => {
		currentRef.current = { suggested: suggestedValues, user: userValues };
	}, [suggestedValues, userValues]);
	/** Remembers the current state as an undo step before a change; `key` merges a field's edits. */
	const record = useCallback((key: string | null = null) => {
		if (key !== null && lastEditedRef.current === key) {
			return;
		}
		lastEditedRef.current = key;
		const { current } = currentRef;
		setHistory(({ past }) => ({ future: [], past: [...past, current].slice(-MAX_HISTORY) }));
	}, []);
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
				sources.set(
					key,
					!calculations.has(key) && Object.is(value, suggestedValues[key]?.value)
						? "ai-confirmed"
						: "manual",
				);
			}
		}
		return Object.fromEntries(sources);
	}, [calculations, suggestedValues, userValues]);

	useEffect(() => {
		if (!suggestedValuesProp) {
			return;
		}
		setSuggestedValues(suggestedValuesProp);
	}, [suggestedValuesProp]);

	// Dropping a manual value reveals the AI suggestion, or else the calculation.
	const clearUserValue = useCallback(
		(key: string) => {
			record(key);
			setUserValues((previous) => withoutRecordKey(previous, key));
		},
		[record],
	);

	// Emptying a calculated field resumes calculation; any other field keeps an
	// explicit empty value instead of reviving its AI suggestion.
	const handleInputChange = useCallback(
		(key: string, value: unknown) => {
			activeFillRef.current?.edited.add(key);
			if (isEmptyValue(value) && calculations.has(key)) {
				clearUserValue(key);
				return;
			}
			record(key);
			setUserValues((previous) => ({ ...previous, [key]: value }));
		},
		[calculations, clearUserValue, record],
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
				activeFillRef.current?.discarded.add(fieldKey);
				record();
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
		record,
		suggestedValues,
		userValues,
	]);

	const states = useMemo(() => {
		const keys = new Set([...Object.keys(fieldSources), ...Object.keys(suggestedValues)]);
		return Object.fromEntries(
			[...keys].map((key): [string, FieldState] => {
				const suggestion = suggestedValues[key];
				const source = fieldSources[key];
				return [
					key,
					{
						citations:
							source === "ai" || source === "ai-confirmed" ? suggestion?.citations : undefined,
						source,
						suggestion,
						suggestionLabel: suggestion ? getSuggestionLabel(suggestion) : undefined,
					},
				];
			}),
		);
	}, [fieldSources, suggestedValues]);

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

			const fill = { discarded: new Set<string>(), edited: new Set<string>() };
			activeFillRef.current = fill;
			// The whole fill is one undo step.
			record();
			let valueSuggestions: Record<string, SuggestedValue> = {};
			// New stages may fill new fields, but cannot undo edits made during this request.
			const applySuggestions = (result: FillInputsResult) => {
				const nextSuggestions: Record<string, SuggestedValue> = {};
				for (const [field, suggestion] of Object.entries(result.suggestions)) {
					if (fill.discarded.has(field)) {
						continue;
					}
					const normalizedValue = normalizeFillInputsValue(
						suggestion.value,
						fillInputMeta.get(field),
					);
					if (normalizedValue === undefined || isEmptyValue(normalizedValue)) {
						continue;
					}
					nextSuggestions[field] = {
						citations: suggestion.citations,
						source: "ai",
						value: normalizedValue,
					};
				}

				valueSuggestions = nextSuggestions;
				setSuggestedValues(nextSuggestions);
				onSuggestedValuesChange?.(nextSuggestions);
				// A field the user emptied takes a new suggestion; other manual values stay.
				setUserValues((previous) =>
					Object.fromEntries(
						Object.entries(previous).filter(
							([field, value]) =>
								fill.edited.has(field) || !(isEmptyValue(value) && field in nextSuggestions),
						),
					),
				);
			};
			let hasProgress = false;
			try {
				const result = await onFillInputs(
					fillInputFields,
					audioFiles,
					textContext,
					contextFiles,
					(progress, stage) => {
						hasProgress = true;
						applySuggestions(progress);
						toast.loading(
							stage === "values"
								? "Felder ausgefüllt, Quellen werden ergänzt..."
								: `${Object.keys(progress.suggestions).length} Felder übernommen, weitere werden ausgefüllt...`,
							{ id: "fill-inputs" },
						);
					},
				);
				if (hasProgress) {
					// Completion enriches only the values already shown, never resurrects or rewrites them.
					const citedSuggestions = Object.fromEntries(
						Object.entries(valueSuggestions).flatMap(([field, suggestion]) => {
							if (fill.discarded.has(field)) {
								return [];
							}
							const annotation = result.suggestions[field];
							const unchanged = Object.is(
								suggestion.value,
								normalizeFillInputsValue(annotation?.value, fillInputMeta.get(field)),
							);
							return [
								[
									field,
									unchanged ? { ...suggestion, citations: annotation.citations } : suggestion,
								],
							];
						}),
					);
					setSuggestedValues(citedSuggestions);
					onSuggestedValuesChange?.(citedSuggestions);
				} else {
					applySuggestions(result);
				}
				if (result.citationError) {
					// Decision-model answers bring their own sources; only the later
					// source pass for the remaining fields failed.
					const hasSomeSources = Object.values(result.suggestions).some(
						({ citations }) => citations?.length,
					);
					toast.warning(
						hasSomeSources
							? "Felder ausgefüllt; nicht für alle Felder konnten Quellen ergänzt werden."
							: "Felder ausgefüllt; Quellen konnten nicht ergänzt werden.",
						{ id: "fill-inputs" },
					);
				} else {
					toast.success("Felder ausgefüllt", { id: "fill-inputs" });
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
				// Already shown values stay, including when the citation stream disconnects.
				toast.error(
					hasProgress
						? `Weitere Felder konnten nicht ausgefüllt werden: ${errorMessage}`
						: `Ausfüllen fehlgeschlagen: ${errorMessage}`,
					{ id: "fill-inputs" },
				);
			} finally {
				activeFillRef.current = null;
			}
		},
		[fillInputFields, fillInputMeta, onFillInputs, onSuggestedValuesChange, record],
	);

	const reset = useCallback(
		(forgetHistory = false) => {
			activeFillRef.current = null;
			if (forgetHistory) {
				lastEditedRef.current = null;
				setHistory({ future: [], past: [] });
			} else {
				record();
			}
			setUserValues({});
			setSuggestedValues({});
			onSuggestedValuesChange?.({});
		},
		[onSuggestedValuesChange, record],
	);

	const restore = useCallback(
		(snapshot: FieldsSnapshot) => {
			lastEditedRef.current = null;
			setUserValues(snapshot.user);
			setSuggestedValues(snapshot.suggested);
			onSuggestedValuesChange?.(snapshot.suggested);
		},
		[onSuggestedValuesChange],
	);
	const undo = useCallback(() => {
		const previous = history.past.at(-1);
		if (!previous) {
			return;
		}
		setHistory(({ future, past }) => ({
			future: [currentRef.current, ...future],
			past: past.slice(0, -1),
		}));
		restore(previous);
	}, [history.past, restore]);
	const redo = useCallback(() => {
		const [next] = history.future;
		if (!next) {
			return;
		}
		setHistory(({ future, past }) => ({
			future: future.slice(1),
			past: [...past, currentRef.current],
		}));
		restore(next);
	}, [history.future, restore]);

	return {
		calculations,
		canRedo: history.future.length > 0,
		canUndo: history.past.length > 0,
		changeHandlers,
		clearHandlers,
		fieldSources,
		fill: onFillInputs ? handleFillInputs : undefined,
		redo,
		reset,
		setValue: handleInputChange,
		states,
		suggestedValues,
		undo,
		values: resolvedValues,
	};
};

interface InputsListProps extends Pick<
	InputsProps,
	| "activeInputFocusKey"
	| "activeInputName"
	| "inputTags"
	| "onCitationsSelect"
	| "onInputBlur"
	| "onInputSelect"
> {
	className?: string;
	fields: TemplateFields;
}

/** The side-form controls for the given inputs; the values live in `fields`. */
export const InputsList = ({
	activeInputFocusKey,
	activeInputName,
	className,
	fields,
	inputTags,
	onCitationsSelect,
	onInputBlur,
	onInputSelect,
}: InputsListProps) => {
	const areCitationsHighlighted = useCitationModifier();
	const fieldRefs = useRef<FieldRefs>(new Map());
	const scrollRanks = useMemo(() => collectScrollRanks(inputTags), [inputTags]);
	const isFocusSelectionSuppressed = useRef(false);
	const lastHandledFocusKeyRef = useRef(activeInputFocusKey);

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
		const focusField = () => {
			isFocusSelectionSuppressed.current = true;
			try {
				return focusFirstInputControl(activeField);
			} finally {
				isFocusSelectionSuppressed.current = false;
			}
		};
		if (focusField()) {
			return;
		}
		// Lazily loaded controls, such as the first date or number field, appear later.
		const observer = new MutationObserver(() => {
			if (focusField()) {
				observer.disconnect();
			}
		});
		observer.observe(activeField, { childList: true, subtree: true });
		const timeout = window.setTimeout(() => observer.disconnect(), 3000);
		return () => {
			observer.disconnect();
			window.clearTimeout(timeout);
		};
	}, [activeInputFocusKey, activeInputName]);

	const renderContext: RenderContext = {
		activeInputName,
		areCitationsHighlighted,
		calculations: fields.calculations,
		changeHandlers: fields.changeHandlers,
		clearHandlers: fields.clearHandlers,
		fieldRefs,
		fieldSources: fields.fieldSources,
		isFocusSelectionSuppressed,
		onCitationsSelect,
		onInputBlur,
		onInputSelect,
		scrollRanks,
		suggestedValues: fields.suggestedValues,
		values: fields.values,
	};

	return <div className={className}>{renderInputList(inputTags, renderContext)}</div>;
};

export default function Inputs({
	activeInputFocusKey,
	activeInputName,
	inputTags = [],
	onChange,
	onInputBlur,
	onInputSelect,
	onCitationsSelect,
	showFillInputs = false,
	onFillInputs,
	renderFillControls,
	suggestedValues,
	onSuggestedValuesChange,
}: InputsProps) {
	const fields = useTemplateFields(inputTags, {
		onFillInputs,
		onSuggestedValuesChange,
		suggestedValues,
	});

	useEffect(() => {
		onChange(fields.values);
	}, [fields.values, onChange]);

	if (inputTags.length === 0 || !inputTags) {
		return null;
	}

	const shouldShowFillInputs = Boolean(showFillInputs && fields.fill && renderFillControls);

	return (
		<form className="flex h-full w-full flex-col overflow-hidden">
			{/* Scrollable inputs area */}
			<InputsList
				activeInputFocusKey={activeInputFocusKey}
				activeInputName={activeInputName}
				className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-none p-3 pr-3"
				fields={fields}
				inputTags={inputTags}
				onCitationsSelect={onCitationsSelect}
				onInputBlur={onInputBlur}
				onInputSelect={onInputSelect}
			/>
			{/* Fixed autofill footer */}
			{shouldShowFillInputs && renderFillControls && fields.fill
				? renderFillControls({ onSubmit: fields.fill })
				: null}
		</form>
	);
}
