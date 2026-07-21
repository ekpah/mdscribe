"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { InfoIcon, Link2, Plus, Sparkles, Trash2, Unlink2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { PDFUploadSection } from "@/app/documents/_components/pdf-upload-section";
import {
	getInputIdForPdfWidget,
	getPdfFieldHighlightsForInput,
} from "@/app/documents/_components/pdf-field-highlights";
import type { PdfFieldHighlight } from "@/app/documents/_components/pdf-field-highlights";
import { DocumentPreviewTabs } from "@/app/documents/_components/document-preview-tabs";
import type { DocumentPreviewView } from "@/app/documents/_components/document-preview-tabs";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section-dynamic";
import {
	buildDefaultDocumentDefinitionFromPdfFields,
	decodeBase64ToUint8Array,
	documentDefinitionSchema,
	encodeUint8ArrayToBase64,
	getBooleanBindingValueMap,
	isBooleanDocumentInput,
	mergeCheckboxBindingIntoChoice,
	normalizeDocumentDefinition,
	parsePDFFormFields,
	splitCheckboxOption,
} from "@/app/documents/_lib";
import type {
	DocumentBinding,
	DocumentDefinition,
	DocumentInput,
	DocumentInputKind,
	DocumentPdfType,
	PdfFormField,
} from "@/app/documents/_lib";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

interface EditorPdfField {
	bindingIndex: number;
	fieldName: string;
	isEnabled: boolean;
	optionMappings: { inputValue: string; pdfValue: string }[];
	pdfType: DocumentPdfType;
	valueMap?: Record<string, string>;
	widgetCount: number;
}

// View-model for one Markdoc input and all PDF fields bound to it. Derived on
// every render and never persisted.
interface EditorFieldRow {
	bindingIndex: number;
	bindingValueMap?: Record<string, string>;
	description: string;
	fieldName: string;
	fieldNames: string[];
	inputKind: DocumentInputKind;
	isEnabled: boolean;
	label: string;
	markdocType: "Info" | "Switch";
	options: string[];
	pdfFields: EditorPdfField[];
	pdfOptionMappings: { inputValue: string; pdfValue: string }[];
	pdfType: DocumentPdfType;
	pdfWidgetCount: number;
	textCheckboxValue?: string;
	valueType: "string" | "number" | "date";
}

const FALLBACK_CATEGORIES = ["Kardiologie", "Gastroenterologie", "Diverses", "Onkologie"] as const;
const COMPACT_FIELD_LABEL_CLASS_NAME = "block truncate text-[11px]";
const COMPACT_INPUT_CLASS_NAME = "h-8 min-w-0 text-xs";
const COMPACT_SELECT_TRIGGER_CLASS_NAME =
	"w-full min-w-0 rounded-md border-input bg-transparent px-3 text-xs shadow-xs [&>span]:truncate";
const FORM_SELECT_TRIGGER_CLASS_NAME =
	"h-9 w-full min-w-0 rounded-md border-input bg-transparent px-3 py-1 shadow-xs [&>span]:truncate";
const META_LABEL_CLASS_NAME =
	"text-muted-foreground text-[10px] uppercase leading-none tracking-normal";
const META_VALUE_CLASS_NAME = "mt-1 min-w-0 truncate font-medium text-xs";
const DOCUMENT_VISIBILITIES = ["public", "private"] as const;
type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

const getDocumentVisibilityLabel = (visibility: DocumentVisibility): string =>
	visibility === "private" ? "Privat" : "Öffentlich";

const toPdfTypeLabel = (pdfType: DocumentPdfType): string => {
	switch (pdfType) {
		case "text": {
			return "Text";
		}
		case "multiline": {
			return "Mehrzeilig";
		}
		case "dropdown": {
			return "Dropdown";
		}
		case "checkbox": {
			return "Checkbox";
		}
		case "radio": {
			return "Radio";
		}
		case "unsupported": {
			return "Nicht unterstützt";
		}
		default: {
			return pdfType;
		}
	}
};

const toInputKindLabel = (inputKind: DocumentInputKind): string => {
	switch (inputKind) {
		case "boolean": {
			return "Checkbox";
		}
		case "choice": {
			return "Auswahl";
		}
		case "text": {
			return "Text";
		}
		default: {
			return inputKind;
		}
	}
};

const normalizeSavedDocumentDefinition = (value: unknown): DocumentDefinition => {
	try {
		const parsed = documentDefinitionSchema.safeParse(value);
		if (parsed.success) {
			return normalizeDocumentDefinition(parsed.data);
		}
		return { bindings: [], inputs: [] };
	} catch (error) {
		console.error("Failed to load document definition:", error);
		return { bindings: [], inputs: [] };
	}
};

const toInputKind = (input: DocumentInput | undefined): DocumentInputKind => {
	if (input?.name !== "Switch") {
		return "text";
	}
	return isBooleanDocumentInput(input) ? "boolean" : "choice";
};

const toEditorFieldDefinitions = (
	definition: DocumentDefinition,
	pdfFields: PdfFormField[],
): EditorFieldRow[] => {
	const pdfFieldsByName = new Map(pdfFields.map((field) => [field.name, field]));
	const bindingEntriesByInputId = new Map<
		string,
		{ binding: DocumentBinding; bindingIndex: number }[]
	>();
	for (const [bindingIndex, binding] of definition.bindings.entries()) {
		const inputKey = binding.inputId.toLowerCase();
		const entries = bindingEntriesByInputId.get(inputKey) ?? [];
		entries.push({ binding, bindingIndex });
		bindingEntriesByInputId.set(inputKey, entries);
	}
	return definition.inputs.flatMap((input) => {
		const bindingEntries =
			bindingEntriesByInputId.get(input.attributes.primary.toLowerCase()) ?? [];
		if (bindingEntries.length === 0) {
			return [];
		}
		const editorPdfFields = bindingEntries.map(({ binding, bindingIndex }) => {
			const pdfField = pdfFieldsByName.get(binding.fieldName);
			return {
				bindingIndex,
				fieldName: binding.fieldName,
				isEnabled: binding.isEnabled,
				optionMappings: pdfField?.optionMappings ?? [],
				pdfType: pdfField?.type ?? "text",
				valueMap: binding.valueMap,
				widgetCount: pdfField?.widgetCount ?? 0,
			};
		});
		const [primaryBinding] = bindingEntries;
		const [primaryPdfField] = editorPdfFields;
		if (!(primaryBinding && primaryPdfField)) {
			return [];
		}
		const inputKind = toInputKind(input);
		return [
			{
				bindingIndex: primaryBinding.bindingIndex,
				bindingValueMap: primaryBinding.binding.valueMap,
				description: input?.name === "Info" ? (input.attributes.description ?? "") : "",
				fieldName: primaryPdfField.fieldName,
				fieldNames: editorPdfFields.map((field) => field.fieldName),
				inputKind,
				isEnabled: editorPdfFields.every((field) => field.isEnabled),
				label: input.attributes.primary,
				markdocType: inputKind === "text" ? "Info" : "Switch",
				options:
					input?.name === "Switch"
						? input.children.map((child) => child.attributes.primary)
						: [],
				pdfFields: editorPdfFields,
				pdfOptionMappings: primaryPdfField.optionMappings,
				pdfType: primaryPdfField.pdfType,
				pdfWidgetCount: Math.max(...editorPdfFields.map((field) => field.widgetCount)),
				textCheckboxValue:
					(primaryPdfField.pdfType === "text" || primaryPdfField.pdfType === "multiline") &&
					inputKind === "boolean"
						? (primaryBinding.binding.valueMap?.true ?? "x")
						: undefined,
				valueType: input?.name === "Info" ? (input.attributes.type ?? "string") : "string",
			},
		];
	});
};

const remapValueMapKeys = (
	valueMap: Record<string, string> | undefined,
	previousOptions: string[],
	nextOptions: string[],
): Record<string, string> | undefined => {
	if (!valueMap) {
		return undefined;
	}
	return Object.fromEntries(
		nextOptions.map((option, index) => [
			option,
			valueMap[previousOptions[index] ?? option] ?? option,
		]),
	);
};

const updateBindingForInput = ({
	binding,
	currentInputId,
	isTargetBinding,
	nextInputId,
	nextOptions,
	previousOptions,
	update,
}: {
	binding: DocumentBinding;
	currentInputId: string;
	isTargetBinding: boolean;
	nextInputId: string;
	nextOptions: string[];
	previousOptions: string[];
	update: Partial<EditorFieldRow>;
}): DocumentBinding => {
	const referencesCurrentInput = binding.inputId.toLowerCase() === currentInputId.toLowerCase();
	let valueMap = referencesCurrentInput
		? remapValueMapKeys(binding.valueMap, previousOptions, nextOptions)
		: binding.valueMap;
	if (referencesCurrentInput && update.inputKind === "text") {
		valueMap = undefined;
	} else if (referencesCurrentInput && update.inputKind === "boolean") {
		valueMap = {
			false: "",
			true: binding.valueMap?.true ?? update.textCheckboxValue?.trim() ?? "x",
		};
	}

	if (isTargetBinding && update.textCheckboxValue !== undefined) {
		valueMap = { false: "", true: update.textCheckboxValue };
	}
	if (isTargetBinding && Object.hasOwn(update, "bindingValueMap")) {
		valueMap = update.bindingValueMap;
	}

	return {
		...binding,
		...(referencesCurrentInput && update.isEnabled !== undefined
			? { isEnabled: update.isEnabled }
			: {}),
		...(valueMap ? { valueMap } : { valueMap: undefined }),
		inputId: referencesCurrentInput ? nextInputId : binding.inputId,
	};
};

const buildUpdatedDocumentInput = (
	currentInput: DocumentInput,
	nextInputId: string,
	nextOptions: string[],
	update: Partial<EditorFieldRow>,
): DocumentInput => {
	if (update.inputKind === "boolean") {
		return {
			attributes: { primary: nextInputId, type: "boolean" },
			children: ["true", "false"].map((primary) => ({
				attributes: { primary },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		};
	}
	if (update.inputKind === "text") {
		return {
			attributes: {
				primary: nextInputId,
				type:
					update.valueType ??
					(currentInput.name === "Info" ? currentInput.attributes.type : "string"),
				...(update.description?.trim() ? { description: update.description.trim() } : {}),
			},
			children: [],
			name: "Info",
		};
	}
	if (update.inputKind === "choice") {
		return {
			attributes: { primary: nextInputId },
			children: nextOptions.map((primary) => ({
				attributes: { primary },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		};
	}
	if (currentInput.name === "Switch") {
		return {
			...currentInput,
			attributes: { ...currentInput.attributes, primary: nextInputId },
			children: nextOptions.map((primary) => ({
				attributes: { primary },
				children: [],
				name: "Case" as const,
			})),
		};
	}
	return {
		...currentInput,
		attributes: {
			...currentInput.attributes,
			...(update.description === undefined
				? {}
				: { description: update.description.trim() || undefined }),
			...(update.valueType === undefined ? {} : { type: update.valueType }),
			primary: nextInputId,
		},
	};
};

const updateDocumentDefinitionAt = (
	definition: DocumentDefinition,
	index: number,
	update: Partial<EditorFieldRow>,
): DocumentDefinition => {
	const binding = definition.bindings[index];
	if (!binding) {
		return definition;
	}
	const inputIndex = definition.inputs.findIndex(
		(input) => input.attributes.primary.toLowerCase() === binding.inputId.toLowerCase(),
	);
	const currentInput = definition.inputs[inputIndex];
	const nextInputId = update.label?.trim() || binding.inputId;
	const previousOptions =
		currentInput?.name === "Switch"
			? currentInput.children.map((child) => child.attributes.primary)
			: [];
	const nextOptions = update.options ?? previousOptions;
	const nextBindings = definition.bindings.map((currentBinding, bindingIndex) =>
		updateBindingForInput({
			binding: currentBinding,
			currentInputId: binding.inputId,
			isTargetBinding: bindingIndex === index,
			nextInputId,
			nextOptions,
			previousOptions,
			update,
		}),
	);
	if (!currentInput) {
		return { ...definition, bindings: nextBindings };
	}

	const nextInput = buildUpdatedDocumentInput(currentInput, nextInputId, nextOptions, update);

	return {
		...definition,
		bindings: nextBindings,
		inputs: definition.inputs.map((input, currentIndex) =>
			currentIndex === inputIndex ? nextInput : input,
		),
	};
};

const assignDocumentBindingInput = (
	definition: DocumentDefinition,
	index: number,
	inputId: string,
): DocumentDefinition => {
	const binding = definition.bindings[index];
	if (!binding || binding.inputId === inputId) {
		return definition;
	}
	const previousInput = definition.inputs.find(
		(input) => input.attributes.primary.toLowerCase() === binding.inputId.toLowerCase(),
	);
	const nextInput = definition.inputs.find(
		(input) => input.attributes.primary.toLowerCase() === inputId.toLowerCase(),
	);
	if (!previousInput || !nextInput || toInputKind(previousInput) !== toInputKind(nextInput)) {
		return definition;
	}

	let { valueMap } = binding;
	if (previousInput.name === "Switch" && nextInput.name === "Switch") {
		const previousOptions = previousInput.children.map((child) => child.attributes.primary);
		const nextOptions = nextInput.children.map((child) => child.attributes.primary);
		if (previousOptions.length !== nextOptions.length) {
			return definition;
		}
		valueMap = Object.fromEntries(
			nextOptions.map((option, optionIndex) => [
				option,
				binding.valueMap?.[previousOptions[optionIndex] ?? option] ??
					previousOptions[optionIndex] ??
					option,
			]),
		);
	} else if (nextInput.name === "Info") {
		valueMap = undefined;
	}

	const bindings = definition.bindings.map((currentBinding, bindingIndex) =>
		bindingIndex === index ? { ...currentBinding, inputId, valueMap } : currentBinding,
	);
	const hasPreviousInputBinding = bindings.some(
		(currentBinding) => currentBinding.inputId.toLowerCase() === binding.inputId.toLowerCase(),
	);
	return {
		...definition,
		bindings,
		inputs: hasPreviousInputBinding
			? definition.inputs
			: definition.inputs.filter(
					(input) => input.attributes.primary.toLowerCase() !== binding.inputId.toLowerCase(),
				),
	};
};

const getDocumentEditorTitle = (documentId: string | undefined): string => {
	if (documentId) {
		return "Dokument bearbeiten";
	}

	return "Dokument erstellen";
};

interface FieldDefinitionCardProps {
	canAddCheckboxOption: boolean;
	canManageCheckboxOptions: boolean;
	fieldDefinition: EditorFieldRow;
	index: number;
	inputVariables: string[];
	isActive: boolean;
	isCheckboxMergeCandidate: boolean;
	isCheckboxMergeTarget: boolean;
	onBeginCheckboxMerge: (inputId: string) => void;
	onCancelCheckboxMerge: () => void;
	onFieldCardRef: (inputId: string, node: HTMLDivElement | null) => void;
	onMapToVariable: (index: number, variable: string) => void;
	onPreview: (inputId: string) => void;
	onSelectCheckboxForMerge: (index: number) => void;
	onSplitCheckboxOption: (inputId: string, option: string) => void;
	onUpdate: (index: number, update: Partial<EditorFieldRow>) => void;
}

const getInputKindOptions = (
	fieldDefinition: EditorFieldRow,
): { label: string; value: DocumentInputKind }[] => {
	if (fieldDefinition.pdfType === "text" || fieldDefinition.pdfType === "multiline") {
		return [
			{ label: "Text", value: "text" },
			{ label: "Auswahl", value: "choice" },
			{ label: "Checkbox", value: "boolean" },
		];
	}
	if (
		fieldDefinition.pdfType === "checkbox" &&
		fieldDefinition.pdfWidgetCount <= 1 &&
		fieldDefinition.pdfFields.length === 1
	) {
		return [
			{ label: "Checkbox", value: "boolean" },
			{ label: "Auswahl", value: "choice" },
		];
	}
	return [
		{
			label: toInputKindLabel(fieldDefinition.inputKind),
			value: fieldDefinition.inputKind,
		},
	];
};

const getChoiceConversionOptions = (fieldDefinition: EditorFieldRow, option: string): string[] => {
	if (fieldDefinition.inputKind === "choice") {
		return fieldDefinition.options;
	}
	if (fieldDefinition.inputKind === "boolean" || fieldDefinition.pdfType === "checkbox") {
		return [option];
	}
	return ["Option 1", "Option 2"];
};

const getInputKindUpdate = (
	fieldDefinition: EditorFieldRow,
	inputKind: DocumentInputKind,
): Partial<EditorFieldRow> => {
	if (inputKind === "boolean") {
		return {
			bindingValueMap: getBooleanBindingValueMap({
				currentValueMap: fieldDefinition.bindingValueMap,
				pdfOptionMappings: fieldDefinition.pdfOptionMappings,
				pdfType: fieldDefinition.pdfType,
				textCheckboxValue: fieldDefinition.textCheckboxValue,
			}),
			inputKind: "boolean",
			markdocType: "Switch",
			options: ["true", "false"],
			textCheckboxValue: fieldDefinition.textCheckboxValue?.trim() || "x",
			valueType: "string",
		};
	}
	if (inputKind === "choice") {
		const option = fieldDefinition.label.trim() || "Option 1";
		const isCheckboxLikeConversion =
			fieldDefinition.inputKind === "boolean" || fieldDefinition.pdfType === "checkbox";
		const selectedPdfValue =
			fieldDefinition.bindingValueMap?.true ??
			fieldDefinition.textCheckboxValue?.trim() ??
			(fieldDefinition.pdfType === "checkbox" ? "true" : "x");
		return {
			bindingValueMap: isCheckboxLikeConversion ? { [option]: selectedPdfValue } : undefined,
			inputKind: "choice",
			markdocType: "Switch",
			options: getChoiceConversionOptions(fieldDefinition, option),
			valueType: "string",
		};
	}
	return {
		bindingValueMap: undefined,
		inputKind: "text",
		markdocType: "Info",
		options: [],
		valueType: "string",
	};
};

interface ChoiceOptionsEditorProps {
	canAddCheckboxOption: boolean;
	canManageCheckboxOptions: boolean;
	fieldDefinition: EditorFieldRow;
	index: number;
	inputVariables: string[];
	isCheckboxMergeTarget: boolean;
	onBeginCheckboxMerge: (inputId: string) => void;
	onCancelCheckboxMerge: () => void;
	onMapToVariable: (index: number, variable: string) => void;
	onSplitCheckboxOption: (inputId: string, option: string) => void;
	onUpdate: (index: number, update: Partial<EditorFieldRow>) => void;
}

interface ChoiceOptionActionProps {
	canChangeOptionCount: boolean;
	canDetachCheckboxOption: boolean;
	isRemoveDisabled: boolean;
	onDetach: () => void;
	onRemove: () => void;
	option: string;
	optionIndex: number;
}

const ChoiceOptionAction = ({
	canChangeOptionCount,
	canDetachCheckboxOption,
	isRemoveDisabled,
	onDetach,
	onRemove,
	option,
	optionIndex,
}: ChoiceOptionActionProps) => {
	if (canChangeOptionCount) {
		return (
			<Button
				aria-label={`Option ${optionIndex + 1} entfernen`}
				className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				disabled={isRemoveDisabled}
				onClick={onRemove}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<Trash2 className="h-3.5 w-3.5" />
			</Button>
		);
	}
	if (!canDetachCheckboxOption) {
		return <span />;
	}
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						aria-label={`${USER_MESSAGES.documentEditor.detachCheckboxOption}: ${option}`}
						className="border-border/70 bg-background text-muted-foreground shadow-none hover:border-solarized-blue/40 hover:bg-solarized-blue/10 hover:text-solarized-blue"
						onClick={onDetach}
						size="icon-sm"
						type="button"
						variant="outline"
					>
						<Unlink2 className="h-3.5 w-3.5" />
					</Button>
				}
			/>
			<TooltipContent side="left">
				{USER_MESSAGES.documentEditor.detachCheckboxOption}
			</TooltipContent>
		</Tooltip>
	);
};

const ChoiceOptionsEditor = ({
	canAddCheckboxOption,
	canManageCheckboxOptions,
	fieldDefinition,
	index,
	inputVariables,
	isCheckboxMergeTarget,
	onBeginCheckboxMerge,
	onCancelCheckboxMerge,
	onMapToVariable,
	onSplitCheckboxOption,
	onUpdate,
}: ChoiceOptionsEditorProps) => {
	if (fieldDefinition.inputKind !== "choice") {
		return null;
	}

	const canChangeOptionCount =
		!canManageCheckboxOptions &&
		(fieldDefinition.pdfType === "text" || fieldDefinition.pdfType === "multiline");
	const canDetachCheckboxOption = canManageCheckboxOptions && fieldDefinition.options.length > 0;
	const handleVariableMappingChange = (value: string) => onMapToVariable(index, value);
	const handleAddOption = () => {
		onUpdate(index, {
			options: [...fieldDefinition.options, `Option ${fieldDefinition.options.length + 1}`],
		});
	};
	const handleRemoveOption = (optionIndex: number) => {
		onUpdate(index, {
			options: fieldDefinition.options.filter(
				(_option, currentIndex) => currentIndex !== optionIndex,
			),
		});
	};
	const handleOptionChange = (optionIndex: number, value: string) => {
		onUpdate(index, {
			options: fieldDefinition.options.map((option, currentIndex) =>
				currentIndex === optionIndex ? value : option,
			),
		});
	};

	return (
		<div className="min-w-0 space-y-1">
			<div className="flex items-center justify-between gap-2">
				<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Optionen</Label>
				{canChangeOptionCount ? (
					<Button
						aria-label="Option hinzufügen"
						onClick={handleAddOption}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<Plus className="h-3.5 w-3.5" />
					</Button>
				) : null}
			</div>
			<div className="space-y-1">
				{fieldDefinition.options.map((option, optionIndex) => (
					<div
						className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-1.5"
						key={`${fieldDefinition.fieldName}-option-${optionIndex}`}
					>
						<span className="text-muted-foreground text-[11px] tabular-nums">
							{optionIndex + 1}
						</span>
						<Input
							className={COMPACT_INPUT_CLASS_NAME}
							onChange={(event) => handleOptionChange(optionIndex, event.target.value)}
							value={option}
						/>
						<ChoiceOptionAction
							canChangeOptionCount={canChangeOptionCount}
							canDetachCheckboxOption={canDetachCheckboxOption}
							isRemoveDisabled={fieldDefinition.options.length <= 1}
							onDetach={() => onSplitCheckboxOption(fieldDefinition.label, option)}
							onRemove={() => handleRemoveOption(optionIndex)}
							option={option}
							optionIndex={optionIndex}
						/>
					</div>
				))}
			</div>
			{canAddCheckboxOption ? (
				<Button
					className="h-7 w-fit justify-start border-dashed px-2 text-[11px] text-foreground/80 hover:text-foreground"
					onClick={() =>
						isCheckboxMergeTarget
							? onCancelCheckboxMerge()
							: onBeginCheckboxMerge(fieldDefinition.label)
					}
					size="xs"
					type="button"
					variant={isCheckboxMergeTarget ? "secondary" : "outline"}
				>
					{isCheckboxMergeTarget ? (
						<X className="h-3 w-3" />
					) : (
						<Plus className="h-3 w-3" />
					)}
					{isCheckboxMergeTarget
						? USER_MESSAGES.documentEditor.cancelAddingCheckbox
						: USER_MESSAGES.documentEditor.addCheckboxAsOption}
				</Button>
			) : null}
			{inputVariables.length > 1 ? (
				<div className="min-w-0 space-y-0.5">
					<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Bestehende Eingabe verwenden</Label>
					<Select onValueChange={handleVariableMappingChange} value={fieldDefinition.label}>
						<SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS_NAME} size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{inputVariables.map((variable) => (
								<SelectItem key={variable} value={variable}>
									{variable}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			) : null}
		</div>
	);
};

const FieldDefinitionCard = memo(
	({
		canAddCheckboxOption,
		canManageCheckboxOptions,
		fieldDefinition,
		index,
		inputVariables,
		isActive,
		isCheckboxMergeCandidate,
		isCheckboxMergeTarget,
		onBeginCheckboxMerge,
		onCancelCheckboxMerge,
		onFieldCardRef,
		onMapToVariable,
		onPreview,
		onSelectCheckboxForMerge,
		onSplitCheckboxOption,
		onUpdate,
	}: FieldDefinitionCardProps) => {
		const handlePreview = useCallback(() => {
			onPreview(fieldDefinition.label);
		}, [fieldDefinition.label, onPreview]);

		const handleLabelChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
				onUpdate(index, { label: event.target.value });
			},
			[index, onUpdate],
		);

		const handleValueTypeChange = useCallback(
			(value: "string" | "number" | "date") => {
				onUpdate(index, { valueType: value });
			},
			[index, onUpdate],
		);

		const handleInputKindChange = useCallback(
			(value: DocumentInputKind) => {
				onUpdate(index, getInputKindUpdate(fieldDefinition, value));
			},
			[fieldDefinition, index, onUpdate],
		);

		const handleDescriptionChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
				onUpdate(index, { description: event.target.value });
			},
			[index, onUpdate],
		);

		const handleEnabledChange = useCallback(
			(checked: boolean) => {
				onUpdate(index, { isEnabled: checked });
			},
			[index, onUpdate],
		);

		const handleTextCheckboxValueChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
				onUpdate(index, { textCheckboxValue: event.target.value });
			},
			[index, onUpdate],
		);

		const isTextPdf = fieldDefinition.pdfType === "text" || fieldDefinition.pdfType === "multiline";
		const isUnsupportedPdf = fieldDefinition.pdfFields.some(
			(pdfField) => pdfField.pdfType === "unsupported",
		);
		const inputKindOptions = getInputKindOptions(fieldDefinition);
		const canEditInputKind = inputKindOptions.length > 1;
		const isTextBackedCheckbox = isTextPdf && fieldDefinition.inputKind === "boolean";
		return (
			<Card
				className={cn(
					"group relative overflow-hidden p-0 transition-[border-color,box-shadow,opacity] duration-150",
					isCheckboxMergeCandidate ? "border-solarized-blue ring-1 ring-solarized-blue/50" : "",
					isActive ? "border-transparent shadow-none ring-2 ring-solarized-orange/70" : "",
				)}
				data-document-input-id={fieldDefinition.label}
				data-pdf-field-names={fieldDefinition.fieldNames.join(",")}
				onFocusCapture={handlePreview}
				onPointerDownCapture={handlePreview}
				ref={(node) => onFieldCardRef(fieldDefinition.label, node)}
			>
				<div className="grid gap-0 md:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
					<div className="min-w-0 border-border/70 border-b bg-muted/20 p-2 md:border-r md:border-b-0">
						<div className="mb-2 flex items-center justify-between gap-2">
							<p className="font-medium text-muted-foreground text-xs">
								{fieldDefinition.pdfFields.length === 1
									? "PDF-Formularfeld"
									: "PDF-Felder"}
							</p>
							<Badge className="h-5 px-1.5 font-medium text-[10px]" variant="secondary">
								{isUnsupportedPdf ? "nicht unterstützt" : "nicht editierbar"}
							</Badge>
						</div>

						<div className="space-y-1.5">
							<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
								<p className={META_LABEL_CLASS_NAME}>Name</p>
								<p className={META_LABEL_CLASS_NAME}>Typ</p>
							</div>
							{fieldDefinition.pdfFields.map((pdfField) => (
								<div
									className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-border/50 border-t pt-1.5 first:border-t-0 first:pt-0"
									key={pdfField.fieldName}
								>
									<p className={cn(META_VALUE_CLASS_NAME, "mt-0 font-mono")}>
										{pdfField.fieldName}
									</p>
									<p className={cn(META_VALUE_CLASS_NAME, "mt-0")}>
										{toPdfTypeLabel(pdfField.pdfType)}
									</p>
								</div>
							))}
						</div>
					</div>

					<div className="min-w-0 bg-background p-2">
						<div className="space-y-1">
							<div className="flex items-center justify-between gap-2">
								<p className="font-medium text-xs">Eingabe im MDScribe-Formular</p>
								<div className="flex shrink-0 items-center gap-1.5">
									<span className="text-muted-foreground text-xs">Aktiv</span>
									<Switch
										checked={fieldDefinition.isEnabled}
										disabled={isUnsupportedPdf}
										onCheckedChange={handleEnabledChange}
									/>
								</div>
							</div>

							<div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,9rem)] gap-x-1.5 gap-y-0.5">
								<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Label</Label>
								<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Eingabe-Typ</Label>
								<Input
									className={COMPACT_INPUT_CLASS_NAME}
									onChange={handleLabelChange}
									value={fieldDefinition.label}
								/>
								{canEditInputKind ? (
									<Select onValueChange={handleInputKindChange} value={fieldDefinition.inputKind}>
										<SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS_NAME} size="sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{inputKindOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<Input
										className={COMPACT_INPUT_CLASS_NAME}
										disabled
										value={toInputKindLabel(fieldDefinition.inputKind)}
									/>
								)}
							</div>

							{isTextBackedCheckbox ? (
								<div className="min-w-0 space-y-0.5">
									<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Anzeigewert</Label>
									<Input
										className={COMPACT_INPUT_CLASS_NAME}
										onChange={handleTextCheckboxValueChange}
										value={fieldDefinition.textCheckboxValue ?? "x"}
									/>
								</div>
							) : null}

							{fieldDefinition.markdocType === "Info" && !isTextBackedCheckbox ? (
								<div className="min-w-0 space-y-0.5">
									<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Wertetyp</Label>
									<Select onValueChange={handleValueTypeChange} value={fieldDefinition.valueType}>
										<SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS_NAME} size="sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="string">string</SelectItem>
											<SelectItem value="number">number</SelectItem>
											<SelectItem value="date">date</SelectItem>
										</SelectContent>
									</Select>
								</div>
							) : null}

							{fieldDefinition.markdocType === "Info" ? (
								<div className="min-w-0 space-y-0.5">
									<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Beschreibung (optional)</Label>
									<Input
										className={COMPACT_INPUT_CLASS_NAME}
										onChange={handleDescriptionChange}
										placeholder="Hilfetext für das Eingabefeld"
										value={fieldDefinition.description}
									/>
								</div>
							) : null}

							<ChoiceOptionsEditor
								canAddCheckboxOption={canAddCheckboxOption}
								canManageCheckboxOptions={canManageCheckboxOptions}
								fieldDefinition={fieldDefinition}
								index={index}
								inputVariables={inputVariables}
								isCheckboxMergeTarget={isCheckboxMergeTarget}
								onBeginCheckboxMerge={onBeginCheckboxMerge}
								onCancelCheckboxMerge={onCancelCheckboxMerge}
								onMapToVariable={onMapToVariable}
								onSplitCheckboxOption={onSplitCheckboxOption}
								onUpdate={onUpdate}
							/>
						</div>
					</div>
				</div>
				{isCheckboxMergeCandidate ? (
					<button
						aria-label={`${USER_MESSAGES.documentEditor.selectCheckboxAsOption}: ${fieldDefinition.label}`}
						className="absolute inset-0 z-10 flex cursor-pointer items-start justify-end bg-solarized-blue/5 p-2"
						onClick={() => onSelectCheckboxForMerge(index)}
						type="button"
					>
						<span className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-2 font-medium text-[11px] shadow-xs">
							<Link2 className="h-3 w-3" />
							{USER_MESSAGES.documentEditor.selectCheckboxAsOption}
						</span>
					</button>
				) : null}
			</Card>
		);
	},
	(previousProps, nextProps) =>
		previousProps.canAddCheckboxOption === nextProps.canAddCheckboxOption &&
		previousProps.canManageCheckboxOptions === nextProps.canManageCheckboxOptions &&
		previousProps.fieldDefinition === nextProps.fieldDefinition &&
		previousProps.index === nextProps.index &&
		previousProps.isActive === nextProps.isActive &&
		previousProps.isCheckboxMergeCandidate === nextProps.isCheckboxMergeCandidate &&
		previousProps.isCheckboxMergeTarget === nextProps.isCheckboxMergeTarget,
);

interface DocumentPreviewPaneProps {
	activePdfFieldHighlights: PdfFieldHighlight[];
	information: string;
	onClear: () => void;
	onFieldSelect: (fieldName: string, widgetValue?: string) => void;
	onFileUpload: (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => Promise<void>;
	onInformationChange: (information: string) => void;
	pdfFileBytes: Uint8Array | null;
	pdfFileName: string;
}

const DocumentPreviewPane = memo(
	({
		activePdfFieldHighlights,
		information,
		onClear,
		onFieldSelect,
		onFileUpload,
		onInformationChange,
		pdfFileBytes,
		pdfFileName,
	}: DocumentPreviewPaneProps) => {
		const [activeView, setActiveView] = useState<DocumentPreviewView>("document");

		return (
			<div className="relative col-span-1 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-t p-4 pr-14 md:border-t-0 md:border-l">
				<DocumentPreviewTabs activeView={activeView} onViewChange={setActiveView} />
				{activeView === "document" ? (
					<>
						<div className="shrink-0">
							<PDFUploadSection
								onClear={onClear}
								onFileUpload={onFileUpload}
								pdfFile={pdfFileBytes}
								pdfFileName={pdfFileName}
							/>
						</div>
						<div className="mt-4 min-h-0 flex-1 overflow-hidden">
							<PDFViewSection
								activeFieldHighlights={activePdfFieldHighlights}
								hasUploadedFile={Boolean(pdfFileBytes)}
								onFieldSelect={onFieldSelect}
								pdfFile={pdfFileBytes}
							/>
						</div>
					</>
				) : (
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						<div>
							<Label htmlFor="document-information">
								{USER_MESSAGES.documentEditor.informationLabel}
							</Label>
							<p className="mt-1 text-muted-foreground text-xs">
								{USER_MESSAGES.documentEditor.informationDescription}
							</p>
						</div>
						<Textarea
							className="min-h-0 flex-1 resize-none"
							id="document-information"
							maxLength={10_000}
							onChange={(event) => onInformationChange(event.target.value)}
							placeholder={USER_MESSAGES.documentEditor.informationPlaceholder}
							value={information}
						/>
					</div>
				)}
			</div>
		);
	},
);

FieldDefinitionCard.displayName = "FieldDefinitionCard";
DocumentPreviewPane.displayName = "DocumentPreviewPane";

const useLoadSourcePdf = ({
	isPdfReplaced,
	pdfBase64,
	pdfId,
	setPdfFileBytes,
	setPdfFields,
	sourceDocumentId,
}: {
	isPdfReplaced: boolean;
	pdfBase64?: string;
	pdfId?: string;
	setPdfFileBytes: (bytes: Uint8Array) => void;
	setPdfFields: (fields: PdfFormField[]) => void;
	sourceDocumentId?: string;
}) => {
	useEffect(() => {
		if (!pdfBase64 || isPdfReplaced || (sourceDocumentId && pdfId !== sourceDocumentId)) {
			return;
		}

		const pdfBytes = decodeBase64ToUint8Array(pdfBase64);
		setPdfFileBytes(pdfBytes);
		let isCancelled = false;
		const loadPdfFields = async () => {
			try {
				const { fields } = await parsePDFFormFields(pdfBytes);
				if (!isCancelled) {
					setPdfFields(fields);
				}
			} catch (error) {
				console.error("Failed to parse saved PDF fields:", error);
				if (!isCancelled) {
					setPdfFields([]);
				}
			}
		};
		loadPdfFields();

		return () => {
			isCancelled = true;
		};
	}, [isPdfReplaced, pdfBase64, pdfId, setPdfFields, setPdfFileBytes, sourceDocumentId]);
};

const getSourcePdfData = (
	sourcePdf: { id: string; pdfBase64: string } | null | undefined,
): { pdfBase64?: string; pdfId?: string } => ({
	pdfBase64: sourcePdf?.pdfBase64,
	pdfId: sourcePdf?.id,
});

const isUncheckedPdfValue = (value: string): boolean =>
	["", "0", "false", "off"].includes(value.trim().toLowerCase());

const isCheckboxLikeChoiceBinding = (
	binding: DocumentBinding,
	field: PdfFormField | undefined,
	options: string[],
): boolean => {
	if (field?.type === "checkbox") {
		return true;
	}
	if ((field?.type !== "text" && field?.type !== "multiline") || !binding.valueMap) {
		return false;
	}

	const mappedValues = options.map((option) => binding.valueMap?.[option]);
	return (
		mappedValues.every((value) => typeof value === "string") &&
		mappedValues.filter((value) => value !== undefined && !isUncheckedPdfValue(value)).length === 1
	);
};

const getCheckboxLikeChoiceInputIds = (
	definition: DocumentDefinition,
	pdfFields: PdfFormField[],
): string[] => {
	const pdfFieldsByName = new Map(pdfFields.map((field) => [field.name, field]));
	const bindingsByInputId = new Map<string, DocumentBinding[]>();
	for (const binding of definition.bindings) {
		const inputKey = binding.inputId.toLowerCase();
		const bindings = bindingsByInputId.get(inputKey) ?? [];
		bindings.push(binding);
		bindingsByInputId.set(inputKey, bindings);
	}
	return definition.inputs
		.filter((input) => input.name === "Switch" && !isBooleanDocumentInput(input))
		.filter((input) => {
			const options = input.children.map((child) => child.attributes.primary);
			const bindings = bindingsByInputId.get(input.attributes.primary.toLowerCase()) ?? [];
			return (
				bindings.length > 0 &&
				bindings.every((binding) => {
					const field = pdfFieldsByName.get(binding.fieldName);
					return isCheckboxLikeChoiceBinding(binding, field, options);
				})
			);
		})
		.map((input) => input.attributes.primary);
};

const isCheckboxLikeBooleanField = (field: EditorFieldRow): boolean =>
	field.inputKind === "boolean" &&
	field.pdfFields.every(
		(pdfField) =>
			pdfField.pdfType === "checkbox" ||
			((pdfField.pdfType === "text" || pdfField.pdfType === "multiline") &&
				Boolean(pdfField.valueMap?.true) &&
				isUncheckedPdfValue(pdfField.valueMap?.false ?? "")),
	);

export default function DocumentEditor({
	documentId,
	forkId,
}: {
	documentId?: string;
	forkId?: string;
}) {
	const router = useRouter();
	const sourceDocumentId = documentId || forkId;
	const fieldCardRefs = useRef(new Map<string, HTMLDivElement>());
	const initializedRef = useRef(false);

	const [title, setTitle] = useState("");
	const [category, setCategory] = useState("");
	const [information, setInformation] = useState("");
	const [newCategory, setNewCategory] = useState("");
	const [pdfFileBytes, setPdfFileBytes] = useState<Uint8Array | null>(null);
	const [pdfFields, setPdfFields] = useState<PdfFormField[]>([]);
	const [pdfFileName, setPdfFileName] = useState("document.pdf");
	const [isPdfReplaced, setIsPdfReplaced] = useState(false);
	const [definition, setDefinition] = useState<DocumentDefinition>({
		bindings: [],
		inputs: [],
	});
	const [activeInputId, setActiveInputId] = useState<string | null>(null);
	const [checkboxMergeTargetInputId, setCheckboxMergeTargetInputId] = useState<string | null>(null);
	const [visibility, setVisibility] = useState<DocumentVisibility>("public");

	const { data: editorContext } = useQuery(orpc.documents.templates.editorContext.queryOptions());
	const { data: sourceDocument } = useQuery({
		...orpc.documents.templates.get.queryOptions(
			sourceDocumentId ? { input: { id: sourceDocumentId } } : { input: { id: "" } },
		),
		enabled: Boolean(sourceDocumentId),
	});
	const { data: sourceDocumentPdf } = useQuery({
		...orpc.documents.templates.getPdf.queryOptions(
			sourceDocumentId ? { input: { id: sourceDocumentId } } : { input: { id: "" } },
		),
		enabled: Boolean(sourceDocumentId),
	});
	const sourcePdfData = getSourcePdfData(sourceDocumentPdf);
	useLoadSourcePdf({
		isPdfReplaced,
		...sourcePdfData,
		setPdfFields,
		setPdfFileBytes,
		sourceDocumentId,
	});

	useEffect(() => {
		if (initializedRef.current || !sourceDocument) {
			return;
		}

		setTitle(sourceDocument.title);
		setCategory(sourceDocument.category);
		setInformation(sourceDocument.information);
		setVisibility(sourceDocument.visibility === "private" ? "private" : "public");
		const savedDefinition = normalizeSavedDocumentDefinition(sourceDocument.fieldDefinitions);
		if (savedDefinition.bindings.length > 0) {
			setDefinition(savedDefinition);
			setActiveInputId(savedDefinition.bindings[0]?.inputId ?? null);
		}
		initializedRef.current = true;
	}, [sourceDocument]);

	useEffect(() => {
		if (!sourceDocument || isPdfReplaced) {
			return;
		}
		setPdfFileName(`${sourceDocument.title}.pdf`);
	}, [isPdfReplaced, sourceDocument]);

	const createMutation = useMutation(orpc.documents.templates.create.mutationOptions());
	const updateMutation = useMutation(orpc.documents.templates.update.mutationOptions());
	const enhanceMutation = useMutation(orpc.documents.enhanceDefinition.mutationOptions());

	const handlePdfUpload = useCallback(
		async (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => {
			const { fields } = await parsePDFFormFields(file);
			const nextDefinition = buildDefaultDocumentDefinitionFromPdfFields(fields);
			setPdfFileBytes(file);
			setPdfFileName(fileMeta.name);
			setIsPdfReplaced(true);
			setPdfFields(fields);
			setDefinition(nextDefinition);
			setActiveInputId(nextDefinition.bindings[0]?.inputId ?? null);
			setCheckboxMergeTargetInputId(null);
		},
		[],
	);

	const handleClearPdf = useCallback(() => {
		setPdfFileBytes(null);
		setPdfFields([]);
		setDefinition({ bindings: [], inputs: [] });
		setActiveInputId(null);
		setCheckboxMergeTargetInputId(null);
		setPdfFileName("document.pdf");
		setIsPdfReplaced(true);
	}, []);

	const handleFieldUpdate = useCallback(
		(index: number, update: Partial<EditorFieldRow>) => {
			const previousInputId = definition.bindings[index]?.inputId;
			if (previousInputId && update.label !== undefined) {
				setActiveInputId((currentInputId) =>
					currentInputId?.toLowerCase() === previousInputId.toLowerCase()
						? update.label?.trim() || previousInputId
						: currentInputId,
				);
			}
			setDefinition((current) => updateDocumentDefinitionAt(current, index, update));
			setCheckboxMergeTargetInputId(null);
		},
		[definition.bindings],
	);
	const handleSplitCheckboxOption = useCallback(
		(inputId: string, option: string) => {
			setDefinition((current) => splitCheckboxOption(current, inputId, option, pdfFields));
			setCheckboxMergeTargetInputId(null);
		},
		[pdfFields],
	);
	const handleBeginCheckboxMerge = useCallback((inputId: string) => {
		setCheckboxMergeTargetInputId(inputId);
	}, []);
	const handleCancelCheckboxMerge = useCallback(() => {
		setCheckboxMergeTargetInputId(null);
	}, []);
	const handleSelectCheckboxForMerge = useCallback(
		(index: number) => {
			if (!checkboxMergeTargetInputId) {
				return;
			}
			setDefinition((current) =>
				mergeCheckboxBindingIntoChoice(current, index, checkboxMergeTargetInputId),
			);
			setActiveInputId(checkboxMergeTargetInputId);
			setCheckboxMergeTargetInputId(null);
		},
		[checkboxMergeTargetInputId],
	);

	const handleFieldPreview = useCallback((inputId: string) => {
		setActiveInputId(inputId);
	}, []);
	const handleFieldCardRef = useCallback((inputId: string, node: HTMLDivElement | null) => {
		const inputKey = inputId.toLowerCase();
		if (node) {
			fieldCardRefs.current.set(inputKey, node);
		} else {
			fieldCardRefs.current.delete(inputKey);
		}
	}, []);
	const handlePdfFieldSelect = useCallback(
		(fieldName: string, widgetValue?: string) => {
			const selectedInputId = getInputIdForPdfWidget(
				definition,
				fieldName,
				widgetValue,
				{ includeDisabled: true },
			);
			if (!selectedInputId) {
				return;
			}
			setActiveInputId(selectedInputId);
			requestAnimationFrame(() => {
				fieldCardRefs.current.get(selectedInputId.toLowerCase())?.scrollIntoView({
					block: "nearest",
					inline: "nearest",
				});
			});
		},
		[definition],
	);
	const handleMapToVariable = useCallback((index: number, variable: string) => {
		setDefinition((current) => assignDocumentBindingInput(current, index, variable));
	}, []);

	const canCreatePrivateDocuments = Boolean(editorContext?.canCreatePrivateDocuments);

	const handleVisibilityChange = useCallback(
		(value: string) => {
			if (value === "private" && !canCreatePrivateDocuments) {
				toast.error(USER_MESSAGES.privateDocumentRequiresPlus);
				setVisibility("public");
				return;
			}

			if (DOCUMENT_VISIBILITIES.includes(value as DocumentVisibility)) {
				setVisibility(value as DocumentVisibility);
			}
		},
		[canCreatePrivateDocuments],
	);

	const handleEnhanceWithAi = useCallback(async () => {
		if (!pdfFileBytes) {
			toast.error("Bitte zuerst ein PDF hochladen.");
			return;
		}

		toast.loading("Eingaben werden mit KI verbessert...", { id: "enhance-ai" });
		try {
			const result = await enhanceMutation.mutateAsync({
				fieldDefinitions: definition,
				fileBase64: encodeUint8ArrayToBase64(pdfFileBytes),
			});
			setDefinition(result.fieldDefinitions);
			setActiveInputId((currentInputId) => {
				const matchingInput = result.fieldDefinitions.inputs.find(
					(input) =>
						input.attributes.primary.toLowerCase() === currentInputId?.toLowerCase(),
				);
				return (
					matchingInput?.attributes.primary ??
					result.fieldDefinitions.inputs[0]?.attributes.primary ??
					null
				);
			});
			setCheckboxMergeTargetInputId(null);
			toast.success("Eingaben mit KI verbessert", { id: "enhance-ai" });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unbekannter Fehler";
			toast.error(`Eingaben konnten nicht verbessert werden: ${message}`, {
				id: "enhance-ai",
			});
		}
	}, [definition, enhanceMutation, pdfFileBytes]);

	const handleSave = useCallback(async () => {
		const finalCategory = category === "new" ? newCategory : category;
		if (!title.trim() || !finalCategory.trim()) {
			toast.error("Name und Kategorie sind erforderlich.");
			return;
		}
		if (!pdfFileBytes) {
			toast.error("Bitte ein PDF hochladen.");
			return;
		}

		toast.loading("Dokument wird gespeichert...", { id: "document-save" });
		try {
			if (documentId) {
				const payload = {
					category: finalCategory.trim(),
					fieldDefinitions: definition,
					id: documentId,
					information: information.trim(),
					title: title.trim(),
					visibility,
					...(isPdfReplaced
						? {
								pdfBase64: encodeUint8ArrayToBase64(pdfFileBytes),
							}
						: {}),
				};
				const updatedDocument = await updateMutation.mutateAsync(payload);
				toast.success("Dokument gespeichert", { id: "document-save" });
				router.push(`/documents/${updatedDocument.id}`);
				return;
			}

			const createdDocument = await createMutation.mutateAsync({
				category: finalCategory.trim(),
				fieldDefinitions: definition,
				information: information.trim(),
				pdfBase64: encodeUint8ArrayToBase64(pdfFileBytes),
				title: title.trim(),
				visibility,
			});
			toast.success("Dokument erstellt", { id: "document-save" });
			router.push(`/documents/${createdDocument.id}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unbekannter Fehler";
			toast.error(`Speichern fehlgeschlagen: ${message}`, { id: "document-save" });
		}
	}, [
		category,
		createMutation,
		documentId,
		definition,
		information,
		isPdfReplaced,
		newCategory,
		pdfFileBytes,
		router,
		title,
		updateMutation,
		visibility,
	]);

	const rawCategorySuggestions = editorContext?.categorySuggestions;
	const editorFields = useMemo(
		() => toEditorFieldDefinitions(definition, pdfFields),
		[definition, pdfFields],
	);
	const activePdfFieldHighlights = useMemo(
		() =>
			getPdfFieldHighlightsForInput(definition, pdfFields, activeInputId, {
				includeDisabled: true,
			}),
		[activeInputId, definition, pdfFields],
	);
	const checkboxChoiceInputIds = useMemo(
		() => getCheckboxLikeChoiceInputIds(definition, pdfFields),
		[definition, pdfFields],
	);
	const hasBooleanCheckboxCandidate = editorFields.some(isCheckboxLikeBooleanField);
	const suggestedCategories = useMemo(() => {
		const limit = 10;
		const result: string[] = [];
		const seen = new Set<string>();

		const addCategory = (value: string) => {
			const normalized = value.trim();
			if (!normalized) {
				return;
			}

			const key = normalized.toLowerCase();
			if (seen.has(key)) {
				return;
			}

			seen.add(key);
			result.push(normalized);
		};

		if (category.trim() && category !== "new") {
			addCategory(category);
		}

		for (const value of rawCategorySuggestions ?? []) {
			if (result.length >= limit) {
				break;
			}
			addCategory(value);
		}

		for (const value of FALLBACK_CATEGORIES) {
			if (result.length >= limit) {
				break;
			}
			addCategory(value);
		}

		return result.slice(0, limit);
	}, [category, rawCategorySuggestions]);

	const resolvedCategory = category === "new" ? newCategory : category;
	const isCategoryValid = resolvedCategory.trim() !== "";
	const isNameValid = title.trim() !== "";
	const isNewCategoryValid = newCategory.trim() !== "";
	const isSavePending = createMutation.isPending || updateMutation.isPending;
	const categoryValidationMessage = isCategoryValid ? null : (
		<p className="mt-1 text-solarized-red text-xs">Kategorie ist erforderlich</p>
	);
	const nameValidationMessage = isNameValid ? null : (
		<p className="mt-1 text-solarized-red text-xs">Name ist erforderlich</p>
	);
	const newCategoryValidationMessage = isNewCategoryValid ? null : (
		<p className="mt-1 text-solarized-red text-xs">Neue Kategorie ist erforderlich</p>
	);

	return (
		<div
			className="flex h-[calc(100vh-(--spacing(16))-(--spacing(6)))] min-h-0 w-full flex-col overflow-hidden"
			data-documents-editor-root
		>
			<div className="mb-3 shrink-0 flex items-center justify-between gap-2">
				<h1 className="font-semibold text-lg">{getDocumentEditorTitle(documentId)}</h1>
				<Button disabled={isSavePending} onClick={handleSave}>
					{isSavePending ? "Speichert..." : "Speichern"}
				</Button>
			</div>

			<Card className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden md:grid-cols-[minmax(360px,9fr)_minmax(0,11fr)]">
				<div className="hidden h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-none p-4 md:block">
					<div className="space-y-4">
						<div className="flex flex-wrap items-start gap-2">
							<div className="min-w-0 flex-[1_1_14rem] space-y-2">
								<Label htmlFor="document-category">
									Kategorie <span className="text-solarized-red">*</span>
								</Label>
								<input name="category" type="hidden" value={resolvedCategory} />
								<Select onValueChange={setCategory} value={category}>
									<SelectTrigger
										className={cn(
											FORM_SELECT_TRIGGER_CLASS_NAME,
											isCategoryValid ? "" : "border-solarized-red",
										)}
										id="document-category"
									>
										<SelectValue placeholder="Kategorie auswählen" />
									</SelectTrigger>
									<SelectContent>
										{suggestedCategories.map((categoryOption) => (
											<SelectItem key={categoryOption} value={categoryOption}>
												{categoryOption}
											</SelectItem>
										))}
										<SelectItem value="new">Neue Kategorie hinzufügen</SelectItem>
									</SelectContent>
								</Select>
								{categoryValidationMessage}
							</div>

							<div className="min-w-0 flex-[1_1_14rem] space-y-2">
								<Label htmlFor="document-title">
									Name <span className="text-solarized-red">*</span>
								</Label>
								<Input
									className={cn("min-w-0", isNameValid ? "" : "border-solarized-red")}
									id="document-title"
									onChange={(event) => setTitle(event.target.value)}
									placeholder="Dokumentname eingeben"
									value={title}
								/>
								{nameValidationMessage}
							</div>

							<div className="min-w-0 flex-[1_1_12rem] space-y-2">
								<div className="flex items-center gap-1.5">
									<Label htmlFor="document-visibility">Sichtbarkeit</Label>
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													aria-label="Hinweis zur Sichtbarkeit"
													className="size-4 text-muted-foreground"
													size="icon-xs"
													variant="ghost"
												>
													<InfoIcon className="h-3 w-3" />
												</Button>
											}
										/>
										<TooltipContent align="start" className="max-w-80" side="bottom">
											<div className="space-y-1 text-xs">
												<p>{USER_MESSAGES.publicDocumentVisibilityWarning}</p>
												{canCreatePrivateDocuments ? null : (
													<p>Private Dokumente sind in Plus enthalten.</p>
												)}
											</div>
										</TooltipContent>
									</Tooltip>
								</div>
								<div className="flex items-center gap-2">
									<Select onValueChange={handleVisibilityChange} value={visibility}>
										<SelectTrigger
											className={FORM_SELECT_TRIGGER_CLASS_NAME}
											id="document-visibility"
										>
											<SelectValue>{getDocumentVisibilityLabel(visibility)}</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="public">Öffentlich</SelectItem>
											<SelectItem disabled={canCreatePrivateDocuments === false} value="private">
												Privat
											</SelectItem>
										</SelectContent>
									</Select>
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													aria-label="Eingaben mit KI verbessern"
													disabled={pdfFileBytes ? enhanceMutation.isPending : true}
													onClick={handleEnhanceWithAi}
													size="icon-lg"
													variant="outline"
												>
													<Sparkles className="h-4 w-4" />
												</Button>
											}
										/>
										<TooltipContent side="bottom">
											<span className="text-xs">Eingaben mit KI verbessern</span>
										</TooltipContent>
									</Tooltip>
								</div>
							</div>
						</div>

						{category === "new" ? (
							<div className="space-y-2">
								<Label htmlFor="document-new-category">
									Neue Kategorie <span className="text-solarized-red">*</span>
								</Label>
								<Input
									className={isNewCategoryValid ? "" : "border-solarized-red"}
									id="document-new-category"
									onChange={(event) => setNewCategory(event.target.value)}
									placeholder="Füge eine Kategorie hinzu"
									value={newCategory}
								/>
								{newCategoryValidationMessage}
							</div>
						) : null}

						<div className="space-y-2">
							{definition.bindings.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Noch keine Felder erkannt. Laden Sie ein fillbares PDF hoch.
								</p>
							) : null}
							{editorFields.map((fieldDefinition) => {
								const isCheckboxChoice = checkboxChoiceInputIds.some(
									(inputId) => inputId.toLowerCase() === fieldDefinition.label.toLowerCase(),
								);
								const isCheckboxMergeTarget =
									checkboxMergeTargetInputId?.toLowerCase() === fieldDefinition.label.toLowerCase();
								const isCheckboxMergeCandidate = Boolean(
									checkboxMergeTargetInputId &&
									isCheckboxLikeBooleanField(fieldDefinition),
								);
								return (
									<FieldDefinitionCard
										canAddCheckboxOption={isCheckboxChoice && hasBooleanCheckboxCandidate}
										canManageCheckboxOptions={isCheckboxChoice}
										fieldDefinition={fieldDefinition}
										index={fieldDefinition.bindingIndex}
										inputVariables={definition.inputs
											.filter((input) => toInputKind(input) === fieldDefinition.inputKind)
											.map((input) => input.attributes.primary)}
										isActive={
											activeInputId?.toLowerCase() === fieldDefinition.label.toLowerCase()
										}
										isCheckboxMergeCandidate={isCheckboxMergeCandidate}
										isCheckboxMergeTarget={isCheckboxMergeTarget}
										key={`${fieldDefinition.fieldNames.join("|")}-${fieldDefinition.label}`}
										onBeginCheckboxMerge={handleBeginCheckboxMerge}
										onCancelCheckboxMerge={handleCancelCheckboxMerge}
										onFieldCardRef={handleFieldCardRef}
										onMapToVariable={handleMapToVariable}
										onPreview={handleFieldPreview}
										onSelectCheckboxForMerge={handleSelectCheckboxForMerge}
										onSplitCheckboxOption={handleSplitCheckboxOption}
										onUpdate={handleFieldUpdate}
									/>
								);
							})}
						</div>
					</div>
				</div>

				<DocumentPreviewPane
					activePdfFieldHighlights={activePdfFieldHighlights}
					information={information}
					onClear={handleClearPdf}
					onFieldSelect={handlePdfFieldSelect}
					onFileUpload={handlePdfUpload}
					onInformationChange={setInformation}
					pdfFileBytes={pdfFileBytes}
					pdfFileName={pdfFileName}
				/>
			</Card>
		</div>
	);
}
