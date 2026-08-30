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
import Formula from "fparser";
import { Bot, Pencil, RotateCcw, Sigma } from "lucide-react";
import {
	resolveMatchedCaseIndex,
	serializeCaseCondition,
	toCaseCondition,
	toFormulaValue,
	toNumericSwitchValue,
	toVoiceBooleanValue as toFillInputsBooleanValue,
} from "markdoc-md/parse";
import type { CalcInputTagType, InputTagType } from "markdoc-md/parse";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

export interface FillInputsContextFile {
	data: string;
	mimeType: string;
	name: string;
	size: number;
}

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
	const seen = new Set<string>();

	const pushField = (
		label: string | undefined,
		description: string | undefined,
		type: InputMeta["type"],
		options?: string[],
		unit?: string,
		calculation?: FillInputsInputField["calculation"],
	) => {
		if (!label || seen.has(label)) {
			return;
		}
		fields.push({ calculation, description, label, options, type, unit });
		meta.set(label, { calculation, options, type });
		seen.add(label);
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
			const options = input.children
				?.filter((child) => child.name === "Case")
				.map((child) => toSwitchCaseKey(child.attributes))
				.filter((key): key is string => Boolean(key));
			const switchType =
				input.attributes.type === "number"
					? "number"
					: (input.attributes.type === "boolean" || input.attributes.type === "checkbox"
					? "boolean"
					: "switch");
			pushField(input.attributes.primary, input.attributes.description, switchType, options, input.attributes.unit);
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

const collectCalcKeys = (inputTags: InputTagType[]): Set<string> => {
	const keys = new Set<string>();
	const visit = (input: InputTagType) => {
		if (input.name === "Calc" && input.attributes.primary) {
			keys.add(input.attributes.primary);
		}
		for (const child of input.children ?? []) {
			visit(child);
		}
	};
	for (const inputTag of inputTags) {
		visit(inputTag);
	}
	return keys;
};

export const calculateCalcValue = (
	input: CalcInputTagType,
	values: Record<string, unknown>,
): number => {
	try {
		const formula = new Formula(input.attributes.formula ?? "");
		const formulaValues = Object.fromEntries(
			Object.entries(values).map(([key, value]) => [key, toFormulaValue(value)]),
		);
		for (const component of input.children) {
			if (!Object.hasOwn(formulaValues, component.attributes.primary)) {
				formulaValues[component.attributes.primary] = 0;
			}
			if (
				component.name !== "Switch" ||
				component.attributes.type === "boolean" ||
				component.attributes.type === "checkbox"
			) {
				continue;
			}
			const selectedCase = component.children.find(
				(child) =>
					child.name === "Case" &&
					child.attributes.primary === values[component.attributes.primary],
			);
			if (selectedCase?.name === "Case" && selectedCase.attributes.value !== undefined) {
				formulaValues[component.attributes.primary] = selectedCase.attributes.value;
			}
		}
		const result = formula.evaluate(formulaValues as Record<string, number>);
		if (typeof result !== "number" || input.attributes.round === false) {
			return typeof result === "number" ? result : 0;
		}
		return Number(result.toFixed(input.attributes.round ?? 2));
	} catch {
		return 0;
	}
};

const resolveCalculatedValues = (
	inputTags: InputTagType[],
	values: Record<string, unknown>,
): Record<string, unknown> => {
	const resolvedValues = { ...values };
	const visit = (input: InputTagType) => {
		if (
			input.name === "Calc" &&
			input.attributes.primary &&
			!Object.hasOwn(values, input.attributes.primary)
		) {
			resolvedValues[input.attributes.primary] = calculateCalcValue(input, resolvedValues);
		}
		for (const child of input.children ?? []) {
			visit(child);
		}
	};
	for (const inputTag of inputTags) {
		visit(inputTag);
	}
	return resolvedValues;
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

const toSwitchCaseKey = (value: unknown): string | undefined => {
	if (value && typeof value === "object") {
		const attributes = value as { primary?: string };
		const condition = toCaseCondition(attributes);
		return attributes.primary || (condition ? serializeCaseCondition(condition) : undefined);
	}
	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "boolean") {
		return String(value);
	}

	if (typeof value === "number" && (value === 0 || value === 1)) {
		return String(Boolean(value));
	}

	return undefined;
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
	changeHandlers: Record<string, (value: unknown) => void>;
	applySuggestionHandlers: Record<string, () => void>;
	fieldRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
	fieldSources: Record<string, InputSource>;
	isFocusSelectionSuppressed: React.MutableRefObject<boolean>;
	onInputBlur?: (inputName: string) => void;
	onInputSelect?: (inputName: string) => void;
	resetCalcHandlers: Record<string, () => void>;
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

const CalcInputField = ({
	input,
	context,
	renderChild,
}: {
	input: CalcInputTagType;
	context: RenderContext;
	renderChild: (input: InputTagType) => React.ReactNode | null;
}) => {
	const fieldKey = input.attributes.primary;
	const controlId = useId();
	const inputState = context.fieldSources[fieldKey];
	const inputStateClassName = getInputStateClassName(inputState);
	const isOverridden = inputState !== undefined;
	const isActiveInput = context.activeInputName === fieldKey;
	const [isEditing, setIsEditing] = useState(false);
	const [calcDraft, setCalcDraft] = useState("");
	const handleCalcChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setCalcDraft(event.target.value);
	};
	const handleCalcBlur = (event: React.FocusEvent<HTMLInputElement>) => {
		const nextDraft = event.currentTarget.value;
		setIsEditing(false);
		if (!nextDraft || !Number.isFinite(Number(nextDraft))) {
			context.resetCalcHandlers[fieldKey]?.();
			return;
		}
		const nextValue = Number(nextDraft);
		const calculatedValue = calculateCalcValue(input, context.values);
		if (nextValue === calculatedValue) {
			context.resetCalcHandlers[fieldKey]?.();
			return;
		}
		context.changeHandlers[fieldKey]?.(nextValue);
	};
	const handleFieldRef = (node: HTMLDivElement | null) => {
		if (node) {
			context.fieldRefs.current.set(fieldKey, node);
			return;
		}
		context.fieldRefs.current.delete(fieldKey);
	};

	return (
		<div
			className={getInputWrapperClassName(isActiveInput, Boolean(context.onInputSelect))}
			ref={handleFieldRef}
			{...getSelectableFieldHandlers(fieldKey, context)}
		>
			{inputState && (
				<div className="absolute -top-1 right-0 z-10">
					<SourceIndicator source={inputState} />
				</div>
			)}
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
										isOverridden
											? "border-solarized-green/40 text-solarized-green"
											: "border-transparent bg-muted text-muted-foreground",
									)}
									variant={isOverridden ? "outline" : "secondary"}
								>
									{isOverridden ? (
										<Pencil aria-hidden="true" size={11} />
									) : (
										<Sigma aria-hidden="true" size={11} />
									)}
									{isOverridden ? "Überschrieben" : "Berechnet"}
								</Badge>
							}
						/>
						<TooltipContent className="overflow-hidden px-2 py-1 text-sm">
							<div className="space-y-1">
								<p className="font-medium text-[13px]">Formel</p>
								<p className="text-wrap font-mono text-muted-foreground text-xs">
									{input.attributes.formula || "Keine Formel"}
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
						setCalcDraft(event.currentTarget.value);
						setIsEditing(true);
					}}
					step="any"
					type="number"
					value={isEditing ? calcDraft : (context.values[fieldKey] as number)}
				/>
				{input.attributes.unit ? (
					<span className="shrink-0 text-muted-foreground text-sm">{input.attributes.unit}</span>
				) : null}
				{isOverridden ? (
					<TooltipProvider delay={200}>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										aria-label="Berechneten Score wiederherstellen"
										onClick={context.resetCalcHandlers[fieldKey]}
										size="icon"
										type="button"
										variant="outline"
									>
										<RotateCcw aria-hidden="true" />
									</Button>
								}
							/>
							<TooltipContent side="top" className="text-xs">
								Wieder aus der Formel berechnen
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : null}
			</div>
			{input.children.length > 0 && (
				<div className="ml-4 max-w-full space-y-2 border-muted border-l-2 pr-4 pl-4">
					{input.children.map(renderChild)}
				</div>
			)}
		</div>
	);
};

const renderInputTag = (
	input: InputTagType,
	context: RenderContext,
	parentCalcKey?: string,
): React.ReactNode | null => {
	if (!input.attributes.primary) {
		return null;
	}

	const fieldKey = input.attributes.primary;
	const selectionFieldKey = parentCalcKey ?? fieldKey;
	const suggestedValue = context.suggestedValues[fieldKey];
	const inputState = context.fieldSources[fieldKey];
	const inputStateClassName = getInputStateClassName(inputState);
	const handleFieldChange = context.changeHandlers[fieldKey];
	const handleApplySuggestion = context.applySuggestionHandlers[fieldKey];
	const isActiveInput = !parentCalcKey && context.activeInputName === fieldKey;
	const selectableFieldHandlers = getSelectableFieldHandlers(selectionFieldKey, context);
	const handleFieldRef = (node: HTMLDivElement | null) => {
		if (parentCalcKey) {
			return;
		}
		if (node) {
			context.fieldRefs.current.set(fieldKey, node);
			return;
		}
		context.fieldRefs.current.delete(fieldKey);
	};

	if (input.name === "Info") {
		return (
			<div
				className={getInputWrapperClassName(isActiveInput, Boolean(context.onInputSelect))}
				key={`info-${fieldKey}`}
				ref={parentCalcKey ? undefined : handleFieldRef}
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
		const currentCaseKey = toSwitchCaseKey(currentValue);
		const orderedCases = input.children
			?.filter((child) => child.name === "Case")
			.toSorted((a, b) =>
				(a.attributes.index ?? input.children.indexOf(a)) -
				(b.attributes.index ?? input.children.indexOf(b)),
			);
		const matchedNumberCaseIndex =
			input.attributes.type === "number" && orderedCases
				? resolveMatchedCaseIndex(
						toNumericSwitchValue(currentValue),
						orderedCases.map((child) => toCaseCondition(child.attributes)),
					)
				: null;
		const selectedCaseChildren =
			input.attributes.type === "number"
				? (matchedNumberCaseIndex === null
						? []
						: orderedCases?.[matchedNumberCaseIndex]?.children ?? [])
				: (currentCaseKey && input.children
				? input.children
						.filter((child) => child.name === "Case" && child.attributes.primary === currentCaseKey)
						.flatMap((caseChild) => caseChild.children)
				: []);

		return (
			<div
				className={getInputWrapperClassName(isActiveInput, Boolean(context.onInputSelect))}
				key={`switch-${fieldKey}`}
				ref={parentCalcKey ? undefined : handleFieldRef}
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
						{selectedCaseChildren.map((child) => renderInputTag(child, context, parentCalcKey))}
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
				key={`calc-${fieldKey}`}
				renderChild={(child) => renderInputTag(child, context, fieldKey)}
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
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [fieldSources, setFieldSources] = useState<Record<string, InputSource>>({});
	const [suggestedValues, setSuggestedValues] = useState<Record<string, SuggestedValue>>(
		suggestedValuesProp ?? {},
	);
	const stateRef = useRef({ fieldSources, suggestedValues, values });
	const fieldRefs = useRef(new Map<string, HTMLDivElement>());
	const isFocusSelectionSuppressed = useRef(false);
	const lastHandledFocusKeyRef = useRef(activeInputFocusKey);
	const resolvedValues = useMemo(
		() => resolveCalculatedValues(inputTags, values),
		[inputTags, values],
	);
	const calcKeys = useMemo(() => collectCalcKeys(inputTags), [inputTags]);

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
		const activeField = fieldRefs.current.get(activeInputName);
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
		stateRef.current = { fieldSources, suggestedValues, values };
	}, [values, fieldSources, suggestedValues]);

	const applySuggestions = useCallback(
		(nextSuggestions: Record<string, SuggestedValue>, resetAiFields: string[] = []) => {
			const { values: currentValues, fieldSources: currentSources } = stateRef.current;
			let nextValues = { ...currentValues };
			let nextSources = { ...currentSources };

			for (const field of resetAiFields) {
				if (nextSources[field] === "ai") {
					nextValues = withoutRecordKey(nextValues, field);
					nextSources = withoutRecordKey(nextSources, field);
				}
			}

			for (const [field, suggestion] of Object.entries(nextSuggestions)) {
				if (nextSources[field] === "manual") {
					continue;
				}
				const suggestedValue = suggestion.value;
				const existingValue = nextValues[field];

				if (isEmptyValue(existingValue) || nextSources[field] === "ai") {
					nextValues[field] = suggestedValue;
					nextSources[field] = "ai";
					continue;
				}
				if (existingValue === suggestedValue) {
					nextSources[field] = "ai";
					continue;
				}
				nextSources[field] = "manual";
			}

			setValues(nextValues);
			setFieldSources(nextSources);
		},
		[],
	);

	useEffect(() => {
		if (!suggestedValuesProp) {
			return;
		}
		setSuggestedValues(suggestedValuesProp);
		applySuggestions(suggestedValuesProp);
	}, [suggestedValuesProp, applySuggestions]);

	const handleInputChange = useCallback(
		(key: string, value: unknown) => {
			setValues((prevValues) => ({
				...prevValues,
				[key]: value,
			}));
			setFieldSources((prevSources) => {
				if (isEmptyValue(value)) {
					return withoutRecordKey(prevSources, key);
				}
				if (calcKeys.has(key)) {
					return { ...prevSources, [key]: "manual" };
				}
				const hasSuggestion = Boolean(suggestedValues[key]);
				if (hasSuggestion || prevSources[key] === "ai") {
					return {
						...prevSources,
						[key]: "manual",
					};
				}
				return withoutRecordKey(prevSources, key);
			});
		},
		[calcKeys, suggestedValues],
	);

	const resetCalc = useCallback(
		(key: string) => {
			setValues((prevValues) => withoutRecordKey(prevValues, key));
			setFieldSources((prevSources) => withoutRecordKey(prevSources, key));
			const nextSuggestions = withoutRecordKey(stateRef.current.suggestedValues, key);
			setSuggestedValues(nextSuggestions);
			onSuggestedValuesChange?.(nextSuggestions);
		},
		[onSuggestedValuesChange],
	);

	const handleApplySuggestion = useCallback(
		(key: string) => {
			const suggestion = suggestedValues[key];
			if (!suggestion) {
				return;
			}
			setValues((prevValues) => ({
				...prevValues,
				[key]: suggestion.value,
			}));
			setFieldSources((prevSources) => ({
				...prevSources,
				[key]: "ai",
			}));
		},
		[suggestedValues],
	);

	const fieldKeys = useMemo(() => {
		const keys = new Set<string>();
		const visit = (inputTag: InputTagType) => {
			const fieldKey = inputTag.attributes.primary;
			if (fieldKey) {
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

	const applySuggestionHandlers = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const fieldKey of fieldKeys) {
			handlers[fieldKey] = () => {
				handleApplySuggestion(fieldKey);
			};
		}
		return handlers;
	}, [fieldKeys, handleApplySuggestion]);

	const resetCalcHandlers = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const calcKey of calcKeys) {
			handlers[calcKey] = () => {
				resetCalc(calcKey);
			};
		}
		return handlers;
	}, [calcKeys, resetCalc]);

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

				let nextSuggestions = { ...stateRef.current.suggestedValues };
				const returnedFields = new Set(Object.keys(fieldValues));
				const omittedCalcFields = fillInputFields
					.filter((field) => field.calculation && !returnedFields.has(field.label))
					.map((field) => field.label);
				for (const calcField of omittedCalcFields) {
					nextSuggestions = withoutRecordKey(nextSuggestions, calcField);
				}

				for (const [field, value] of Object.entries(fieldValues)) {
					const normalizedValue = normalizeFillInputsValue(value, fillInputMeta.get(field));
					if (normalizedValue === undefined || isEmptyValue(normalizedValue)) {
						nextSuggestions = withoutRecordKey(nextSuggestions, field);
						continue;
					}
					nextSuggestions[field] = {
						source: "ai",
						value: normalizedValue,
					};
				}

				setSuggestedValues(nextSuggestions);
				applySuggestions(nextSuggestions, omittedCalcFields);
				onSuggestedValuesChange?.(nextSuggestions);

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
		[applySuggestions, fillInputFields, fillInputMeta, onFillInputs, onSuggestedValuesChange],
	);

	if (inputTags.length === 0 || !inputTags) {
		return null;
	}

	const shouldShowFillInputs = Boolean(showFillInputs && onFillInputs && renderFillControls);
	const renderContext: RenderContext = {
		activeInputName,
		applySuggestionHandlers,
		changeHandlers,
		fieldRefs,
		fieldSources,
		isFocusSelectionSuppressed,
		onInputBlur,
		onInputSelect,
		resetCalcHandlers,
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
				{inputTags.map((inputTag) => renderInputTag(inputTag, renderContext))}
			</div>
			{/* Fixed autofill footer */}
			{shouldShowFillInputs && renderFillControls
				? renderFillControls({ onSubmit: handleFillInputs })
				: null}
		</form>
	);
}
