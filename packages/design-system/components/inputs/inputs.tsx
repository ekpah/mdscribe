"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import {
	toFormulaValue,
	toVoiceBooleanValue as toFillInputsBooleanValue,
} from "@repo/markdoc-md/parse/boolean-coercion";
import type {
	InfoInputTagType,
	InputTagType,
} from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import Formula from "fparser";
import { Bot, Pencil, Sigma } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	inputTags: InputTagType[];
	onChange: (data: Record<string, unknown>) => void;
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
	options?: string[];
	type: "string" | "number" | "date" | "switch" | "boolean";
}

type InputSource = "ai" | "manual";

const collectFillInputFields = (inputTags: InputTagType[]) => {
	const fields: FillInputsInputField[] = [];
	const meta = new Map<string, InputMeta>();
	const seen = new Set<string>();

	const pushField = (
		label: string | undefined,
		description: string | undefined,
		type: InputMeta["type"],
		options?: string[],
		unit?: string,
	) => {
		if (!label || seen.has(label)) {
			return;
		}
		fields.push({ description, label, options, type, unit });
		meta.set(label, { options, type });
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
				?.filter((child) => child.name === "Case" && child.attributes.primary)
				.map((child) => child.attributes.primary);
			const switchType =
				input.attributes.type === "boolean" || input.attributes.type === "checkbox"
					? "boolean"
					: "switch";
			pushField(input.attributes.primary, undefined, switchType, options);
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

		if (input.name === "Score") {
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

const toSwitchCaseKey = (value: unknown): string | undefined => {
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
				<TooltipTrigger render={<span className={cn("inline-flex cursor-help", config.className)}>
						<Icon className="h-3.5 w-3.5" />
					</span>} />
				<TooltipContent side="top" className="text-xs">
					{config.label}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

interface RenderContext {
	values: Record<string, unknown>;
	suggestedValues: Record<string, SuggestedValue>;
	fieldSources: Record<string, InputSource>;
	changeHandlers: Record<string, (value: unknown) => void>;
	applySuggestionHandlers: Record<string, () => void>;
}

const renderInputTag = (input: InputTagType, context: RenderContext): React.ReactNode | null => {
	if (!input.attributes.primary) {
		return null;
	}

	const fieldKey = input.attributes.primary;
	const suggestedValue = context.suggestedValues[fieldKey];
	const inputState = context.fieldSources[fieldKey];
	const inputStateClassName = getInputStateClassName(inputState);
	const handleFieldChange = context.changeHandlers[fieldKey];
	const handleApplySuggestion = context.applySuggestionHandlers[fieldKey];

	if (input.name === "Info") {
		return (
			<div className="relative" key={`info-${fieldKey}`}>
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
		const currentValue = context.values[fieldKey] as string | boolean | undefined;
		const currentCaseKey = toSwitchCaseKey(currentValue);

		return (
			<div className="relative" key={`switch-${fieldKey}`}>
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
				{currentCaseKey && input.children && (
					<div className="mt-4 ml-4 space-y-4">
						{input.children
							.filter(
								(child) => child.name === "Case" && child.attributes.primary === currentCaseKey,
							)
							.flatMap((caseChild) =>
								caseChild.children.map((grandChild) => renderInputTag(grandChild, context)),
							)}
					</div>
				)}
			</div>
		);
	}

	if (input.name === "Score") {
		const score = () => {
			try {
				const f = new Formula(input.attributes.formula ?? "");
				const formulaValues = Object.fromEntries(
					Object.entries(context.values).map(([key, value]) => [key, toFormulaValue(value)]),
				);
				const result = f.evaluate(formulaValues as Record<string, number>);
				const roundedResult = typeof result === "number" ? Number(result.toFixed(2)) : result;
				return roundedResult;
			} catch {
				return 0;
			}
		};

		return (
			<div
				className="justify-center-center w-full max-w-full space-y-3"
				key={`score-${input.attributes.primary}`}
			>
				<Label
					className="font-medium text-foreground"
					htmlFor={`score-${input.attributes.primary}`}
				>
					{input.attributes.primary}
				</Label>
				<TooltipProvider delay={0}>
					<Tooltip>
						<TooltipTrigger render={<Badge className="ml-2 bg-muted-foreground">
								<Sigma aria-hidden="true" className="opacity-60" size={12} />
							</Badge>} />
						<TooltipContent className="overflow-hidden px-2 py-1 text-sm">
							<div className="space-y-1">
								<p className="font-medium text-[13px]">Formel</p>
								<p className="text-wrap font-mono text-muted-foreground text-xs">
									{input.attributes.formula ? (
										<span className=" text-muted-foreground">
											{input.attributes.formula
												?.replaceAll(
													/(\[[\w_]+\])|([^a-zA-Z[\]])/g,
													(_match, p1, p2) => p1 || ` ${p2} `,
												)
												.replaceAll(/\s+/g, " ")
												.trim()}
										</span>
									) : (
										<span className="text-muted-foreground">Keine Formel</span>
									)}
								</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Read-only calculated score display */}
				<div className="w-full max-w-full space-y-1">
					<Input
						className="h-9 w-full max-w-full cursor-default border-input bg-muted font-medium text-foreground focus:border-solarized-orange focus:ring-solarized-orange/20"
						id={`score-${input.attributes.primary}`}
						readOnly
						value={`${score()}${input.attributes.unit ? ` ${input.attributes.unit}` : ""}`}
					/>
				</div>
				{/* Variable inputs (indented) */}
				{input.children.length > 0 && (
					<div className="ml-4 w-full max-w-full space-y-3 border-muted border-l-2 pr-4 pl-4">
						{input.children.map((child) => (
							<div className="w-full max-w-full space-y-1" key={child.attributes.primary}>
								{(() => {
									const childKey = child.attributes.primary;
									const childSuggestion = context.suggestedValues[childKey];
									const childInputState = context.fieldSources[childKey];
									const childInputStateClassName = getInputStateClassName(childInputState);
									const childApplySuggestionHandler = context.applySuggestionHandlers[childKey];
									const childChangeHandler = context.changeHandlers[childKey];

									return (
										<div className="relative">
											{childInputState && (
												<div className="absolute -top-1 right-0 z-10">
													<SourceIndicator source={childInputState} />
												</div>
											)}
											<LazyInfoInput
												input={
													{
														attributes: {
															primary: childKey,
															type: "number",
														},
													} as InfoInputTagType
												}
												inputClassName={childInputStateClassName}
												onAcceptSuggestedValue={
													childSuggestion ? childApplySuggestionHandler : undefined
												}
												onChange={childChangeHandler}
												suggestedValue={toTextOrNumberSuggestion(childSuggestion?.value)}
												suggestionLabel={getSuggestionLabel(childSuggestion)}
												value={context.values[childKey] as number | undefined}
											/>
										</div>
									);
								})()}
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	return null;
};

export default function Inputs({
	inputTags = [],
	onChange,
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

	useEffect(() => {
		onChange(values);
	}, [values, onChange]);

	useEffect(() => {
		stateRef.current = { fieldSources, suggestedValues, values };
	}, [values, fieldSources, suggestedValues]);

	const applySuggestions = useCallback((nextSuggestions: Record<string, SuggestedValue>) => {
		const { values: currentValues, fieldSources: currentSources } = stateRef.current;
		const nextValues = { ...currentValues };
		const nextSources = { ...currentSources };

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
	}, []);

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
		[suggestedValues],
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
				applySuggestions(nextSuggestions);
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
		applySuggestionHandlers,
		changeHandlers,
		fieldSources,
		suggestedValues,
		values,
	};

	return (
		<form className="flex h-full w-full flex-col overflow-hidden">
			{/* Scrollable inputs area */}
			<div className="flex-1 space-y-6 overflow-y-auto overscroll-none p-4 pr-4" key="inputs-list">
				{inputTags.map((inputTag) => renderInputTag(inputTag, renderContext))}
			</div>
			{/* Fixed autofill footer */}
			{shouldShowFillInputs && renderFillControls
				? renderFillControls({ onSubmit: handleFillInputs })
				: null}
		</form>
	);
}
