"use client";

import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import type { KeyboardEvent } from "react";
import type {
	InputContextTextContext,
	InputContextTextContextKey,
} from "../../types";

interface TextInputField {
	description: string;
	key: InputContextTextContextKey;
	label: string;
	placeholder: string;
}

interface TextInputProps {
	characterCountClassName?: string;
	className?: string;
	descriptionClassName?: string;
	disabled?: boolean;
	fieldClassName?: string;
	fields?: TextInputField[];
	labelClassName?: string;
	maxCharacters?: number;
	onMaxCharactersExceeded?: (maxCharacters: number) => void;
	onSubmitShortcut?: () => void;
	onValueChange: (value: InputContextTextContext) => void;
	showCharacterCount?: boolean;
	stretchFields?: boolean;
	textareaClassName?: string;
	value: InputContextTextContext;
}

const TEXT_CONTEXT_FIELDS: TextInputField[] = [
	{
		description: "Diagnosen, Vorerkrankungen und relevante Vorbefunde.",
		key: "diagnoseblock",
		label: "Diagnoseblock",
		placeholder: "Diagnoseblock eingeben...",
	},
	{
		description: "Aufnahmegrund, Vorgeschichte und relevante Anamnese.",
		key: "anamnese",
		label: "Anamnese",
		placeholder: "Anamnese eingeben...",
	},
	{
		description: "Labor, Bildgebung, Untersuchungen und Verlauf.",
		key: "befunde",
		label: "Befunde",
		placeholder: "Befunde eingeben...",
	},
	{
		description: "Epikrise, Verlauf, Therapie oder sonstige Hinweise.",
		key: "notes",
		label: "Epikrise / Notizen",
		placeholder: "Epikrise oder weitere Notizen eingeben...",
	},
];

const hasTextValue = (value: string | undefined): boolean =>
	Boolean(value?.trim());

export const getTextContextFieldCount = (
	textContext: InputContextTextContext,
	fields: TextInputField[] = TEXT_CONTEXT_FIELDS,
): number => fields.filter((field) => hasTextValue(textContext[field.key])).length;

export const getTextContextCharacterCount = (
	textContext: InputContextTextContext,
	fields: TextInputField[] = TEXT_CONTEXT_FIELDS,
): number => {
	let total = 0;
	for (const field of fields) {
		total += textContext[field.key]?.length ?? 0;
	}
	return total;
};

export const toSubmittedTextContext = (
	textContext: InputContextTextContext,
	fields: TextInputField[] = TEXT_CONTEXT_FIELDS,
): InputContextTextContext => {
	const submittedTextContext: InputContextTextContext = {};

	for (const field of fields) {
		const value = textContext[field.key]?.trim();
		if (value) {
			submittedTextContext[field.key] = value;
		}
	}

	return submittedTextContext;
};

export const TextInput = ({
	characterCountClassName,
	className,
	descriptionClassName,
	disabled = false,
	fieldClassName,
	fields = TEXT_CONTEXT_FIELDS,
	labelClassName,
	maxCharacters,
	onMaxCharactersExceeded,
	onSubmitShortcut,
	onValueChange,
	showCharacterCount = true,
	stretchFields = false,
	textareaClassName,
	value,
}: TextInputProps) => {
	const characterCount = getTextContextCharacterCount(value, fields);
	const handleSubmitShortcutKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (
			!onSubmitShortcut ||
			!(event.metaKey || event.ctrlKey) ||
			event.key !== "Enter"
		) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		onSubmitShortcut();
	};

	return (
		<div
			className={cn(
				"grid min-h-0 gap-4 md:grid-cols-2",
				stretchFields && "flex-1 auto-rows-fr",
				className,
			)}
		>
			{fields.map((field) => (
				<label
					className={cn(
						"min-w-0 space-y-1.5",
						stretchFields && "flex min-h-0 flex-col",
						fieldClassName,
					)}
					key={field.key}
				>
					<span className={cn("font-medium text-foreground text-xs", labelClassName)}>
						{field.label}
					</span>
					<Textarea
						className={cn(
							"resize-y bg-background text-xs placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20",
							stretchFields
								? "min-h-0 flex-1 resize-none"
								: "min-h-24 sm:min-h-32",
							textareaClassName,
						)}
						disabled={disabled}
						onChange={(event) => {
							const nextValue = {
								...value,
								[field.key]: event.target.value,
							};
							if (
								maxCharacters !== undefined &&
								getTextContextCharacterCount(nextValue, fields) > maxCharacters
							) {
								onMaxCharactersExceeded?.(maxCharacters);
								return;
							}
							onValueChange(nextValue);
						}}
						onKeyDown={handleSubmitShortcutKeyDown}
						placeholder={field.placeholder}
						value={value[field.key] ?? ""}
					/>
					<span
						className={cn(
							"block text-muted-foreground text-[11px]",
							descriptionClassName,
						)}
					>
						{field.description}
					</span>
				</label>
			))}
			{showCharacterCount && maxCharacters !== undefined ? (
				<div
					className={cn(
						"text-muted-foreground text-[11px] md:col-span-2",
						characterCountClassName,
					)}
				>
					{characterCount.toLocaleString("de-DE")} /{" "}
					{maxCharacters.toLocaleString("de-DE")} Zeichen
				</div>
			) : null}
		</div>
	);
};
