"use client";

import { InfoInput } from "@repo/design-system/components/inputs/ui/info-input";
import { SwitchInput } from "@repo/design-system/components/inputs/ui/switch-input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import type {
	InfoInputTagType,
	InputTagType,
	SwitchInputTagType,
} from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { Bot, Pencil } from "lucide-react";
import { useCallback } from "react";
import type { ReactNode } from "react";

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

	if (!config) {
		return null;
	}

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

const SourceOverlay = ({ source }: { source: InputSource | undefined }) => {
	if (!source || source === "empty") {
		return null;
	}
	return (
		<div className="absolute -top-1 right-0 z-10">
			<SourceIndicator source={source} />
		</div>
	);
};

interface RenderInputTagProps {
	input: InputTagType;
	values: Record<string, unknown>;
	fieldSources: Record<string, InputSource>;
	onInputChange: (key: string, value: unknown) => void;
}

const getMatchingCaseChildren = (
	input: SwitchInputTagType,
	currentValue: unknown,
): InputTagType[] => {
	if (!input.children) {
		return [];
	}

	let caseKey: string | undefined;
	if (typeof currentValue === "string") {
		caseKey = currentValue;
	} else if (typeof currentValue === "boolean") {
		caseKey = String(currentValue);
	}

	if (!caseKey) {
		return [];
	}

	return input.children
		.filter((child) => child.name === "Case" && child.attributes.primary === caseKey)
		.flatMap((caseChild) => caseChild.children);
};

const renderInfoTagInput = ({
	fieldKey,
	handleFieldValueChange,
	input,
	source,
	values,
}: {
	fieldKey: string;
	handleFieldValueChange: (value: unknown) => void;
	input: InfoInputTagType;
	source: InputSource | undefined;
	values: Record<string, unknown>;
}): ReactNode => (
	<div className="relative" key={`info-wrapper-${fieldKey}`}>
		<SourceOverlay source={source} />
		<InfoInput
			input={input}
			onChange={handleFieldValueChange}
			value={values[fieldKey] as string | number | undefined}
		/>
	</div>
);

const renderSwitchTagInput = ({
	fieldKey,
	handleFieldValueChange,
	input,
	renderNestedInputTag,
	source,
	values,
}: {
	fieldKey: string;
	handleFieldValueChange: (value: unknown) => void;
	input: SwitchInputTagType;
	renderNestedInputTag: (child: InputTagType, key: string) => ReactNode;
	source: InputSource | undefined;
	values: Record<string, unknown>;
}): ReactNode => {
	const currentValue = values[fieldKey] as string | boolean | undefined;
	const matchingCaseChildren = getMatchingCaseChildren(input, currentValue);

	return (
		<div className="relative" key={`switch-wrapper-${fieldKey}`}>
			<SourceOverlay source={source} />
			<SwitchInput
				input={input}
				onChange={handleFieldValueChange as (newValue: string | boolean) => void}
				value={currentValue}
			/>
			{matchingCaseChildren.length > 0 ? (
				<div className="mt-4 ml-4 space-y-4">
					{matchingCaseChildren.map((child) =>
						renderNestedInputTag(
							child,
							`${fieldKey}-${child.name}-${child.attributes.primary ?? ""}`,
						),
					)}
				</div>
			) : null}
		</div>
	);
};

const RenderInputTag = ({
	input,
	values,
	fieldSources,
	onInputChange,
}: RenderInputTagProps): ReactNode => {
	const fieldPrimary = input.attributes.primary;
	const fieldKey = fieldPrimary ?? "";
	const source = fieldSources[fieldKey];
	const handleFieldValueChange = useCallback(
		(value: unknown) => {
			onInputChange(fieldKey, value);
		},
		[fieldKey, onInputChange],
	);
	const handleRenderNestedInput = useCallback(
		(child: InputTagType, key: string) => (
			<RenderInputTag
				key={key}
				input={child}
				values={values}
				fieldSources={fieldSources}
				onInputChange={onInputChange}
			/>
		),
		[fieldSources, onInputChange, values],
	);

	if (!fieldPrimary) {
		return null;
	}

	if (input.name === "Info") {
		return renderInfoTagInput({
			fieldKey,
			handleFieldValueChange,
			input,
			source,
			values,
		});
	}
	if (input.name !== "Switch") {
		return null;
	}

	return renderSwitchTagInput({
		fieldKey,
		handleFieldValueChange,
		input,
		renderNestedInputTag: handleRenderNestedInput,
		source,
		values,
	});
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
	const values = initialValues ?? {};

	const handleInputChange = useCallback(
		(key: string, value: unknown) => {
			onChange({ ...initialValues, [key]: value });
			onFieldEdit(key);
		},
		[initialValues, onChange, onFieldEdit],
	);

	if (inputTags.length === 0) {
		return null;
	}

	return (
		<form className="w-full max-w-full space-y-6 pr-4">
			{inputTags.map((inputTag) => (
				<RenderInputTag
					key={`${inputTag.name}-${inputTag.attributes.primary ?? ""}`}
					input={inputTag}
					values={values}
					fieldSources={fieldSources}
					onInputChange={handleInputChange}
				/>
			))}
		</form>
	);
}
