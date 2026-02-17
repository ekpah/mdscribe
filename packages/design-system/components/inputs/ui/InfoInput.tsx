"use client";

import type { DateValue } from "@internationalized/date";
import type { InfoInputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import { CalendarIcon } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import {
	Button,
	DatePicker,
	Dialog,
	Group,
	Popover,
} from "react-aria-components";
import { withMask } from "use-mask-input";
import { cn } from "@repo/design-system/lib/utils";
import { Calendar } from "../../ui/calendar-rac";
import { DateInput } from "../../ui/datefield-rac";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
	Popover as DsPopover,
	PopoverContent,
	PopoverTrigger,
} from "../../ui/popover";
import { SuggestionBadge } from "./SuggestionBadge";
import {
	formatDateGerman,
	getTodayDate,
	parseDateInput,
} from "./date-utils";

type InfoValue = string | number | DateValue | undefined;

export function InfoInput({
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
}) {
	const isDateType = input.attributes.type === "date";
	const isNumberType = input.attributes.type === "number";

	// Parse date value, defaulting to today only if no value provided
	const dateValue = useMemo(() => {
		if (!isDateType) return getTodayDate();
		const parsed = parseDateInput(value);
		return parsed ?? getTodayDate();
	}, [isDateType, value]);

	// Parse suggested date value for display
	const formattedSuggestedValue = useMemo(() => {
		if (!isDateType || suggestedValue === undefined) return suggestedValue;
		const parsed = parseDateInput(suggestedValue);
		return parsed ? formatDateGerman(parsed) : suggestedValue;
	}, [isDateType, suggestedValue]);

	// Determine if we have values for suggestion logic
	const hasValue = value !== undefined && value !== null && value !== "";
	const hasSuggestion =
		suggestedValue !== undefined &&
		suggestedValue !== null &&
		suggestedValue !== "";
	const isSuggestionApplied =
		hasSuggestion && hasValue && value === suggestedValue;
	const shouldShowSuggestion = hasSuggestion && !isSuggestionApplied;

	// Handle date changes
	const handleDateChange = (newDateValue: DateValue | null) => {
		if (newDateValue) {
			onChange(formatDateGerman(newDateValue));
		}
	};

	// Handle number changes
	const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const numValue = Number(e.target.value);
		onChange(Number.isNaN(numValue) ? 0 : numValue);
	};

	// Handle text changes
	const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
	};

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

	// Date input
	if (isDateType) {
		return (
			<div
				className="w-full max-w-full *:not-first:mt-2"
				key={`info-${input.attributes.primary}`}
			>
				<DatePicker
					aria-label={`${input.attributes.primary} calendar`}
					className="*:not-first:mt-2"
					onChange={handleDateChange}
					value={dateValue}
				>
					<Label className="font-medium text-foreground text-sm">
						{input.attributes.primary}
					</Label>
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
			<div
				className="w-full max-w-full *:not-first:mt-2"
				key={`info-${input.attributes.primary}`}
			>
				<Label htmlFor={input.attributes.primary}>
					{input.attributes.primary}
				</Label>
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
		<div
			className="w-full max-w-full *:not-first:mt-2"
			key={`info-${input.attributes.primary}`}
		>
			<Label htmlFor={input.attributes.primary}>
				{input.attributes.primary}
			</Label>
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
			{input.attributes.description && (
				<DsPopover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="ms-2 flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background px-0 py-0 align-middle text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solarized-orange/60"
							aria-label="Mehr Informationen"
						>
							<span
								className="font-bold text-base leading-none"
								aria-hidden="true"
							>
								?
							</span>
							<span className="sr-only">Info</span>
						</button>
					</PopoverTrigger>
					<PopoverContent className="max-w-[280px] py-3 shadow-none" side="top">
						<div className="space-y-1">
							<p className="text-muted-foreground text-xs">
								{input.attributes.description}
							</p>
						</div>
					</PopoverContent>
				</DsPopover>
			)}
		</div>
	);
}
