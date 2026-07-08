"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@repo/design-system/components/ui/toggle-group";
import { cn } from "@repo/design-system/lib/utils";
import { toBooleanValue } from "@repo/markdoc-md/parse/boolean-coercion";
import type { SwitchInputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { useCallback } from "react";

import { SuggestionBadge } from "./suggestion-badge";

const isBooleanSwitchInput = (
	input: SwitchInputTagType,
	options: { attributes: { primary: string } }[] | undefined,
): boolean => {
	if (input.attributes.type === "boolean" || input.attributes.type === "checkbox") {
		return true;
	}

	if (!options || options.length !== 2) {
		return false;
	}

	const normalizedOptions = new Set(
		options.map((option) => option.attributes.primary.trim().toLowerCase()),
	);
	return normalizedOptions.has("true") && normalizedOptions.has("false");
};

const toCurrentStringValue = (
	value: string | boolean | undefined,
	currentBooleanValue: boolean | undefined,
): string => {
	if (typeof value === "string") {
		return value;
	}

	if (currentBooleanValue === undefined) {
		return "";
	}

	return String(currentBooleanValue);
};

const toSuggestionString = (
	suggestedValue: string | number | boolean | undefined,
): string | undefined => {
	if (typeof suggestedValue === "number" || typeof suggestedValue === "boolean") {
		return String(suggestedValue);
	}

	return suggestedValue;
};

const getSwitchSuggestionState = ({
	currentBooleanValue,
	currentStringValue,
	isBooleanSwitch,
	normalizedSuggestionBoolean,
	normalizedSuggestionString,
}: {
	currentBooleanValue: boolean | undefined;
	currentStringValue: string;
	isBooleanSwitch: boolean;
	normalizedSuggestionBoolean: boolean | undefined;
	normalizedSuggestionString: string | undefined;
}) => {
	if (isBooleanSwitch) {
		const hasValue = currentBooleanValue !== undefined;
		const hasSuggestion = normalizedSuggestionBoolean !== undefined;
		return {
			hasValue,
			shouldShowSuggestion: hasSuggestion && currentBooleanValue !== normalizedSuggestionBoolean,
		};
	}

	const hasValue = currentStringValue !== "";
	const hasSuggestion = Boolean(normalizedSuggestionString && normalizedSuggestionString !== "");
	return {
		hasValue,
		shouldShowSuggestion: hasSuggestion && currentStringValue !== normalizedSuggestionString,
	};
};

export const SwitchInput = ({
	input,
	value,
	onChange,
	suggestedValue,
	suggestionLabel = "Vorschlag",
	onAcceptSuggestedValue,
	inputClassName,
}: {
	input: SwitchInputTagType;
	value: string | boolean | undefined;
	onChange: (newValue: string | boolean) => void;
	suggestedValue?: string | number | boolean;
	suggestionLabel?: string;
	onAcceptSuggestedValue?: () => void;
	inputClassName?: string;
}) => {
	const options = input.children?.filter(
		(caseTag) => caseTag.name === "Case" && caseTag.attributes.primary,
	);
	const useSelect = options && options.length > 3;
	const isBooleanSwitch = isBooleanSwitchInput(input, options);

	const currentBooleanValue = toBooleanValue(value);
	const currentStringValue = toCurrentStringValue(value, currentBooleanValue);

	const handleBooleanChange = useCallback(
		(checked: boolean) => {
			onChange(checked === true);
		},
		[onChange],
	);

	const handleStringChange = useCallback(
		(newValue: string | null) => {
			onChange(newValue ?? "");
		},
		[onChange],
	);

	const normalizedSuggestionBoolean = toBooleanValue(suggestedValue);
	const normalizedSuggestionString = toSuggestionString(suggestedValue);

	const { hasValue, shouldShowSuggestion } = getSwitchSuggestionState({
		currentBooleanValue,
		currentStringValue,
		isBooleanSwitch,
		normalizedSuggestionBoolean,
		normalizedSuggestionString,
	});

	if (isBooleanSwitch) {
		const checked = currentBooleanValue ?? false;
		return (
			<div className="w-full max-w-full space-y-2" key={`switch-${input.attributes.primary}`}>
				<Label
					htmlFor={input.attributes.primary}
					className={cn(
						"flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 transition-colors hover:bg-muted/40",
						inputClassName,
					)}
				>
					<Checkbox
						checked={checked}
						id={input.attributes.primary}
						name={input.attributes.primary}
						onCheckedChange={handleBooleanChange}
					/>
					<span className="font-medium text-foreground text-sm leading-none">
						{input.attributes.primary}
					</span>
				</Label>
				{shouldShowSuggestion && (
					<SuggestionBadge
						hasExistingValue={hasValue}
						label={suggestionLabel}
						onAccept={onAcceptSuggestedValue}
						value={normalizedSuggestionBoolean ? "Angehakt" : "Nicht angehakt"}
					/>
				)}
			</div>
		);
	}

	return (
		<div className="w-full max-w-full space-y-2" key={`switch-${input.attributes.primary}`}>
			<Label className="font-medium text-foreground" htmlFor={input.attributes.primary}>
				{input.attributes.primary}
			</Label>
			{useSelect ? (
				<Select
					name={input.attributes.primary}
					onValueChange={handleStringChange}
					value={currentStringValue}
				>
					<SelectTrigger
						className={cn(
							"h-9 w-full max-w-full border-input bg-background text-foreground transition-all focus:border-solarized-blue focus:ring-solarized-blue/20",
							inputClassName,
						)}
					>
						<SelectValue placeholder={`Select ${input.attributes.primary}`} />
					</SelectTrigger>
					<SelectContent className="border-input bg-background">
						{options?.map((caseTag) => (
							<SelectItem
								className="text-foreground hover:bg-solarized-blue/10 focus:bg-solarized-blue/10"
								key={caseTag.attributes.primary}
								value={caseTag.attributes.primary}
							>
								{caseTag.attributes.primary}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : (
				<ToggleGroup
					className={cn(
						"flex w-full max-w-full flex-row overflow-hidden rounded-md border border-input bg-background",
						inputClassName,
					)}
					onValueChange={(values) => handleStringChange(values[0] ?? "")}
					value={currentStringValue ? [currentStringValue] : []}
				>
					{options?.map((caseTag) => (
						<ToggleGroupItem
							className="h-9 min-w-0 flex-1 rounded-none bg-transparent text-foreground transition-colors hover:bg-muted hover:text-muted-foreground data-pressed:bg-accent data-pressed:text-accent-foreground"
							key={caseTag.attributes.primary}
							value={caseTag.attributes.primary}
						>
							{caseTag.attributes.primary}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			)}
			{shouldShowSuggestion && (
				<SuggestionBadge
					hasExistingValue={hasValue}
					label={suggestionLabel}
					onAccept={onAcceptSuggestedValue}
					value={normalizedSuggestionString ?? ""}
				/>
			)}
		</div>
	);
};
