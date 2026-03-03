"use client";

import type {
	InputTagType,
} from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { InfoInput } from "@repo/design-system/components/inputs/ui/info-input";
import { SwitchInput } from "@repo/design-system/components/inputs/ui/switch-input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { Bot, Pencil } from "lucide-react";
import { useCallback, useMemo } from "react";

export type InputSource = "empty" | "ai" | "manual";

interface PDFInputsProps {
	inputTags: InputTagType[];
	fieldSources: Record<string, InputSource>;
	initialValues?: Record<string, unknown>;
	onChange: (data: Record<string, unknown>) => void;
	onFieldEdit: (fieldName: string) => void;
}

/**
 * Status indicator component for input fields - shows as small icon with tooltip
 */
const SourceIndicator = ({ source }: { source: InputSource | undefined }) => {
	if (!source || source === "empty") {
		return null;
	}

	const config = {
		ai: {
			className: "text-solarized-orange",
			icon: Bot,
			label: "KI-Vorschlag",
		},
		manual: {
			className: "text-solarized-green",
			icon: Pencil,
			label: "Manuell bearbeitet",
		},
	}[source];

	if (!config) {return null;}

	const Icon = config.icon;

	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className={cn("inline-flex cursor-help", config.className)}>
						<Icon className="h-3.5 w-3.5" />
					</span>
				</TooltipTrigger>
				<TooltipContent side="top" className="text-xs">
					{config.label}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

const renderInputTag = (
	input: InputTagType,
	values: Record<string, unknown>,
	fieldSources: Record<string, InputSource>,
	fieldChangeHandlers: Record<string, (value: unknown) => void>,
): React.ReactNode | null => {
	if (!input.attributes.primary) {
		return null;
	}

	const fieldKey = input.attributes.primary;
	const source = fieldSources[fieldKey];

	if (input.name === "Info") {
		return (
			<div className="relative" key={`info-wrapper-${fieldKey}`}>
				{source && source !== "empty" && (
					<div className="absolute -top-1 right-0 z-10">
						<SourceIndicator source={source} />
					</div>
				)}
					<InfoInput
						input={input}
						onChange={fieldChangeHandlers[fieldKey]}
						value={values[fieldKey] as string | number | undefined}
					/>
			</div>
		);
	}

	if (input.name === "Switch") {
		const currentValue = values[fieldKey] as string | undefined;

		return (
			<div className="relative" key={`switch-wrapper-${fieldKey}`}>
				{source && source !== "empty" && (
					<div className="absolute -top-1 right-0 z-10">
						<SourceIndicator source={source} />
					</div>
				)}
					<SwitchInput
						input={input}
						onChange={fieldChangeHandlers[fieldKey] as (newValue: string) => void}
						value={currentValue}
					/>
				{/* Render children of selected case */}
				{currentValue && input.children && (
					<div className="mt-4 ml-4 space-y-4">
						{input.children
							.filter(
								(child) =>
									child.name === "Case" &&
									child.attributes.primary === currentValue,
							)
								.flatMap((caseChild) =>
									caseChild.children.map((grandChild) =>
										renderInputTag(
											grandChild,
											values,
											fieldSources,
											fieldChangeHandlers,
										),
									),
								)}
					</div>
				)}
			</div>
		);
	}

	return null;
};

/**
 * Color-coded inputs component for PDF form fields
 *
 * Shows visual indicators for field state:
 * - empty: Default styling (no extra border)
 * - ai: Orange/yellow ring indicating AI-filled value
 * - manual: Green ring indicating user-edited value
 */
export default function PDFInputs({
	inputTags = [],
	fieldSources,
	initialValues,
	onChange,
	onFieldEdit,
}: PDFInputsProps) {
	// Use initialValues directly as the source of truth (controlled component)
	const values = initialValues ?? {};

	const handleInputChange = useCallback((key: string, value: unknown) => {
		// Update parent state directly
		onChange({ ...values, [key]: value });
		// Notify parent that this field was edited (will mark as manual)
		onFieldEdit(key);
	}, [onChange, onFieldEdit, values]);

	const fieldKeys = useMemo(() => {
		const keys = new Set<string>();
		const walk = (tag: InputTagType): void => {
			if (tag.attributes.primary) {
				keys.add(tag.attributes.primary);
			}
			for (const child of tag.children ?? []) {
				walk(child as InputTagType);
			}
		};
		for (const inputTag of inputTags) {
			walk(inputTag);
		}
		return [...keys];
	}, [inputTags]);

	const fieldChangeHandlers = useMemo(
		() =>
			Object.fromEntries(
				fieldKeys.map((key) => [
					key,
					(value: unknown) => {
						handleInputChange(key, value);
					},
				]),
			) as Record<string, (value: unknown) => void>,
		[fieldKeys, handleInputChange],
	);

	if (inputTags.length === 0 || !inputTags) {
		return null;
	}

	return (
			<form className="w-full max-w-full space-y-6 pr-4">
				{inputTags.map((inputTag) =>
					renderInputTag(inputTag, values, fieldSources, fieldChangeHandlers),
				)}
			</form>
		);
	}
