"use client";
import {
	DateFormatter,
	type DateValue,
	getLocalTimeZone,
	parseDate,
} from "@internationalized/date";
import type { InfoInputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import type React from "react";
import { useEffect, useState } from "react";

import {
	Button,
	DatePicker,
	Dialog,
	Group,
	Popover,
} from "react-aria-components";
import { Bot, CalendarIcon } from "lucide-react";
import { withMask } from "use-mask-input";
import { Calendar } from "../../ui/calendar-rac";
import { DateInput } from "../../ui/datefield-rac";
import { Button as DsButton } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { PopoverContent, PopoverTrigger } from "../../ui/popover";
import { cn } from "../../lib/utils";

type InfoValue = string | number | DateValue | undefined;

const parseDateValue = (dateInput: InfoValue) => {
	if (!dateInput) return null;
	if (typeof dateInput !== "string") {
		return typeof dateInput === "object" ? (dateInput as DateValue) : null;
	}
	const trimmed = dateInput.trim();
	if (!trimmed) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return parseDate(trimmed);
	}
	const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
	if (!match) return null;
	const [, day, month, year] = match;
	return parseDate(
		`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
	);
};

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
	// Always call all hooks at the top level
	const [dateValue, setDateValue] = useState(
		parseDate(new Date().toISOString().split("T")[0]),
	);

	// Ensure we always have a defined value to prevent controlled/uncontrolled input issues
	const defaultValue =
		input.attributes.type === "number" ? (value ?? 0) : (value ?? "");
	const [localValue, setLocalValue] = useState(defaultValue);

	// Update local state when prop value changes
	useEffect(() => {
		setLocalValue(defaultValue);
	}, [defaultValue]);

	useEffect(() => {
		if (input.attributes.type !== "date") return;
		const parsedValue = parseDateValue(value);
		if (parsedValue) {
			setDateValue(parsedValue);
		}
	}, [input.attributes.type, value]);

	const hasValue = value !== undefined && value !== null && value !== "";
	const hasSuggestion =
		suggestedValue !== undefined &&
		suggestedValue !== null &&
		suggestedValue !== "";
	const isSuggestionApplied = hasSuggestion && hasValue && value === suggestedValue;
	const shouldShowSuggestion = hasSuggestion && !isSuggestionApplied;
	const suggestionText = input.attributes.unit
		? `${suggestedValue} ${input.attributes.unit}`
		: `${suggestedValue}`;

	const suggestionRow = shouldShowSuggestion ? (
		<div className="flex items-center justify-between gap-2 rounded-md border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-1 text-xs text-solarized-orange">
			<div className="flex min-w-0 items-center gap-2">
				<Bot aria-hidden="true" className="h-3.5 w-3.5" />
				<span className="font-medium">{suggestionLabel}</span>
				<span className="truncate text-solarized-orange/90">
					{suggestionText}
				</span>
			</div>
			{onAcceptSuggestedValue && (
				<DsButton
					className="h-6 px-2 text-xs"
					onClick={onAcceptSuggestedValue}
					size="sm"
					type="button"
					variant="ghost"
				>
					{hasValue ? "Ersetzen" : "Uebernehmen"}
				</DsButton>
			)}
		</div>
	) : null;

	const dateFormatter = new DateFormatter("de-DE", {
		dateStyle: "short",
	});

	// Handle date input type
	if (input.attributes.type === "date") {
		return (
			<div
				className="w-full max-w-full *:not-first:mt-2"
				key={`info-${input.attributes.primary}`}
			>
				<DatePicker
					aria-label={`${input.attributes.primary} calendar`}
					className="*:not-first:mt-2"
					onChange={(newDateValue) => {
						if (newDateValue) {
							setDateValue(newDateValue);
							onChange(
								dateFormatter.format(newDateValue.toDate(getLocalTimeZone())),
							);
						}
					}}
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
				{suggestionRow}
			</div>
		);
	}
	// Handle text/number inputs
	const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setLocalValue(
			Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value),
		);
		onChange(Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value));
	};
	// Handle number input type
	if (input.attributes.type === "number") {
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
						value={localValue as number}
					/>
					{input.attributes.unit && (
						<span className="inline-flex items-center rounded-e-md border border-input bg-background px-3 font-medium text-foreground text-sm outline-none transition-[color,box-shadow] focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
							{input.attributes.unit}
						</span>
					)}
				</div>
				{suggestionRow}
			</div>
		);
	}

	// Handle text/number inputs
	const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setLocalValue(e.target.value);
		onChange(e.target.value);
	};
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
					value={localValue as string}
				/>
				{input.attributes.unit && (
					<span className="inline-flex items-center rounded-e-md border border-input bg-background px-3 font-medium text-foreground text-sm outline-none transition-[color,box-shadow] focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
						{input.attributes.unit}
					</span>
				)}
			</div>
			{suggestionRow}
			{input.attributes.description && (
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="ms-2 h-7 w-7 px-0 py-0 align-middle rounded-md border border-input bg-background text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solarized-orange/60 flex items-center justify-center"
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
							<p className="text-xs text-muted-foreground">
								{input.attributes.description}
							</p>
						</div>
					</PopoverContent>
				</Popover>
			)}
		</div>
	);
}
