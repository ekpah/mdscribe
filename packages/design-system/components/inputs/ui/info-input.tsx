"use client";

import type { DateValue } from "@internationalized/date";
import { Calendar } from "@repo/design-system/components/ui/calendar-rac";
import { DateInput } from "@repo/design-system/components/ui/datefield-rac";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import type { InfoInputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { CalendarIcon } from "lucide-react";
import type React from "react";
import { useCallback, useMemo } from "react";
import { Button, DatePicker, Dialog, Group, Popover } from "react-aria-components";
import { withMask } from "use-mask-input";

import { formatDateGerman, getTodayDate, parseDateInput } from "./date-utils";
import { SuggestionBadge } from "./suggestion-badge";

type InfoValue = string | number | DateValue | undefined;

const hasFilledValue = (value: unknown): boolean =>
	value !== undefined && value !== null && value !== "";

const DescriptionTooltip = ({ description }: { description?: string }) => {
	if (!description) {
		return null;
	}

	return (
		<Tooltip delay={300}>
			<TooltipTrigger
				render={
					<button
						type="button"
						className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent text-muted-foreground leading-none hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solarized-orange/50"
						aria-label="Mehr Informationen"
					>
						<span className="font-bold text-sm" aria-hidden="true">
							?
						</span>
						<span className="sr-only">Info</span>
					</button>
				}
			/>
			<TooltipContent className="max-w-70 text-xs" side="top">
				{description}
			</TooltipContent>
		</Tooltip>
	);
};

const InfoInput = ({
	input,
	value,
	onChange,
	suggestedValue,
	suggestionLabel = "Vorschlag",
	onAcceptSuggestedValue,
	inputClassName,
}: {
	input: InfoInputTagType;
	value: InfoValue;
	onChange: (localValue: string | number) => void;
	suggestedValue?: string | number;
	suggestionLabel?: string;
	onAcceptSuggestedValue?: () => void;
	inputClassName?: string;
}) => {
	const isDateType = input.attributes.type === "date";
	const isNumberType = input.attributes.type === "number";

	// Parse date value, defaulting to today only if no value provided
	const dateValue = useMemo(() => {
		if (!isDateType) {
			return getTodayDate();
		}
		const parsed = parseDateInput(value);
		return parsed ?? getTodayDate();
	}, [isDateType, value]);

	// Parse suggested date value for display
	const formattedSuggestedValue = useMemo(() => {
		if (!isDateType || suggestedValue === undefined) {
			return suggestedValue;
		}
		const parsed = parseDateInput(suggestedValue);
		return parsed ? formatDateGerman(parsed) : suggestedValue;
	}, [isDateType, suggestedValue]);

	// Determine if we have values for suggestion logic
	const hasValue = hasFilledValue(value);
	const hasSuggestion = hasFilledValue(suggestedValue);
	const isSuggestionApplied = hasSuggestion && hasValue && value === suggestedValue;
	const shouldShowSuggestion = hasSuggestion && !isSuggestionApplied;

	// Handle date changes
	const handleDateChange = useCallback(
		(newDateValue: DateValue | null) => {
			if (newDateValue) {
				onChange(formatDateGerman(newDateValue));
			}
		},
		[onChange],
	);

	// Handle number changes
	const handleNumberChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const numValue = Number(e.target.value);
			onChange(Number.isNaN(numValue) ? 0 : numValue);
		},
		[onChange],
	);

	// Handle text changes
	const handleTextChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			onChange(e.target.value);
		},
		[onChange],
	);

	// Render suggestion badge if needed
	const suggestionBadge = shouldShowSuggestion ? (
		<SuggestionBadge
			hasExistingValue={hasValue}
			label={suggestionLabel}
			onAccept={onAcceptSuggestedValue}
			unit={isDateType ? undefined : input.attributes.unit}
			value={formattedSuggestedValue ?? suggestedValue ?? ""}
		/>
	) : null;

	const descriptionTooltip = <DescriptionTooltip description={input.attributes.description} />;

	// Date input
	if (isDateType) {
		return (
			<div className="w-full max-w-full *:not-first:mt-2" key={`info-${input.attributes.primary}`}>
				<DatePicker
					aria-label={`${input.attributes.primary} calendar`}
					className="*:not-first:mt-2"
					onChange={handleDateChange}
					value={dateValue}
				>
					<div className="flex items-center gap-1.5">
						<Label className="font-medium text-foreground text-sm">
							{input.attributes.primary}
						</Label>
						{descriptionTooltip}
					</div>
					<div className="flex">
						<Group className="w-full">
							<DateInput className={cn("pe-9", inputClassName)} />
						</Group>
						<Button
							aria-label="Open calendar"
							className="-ms-9 -me-px z-10 flex w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground data-focus-visible:border-ring data-focus-visible:ring-[3px] data-focus-visible:ring-ring/50"
						>
							<CalendarIcon size={16} />
						</Button>
					</div>
					<Popover
						className="data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 rounded-lg border bg-background text-popover-foreground shadow-lg outline-hidden data-entering:animate-in data-exiting:animate-out"
						offset={4}
					>
						<Dialog className="max-h-[inherit] overflow-auto p-2">
							<Calendar />
						</Dialog>
					</Popover>
				</DatePicker>
				{suggestionBadge}
			</div>
		);
	}

	// Number input
	if (isNumberType) {
		const displayValue = (value as number | undefined) ?? "";

		return (
			<div className="w-full max-w-full *:not-first:mt-2" key={`info-${input.attributes.primary}`}>
				<div className="flex items-center gap-1.5">
					<Label htmlFor={input.attributes.primary}>{input.attributes.primary}</Label>
					{descriptionTooltip}
				</div>
				<div className="flex w-full max-w-full rounded-md shadow-xs">
					<Input
						className={cn(
							"-me-px min-w-0 flex-1 shadow-none focus-visible:z-10",
							input.attributes.unit && "rounded-e-none",
							inputClassName,
						)}
						id={input.attributes.primary}
						name={input.attributes.primary}
						onChange={handleNumberChange}
						placeholder={`Enter ${input.attributes.primary}`}
						ref={withMask("999999", {
							placeholder: "",
							showMaskOnHover: false,
						})}
						type="text"
						value={displayValue}
					/>
					{input.attributes.unit && (
						<span className="inline-flex items-center rounded-e-md border border-input bg-background px-3 font-medium text-foreground text-sm outline-none transition-[color,box-shadow] focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
							{input.attributes.unit}
						</span>
					)}
				</div>
				{suggestionBadge}
			</div>
		);
	}

	// Text input (default)
	const displayValue = (value as string) ?? "";

	return (
		<div className="w-full max-w-full *:not-first:mt-2" key={`info-${input.attributes.primary}`}>
			<div className="flex items-center gap-1.5">
				<Label htmlFor={input.attributes.primary}>{input.attributes.primary}</Label>
				{descriptionTooltip}
			</div>
			<div className="flex w-full max-w-full rounded-md shadow-xs">
				<Input
					className={cn(
						"-me-px min-w-0 flex-1 shadow-none focus-visible:z-10",
						input.attributes.unit && "rounded-e-none",
						inputClassName,
					)}
					id={input.attributes.primary}
					name={input.attributes.primary}
					onChange={handleTextChange}
					placeholder={`Enter ${input.attributes.primary}`}
					type="text"
					value={displayValue}
				/>
				{input.attributes.unit && (
					<span className="inline-flex items-center rounded-e-md border border-input bg-background px-3 font-medium text-foreground text-sm outline-none transition-[color,box-shadow] focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
						{input.attributes.unit}
					</span>
				)}
			</div>
			{suggestionBadge}
		</div>
	);
};

export default InfoInput;
