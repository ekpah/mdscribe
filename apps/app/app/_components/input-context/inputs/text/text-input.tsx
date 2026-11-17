"use client";

import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";

import type { InputContextTextContext, InputContextTextContextKey } from "../../types";

interface TextInputField {
	description: string;
	key: InputContextTextContextKey;
	label: string;
	placeholder: string;
	textareaClassName?: string;
}

interface TextInputProps {
	disabled?: boolean;
	/** Fields to show; a field that holds text always shows, so no input is sent unseen. */
	keys?: InputContextTextContextKey[];
	maxCharacters?: number;
	onMaxCharactersExceeded?: (maxCharacters: number) => void;
	onValueChange: (value: InputContextTextContext) => void;
	/** Hintergrundinformationen grows into the height the panel has left. */
	stretch?: boolean;
	value: InputContextTextContext;
}

// Hintergrundinformationen on top, then the notes on the current presentation;
// each reaches the model as its own tag.
const TEXT_CONTEXT_FIELDS: TextInputField[] = [
	{
		description:
			"Alles von vor der aktuellen Vorstellung: Vorbriefe, Vordiagnosen, Vorbefunde, Dauermedikation. Die KI nutzt das als Faktenquelle, schreibt es aber nicht ab.",
		key: "background",
		label: "Hintergrundinformationen",
		placeholder: "z. B. Vorbrief, Vordiagnosen oder Vorbefunde einfügen …",
		// Set apart from the notes: dashed, tinted and muted.
		textareaClassName:
			"border-dashed border-solarized-base1 bg-solarized-base2/70 text-muted-foreground shadow-none focus-visible:border-solarized-blue focus-visible:ring-0",
	},
	{
		description: "Die aktuelle Vorstellung: Anamnese, Befunde, Verlauf, Diagnosen.",
		key: "notes",
		label: "Notizen",
		placeholder: "Notizen zur aktuellen Vorstellung eingeben …",
	},
];

const hasTextValue = (value: string | undefined): boolean => Boolean(value?.trim());

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
): InputContextTextContext =>
	Object.fromEntries(
		TEXT_CONTEXT_FIELDS.flatMap(({ key }) => {
			const text = textContext[key]?.trim();
			return text ? [[key, text]] : [];
		}),
	);

export const TextInput = ({
	disabled = false,
	keys,
	maxCharacters,
	onMaxCharactersExceeded,
	onValueChange,
	stretch = false,
	value,
}: TextInputProps) => {
	const fields = TEXT_CONTEXT_FIELDS.filter(
		(field) => !keys || keys.includes(field.key) || hasTextValue(value[field.key]),
	);
	const characterCount = getTextContextCharacterCount(value, fields);
	const handleFieldChange = (key: InputContextTextContextKey, text: string) => {
		const nextValue = { ...value, [key]: text };
		if (
			maxCharacters !== undefined &&
			getTextContextCharacterCount(nextValue, fields) > maxCharacters
		) {
			onMaxCharactersExceeded?.(maxCharacters);
			return;
		}
		onValueChange(nextValue);
	};

	const renderField = (field: TextInputField) => {
		// Everything from before the presentation can be long: it takes the height there is.
		const grows = stretch && field.key === "background";
		return (
			<label
				className={cn("flex min-w-0 flex-col gap-1.5", grows && "min-h-0 flex-1")}
				key={field.key}
			>
				<span className="font-medium text-foreground text-xs">{field.label}</span>
				<Textarea
					className={cn(
						"resize-y bg-background text-xs placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20",
						grows ? "min-h-32 flex-1" : "min-h-24 sm:min-h-32",
						field.textareaClassName,
					)}
					disabled={disabled}
					onChange={(event) => {
						handleFieldChange(field.key, event.target.value);
					}}
					placeholder={field.placeholder}
					value={value[field.key] ?? ""}
				/>
				<span className="block text-muted-foreground text-[11px]">{field.description}</span>
			</label>
		);
	};

	return (
		// The fields keep their height; a panel shorter than them scrolls.
		<div className={cn("flex flex-col gap-4", stretch ? "min-h-0 flex-1" : "shrink-0")}>
			<div className={cn("gap-4", stretch ? "flex min-h-0 flex-1 flex-col" : "grid")}>
				{fields.map(renderField)}
			</div>
			{maxCharacters === undefined ? null : (
				<div className="text-muted-foreground text-[11px]">
					{characterCount.toLocaleString("de-DE")} / {maxCharacters.toLocaleString("de-DE")} Zeichen
				</div>
			)}
		</div>
	);
};
