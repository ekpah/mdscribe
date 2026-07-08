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
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { InfoIcon, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { PDFUploadSection } from "@/app/documents/_components/pdf-upload-section";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section-dynamic";
import {
	buildDefaultDocumentDefinitionFromPdfFields,
	decodeBase64ToUint8Array,
	encodeUint8ArrayToBase64,
	normalizeDocumentDefinition,
	parsePDFFormFields,
} from "@/app/documents/_lib";
import type { DocumentDefinition, DocumentInputKind, DocumentPdfType } from "@/app/documents/_lib";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

// View-model for the per-PDF-field cards; derived from DocumentDefinition on
// every render and never persisted.
interface EditorFieldRow {
	description: string;
	fieldName: string;
	inputKind: DocumentInputKind;
	isEnabled: boolean;
	label: string;
	markdocType: "Info" | "Switch";
	options: string[];
	pdfType: DocumentPdfType;
	textCheckboxValue?: string;
	valueType: "string" | "number" | "date";
}

const FALLBACK_CATEGORIES = ["Kardiologie", "Gastroenterologie", "Diverses", "Onkologie"] as const;
const COMPACT_FIELD_LABEL_CLASS_NAME = "block truncate text-[11px]";
const COMPACT_INPUT_CLASS_NAME = "h-8 min-w-0 text-xs";
const COMPACT_SELECT_TRIGGER_CLASS_NAME =
	"h-8 w-full min-w-0 rounded-md border-input bg-transparent px-3 text-xs shadow-xs [&>span]:truncate";
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

const isDocumentDefinition = (value: unknown): value is DocumentDefinition =>
	typeof value === "object" &&
	value !== null &&
	"version" in value &&
	(value as { version?: unknown }).version === 2 &&
	"inputTags" in value &&
	"fieldMappings" in value;

const normalizeSavedDocumentDefinition = (value: unknown): DocumentDefinition => {
	try {
		if (isDocumentDefinition(value)) {
			return normalizeDocumentDefinition(value);
		}
		return { fieldMappings: [], inputTags: [], version: 2 };
	} catch (error) {
		console.error("Failed to load document definition:", error);
		return { fieldMappings: [], inputTags: [], version: 2 };
	}
};

const toEditorFieldDefinitions = (definition: DocumentDefinition): EditorFieldRow[] =>
	definition.fieldMappings.map((mapping) => {
		const inputTag = definition.inputTags.find(
			(tag) => tag.attributes.primary.toLowerCase() === mapping.variable.toLowerCase(),
		);
		const isSwitch = inputTag?.name === "Switch";
		let inputKind: DocumentInputKind = "text";
		if (isSwitch) {
			inputKind = inputTag.attributes.type === "boolean" ? "boolean" : "choice";
		}
		return {
			description: inputTag?.name === "Info" ? (inputTag.attributes.description ?? "") : "",
			fieldName: mapping.fieldName,
			inputKind,
			isEnabled: mapping.isEnabled,
			label: mapping.variable,
			markdocType: inputKind === "text" ? "Info" : "Switch",
			options:
				inputTag?.name === "Switch"
					? inputTag.children.map((child) => child.attributes.primary)
					: [],
			pdfType: mapping.pdfType,
			textCheckboxValue:
				mapping.pdfType === "text" && inputKind === "boolean" ? (mapping.value ?? "x") : undefined,
			valueType: inputTag?.name === "Info" ? (inputTag.attributes.type ?? "string") : "string",
		};
	});

const updateDocumentDefinitionAt = (
	definition: DocumentDefinition,
	index: number,
	update: Partial<EditorFieldRow>,
): DocumentDefinition => {
	const mapping = definition.fieldMappings[index];
	if (!mapping) {
		return definition;
	}
	const inputTagIndex = definition.inputTags.findIndex(
		(tag) => tag.attributes.primary.toLowerCase() === mapping.variable.toLowerCase(),
	);
	const currentInputTag = definition.inputTags[inputTagIndex];
	const nextVariable = update.label?.trim() || mapping.variable;
	const nextMappings = definition.fieldMappings.map((currentMapping, mappingIndex) => {
		if (mappingIndex === index) {
			const isTextCheckbox =
				(update.pdfType ?? currentMapping.pdfType) === "text" && update.inputKind === "boolean";
			let mappingValueUpdate = {};
			if (update.textCheckboxValue !== undefined) {
				mappingValueUpdate = {
					condition: currentMapping.condition ?? "true",
					value: update.textCheckboxValue,
				};
			} else if (isTextCheckbox) {
				// This branch only runs when `textCheckboxValue` is undefined (the
				// defined case is handled above), so fall back to the existing value.
				mappingValueUpdate = {
					condition: "true",
					value: currentMapping.value || "x",
				};
			} else if (update.inputKind === "text") {
				mappingValueUpdate = { condition: undefined, value: undefined };
			}
			return {
				...currentMapping,
				...(update.isEnabled === undefined ? {} : { isEnabled: update.isEnabled }),
				...(update.pdfType === undefined ? {} : { pdfType: update.pdfType }),
				...mappingValueUpdate,
				variable: nextVariable,
			};
		}
		return currentMapping.variable.toLowerCase() === mapping.variable.toLowerCase()
			? { ...currentMapping, variable: nextVariable }
			: currentMapping;
	});
	if (!currentInputTag) {
		return { ...definition, fieldMappings: nextMappings };
	}

	let nextInputTag = currentInputTag;
	if (update.inputKind === "boolean") {
		nextInputTag = {
			attributes: { primary: nextVariable, type: "boolean" },
			children: ["true", "false"].map((primary) => ({
				attributes: { primary },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		};
	} else if (update.inputKind === "text") {
		nextInputTag = {
			attributes: {
				primary: nextVariable,
				type:
					update.valueType ??
					(currentInputTag.name === "Info" ? currentInputTag.attributes.type : "string"),
				...(update.description?.trim() ? { description: update.description.trim() } : {}),
			},
			children: [],
			name: "Info",
		};
	} else if (update.inputKind === "choice" && currentInputTag.name === "Info") {
		nextInputTag = {
			attributes: { primary: nextVariable },
			children: (update.options ?? []).map((primary) => ({
				attributes: { primary },
				children: [],
				name: "Case" as const,
			})),
			name: "Switch",
		};
	} else if (currentInputTag.name === "Switch") {
		nextInputTag = {
			...currentInputTag,
			attributes: { ...currentInputTag.attributes, primary: nextVariable },
			children: (
				update.options ?? currentInputTag.children.map((child) => child.attributes.primary)
			).map((primary) => ({ attributes: { primary }, children: [], name: "Case" as const })),
		};
	} else {
		nextInputTag = {
			...currentInputTag,
			attributes: {
				...currentInputTag.attributes,
				...(update.description === undefined
					? {}
					: { description: update.description.trim() || undefined }),
				...(update.valueType === undefined ? {} : { type: update.valueType }),
				primary: nextVariable,
			},
		};
	}

	return {
		...definition,
		fieldMappings: nextMappings,
		inputTags: definition.inputTags.map((inputTag, currentIndex) =>
			currentIndex === inputTagIndex ? nextInputTag : inputTag,
		),
	};
};

const assignDocumentMappingVariable = (
	definition: DocumentDefinition,
	index: number,
	variable: string,
): DocumentDefinition => {
	const mapping = definition.fieldMappings[index];
	if (!mapping || mapping.variable === variable) {
		return definition;
	}
	const fieldMappings = definition.fieldMappings.map((currentMapping, mappingIndex) =>
		mappingIndex === index ? { ...currentMapping, variable } : currentMapping,
	);
	const hasPreviousVariableMapping = fieldMappings.some(
		(currentMapping) => currentMapping.variable.toLowerCase() === mapping.variable.toLowerCase(),
	);
	return {
		...definition,
		fieldMappings,
		inputTags: hasPreviousVariableMapping
			? definition.inputTags
			: definition.inputTags.filter(
					(inputTag) =>
						inputTag.attributes.primary.toLowerCase() !== mapping.variable.toLowerCase(),
				),
	};
};

const getDocumentEditorTitle = (documentId: string | undefined): string => {
	if (documentId) {
		return "Dokument bearbeiten";
	}

	return "Dokument erstellen";
};

interface ParsedFieldMappingResult {
	fieldMapping: {
		description: string;
		fieldName: string;
		label: string;
	}[];
}

const toInputFieldType = (
	fieldDefinition: EditorFieldRow,
): "boolean" | "date" | "number" | "string" | "switch" => {
	if (fieldDefinition.inputKind === "boolean") {
		return "boolean";
	}
	if (fieldDefinition.inputKind === "choice") {
		return "switch";
	}
	return fieldDefinition.valueType;
};

const toEnhancementInputFields = (fieldDefinitions: EditorFieldRow[]) => {
	const inputFields: {
		description?: string;
		label: string;
		options?: string[];
		type: "boolean" | "date" | "number" | "string" | "switch";
	}[] = [];
	const seen = new Set<string>();

	for (const fieldDefinition of fieldDefinitions) {
		const label = fieldDefinition.label.trim();
		if (!label || seen.has(label.toLowerCase())) {
			continue;
		}

		seen.add(label.toLowerCase());
		inputFields.push({
			description: fieldDefinition.description || undefined,
			label,
			options: fieldDefinition.options.length > 0 ? fieldDefinition.options : undefined,
			type: toInputFieldType(fieldDefinition),
		});
	}

	return inputFields;
};

const toFieldMappings = (fieldDefinitions: EditorFieldRow[]) =>
	fieldDefinitions.map((fieldDefinition) => ({
		description: fieldDefinition.description,
		fieldName: fieldDefinition.fieldName,
		inputKind: fieldDefinition.inputKind,
		label: fieldDefinition.label,
		options: fieldDefinition.options,
		pdfType: fieldDefinition.pdfType,
	}));

interface FieldDefinitionCardProps {
	activePdfFieldName: string | null;
	fieldDefinition: EditorFieldRow;
	index: number;
	inputVariables: string[];
	onFieldCardRef: (fieldName: string, node: HTMLDivElement | null) => void;
	onMapToVariable: (index: number, variable: string) => void;
	onPreview: (fieldName: string) => void;
	onUpdate: (index: number, update: Partial<EditorFieldRow>) => void;
}

const FieldDefinitionCard = memo(
	({
		activePdfFieldName,
		fieldDefinition,
		index,
		inputVariables,
		onFieldCardRef,
		onMapToVariable,
		onPreview,
		onUpdate,
	}: FieldDefinitionCardProps) => {
		const isPdfFieldActive = activePdfFieldName === fieldDefinition.fieldName;

		const handlePreview = useCallback(() => {
			onPreview(fieldDefinition.fieldName);
		}, [fieldDefinition.fieldName, onPreview]);

		const handleLabelChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
				onUpdate(index, { label: event.target.value });
			},
			[index, onUpdate],
		);

		const handleVariableMappingChange = useCallback(
			(value: string) => {
				onMapToVariable(index, value);
			},
			[index, onMapToVariable],
		);

		const handleValueTypeChange = useCallback(
			(value: "string" | "number" | "date") => {
				onUpdate(index, { valueType: value });
			},
			[index, onUpdate],
		);

		const handleInputKindChange = useCallback(
			(value: "boolean" | "text") => {
				if (value === "boolean") {
					onUpdate(index, {
						inputKind: "boolean",
						markdocType: "Switch",
						options: ["true", "false"],
						textCheckboxValue: fieldDefinition.textCheckboxValue?.trim() || "x",
						valueType: "string",
					});
					return;
				}

				onUpdate(index, {
					inputKind: "text",
					markdocType: "Info",
					options: [],
					valueType: "string",
				});
			},
			[fieldDefinition.textCheckboxValue, index, onUpdate],
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

		const handleOptionChange = useCallback(
			(optionIndex: number, value: string) => {
				onUpdate(index, {
					options: fieldDefinition.options.map((option, currentIndex) =>
						currentIndex === optionIndex ? value : option,
					),
				});
			},
			[fieldDefinition.options, index, onUpdate],
		);

		const handleTextCheckboxValueChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
				onUpdate(index, { textCheckboxValue: event.target.value });
			},
			[index, onUpdate],
		);

		const canEditInputKind = fieldDefinition.pdfType === "text";
		const isTextBackedCheckbox =
			fieldDefinition.pdfType === "text" && fieldDefinition.inputKind === "boolean";
		const showsEditableOptions =
			fieldDefinition.inputKind === "choice" &&
			fieldDefinition.pdfType === "checkbox" &&
			fieldDefinition.options.length > 0;
		return (
			<Card
				className={cn(
					"group overflow-hidden p-0 transition-[box-shadow,opacity] duration-150",
					isPdfFieldActive ? "ring-2 ring-solarized-orange/70" : "",
				)}
				data-pdf-field-name={fieldDefinition.fieldName}
				onFocusCapture={handlePreview}
				onPointerDownCapture={handlePreview}
				ref={(node) => onFieldCardRef(fieldDefinition.fieldName, node)}
			>
				<div className="grid gap-0 md:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
					<div className="min-w-0 border-border/70 border-b bg-muted/20 p-2 md:border-r md:border-b-0">
						<div className="mb-2 flex items-center justify-between gap-2">
							<p className="font-medium text-muted-foreground text-xs">PDF-Formularfeld</p>
							<Badge className="h-5 px-1.5 font-medium text-[10px]" variant="secondary">
								nicht editierbar
							</Badge>
						</div>

						<div className="space-y-2">
							<div className="min-w-0">
								<p className={META_LABEL_CLASS_NAME}>Name</p>
								<p className={cn(META_VALUE_CLASS_NAME, "font-mono")}>
									{fieldDefinition.fieldName}
								</p>
							</div>
							<div className="min-w-0">
								<p className={META_LABEL_CLASS_NAME}>Typ</p>
								<p className={META_VALUE_CLASS_NAME}>{toPdfTypeLabel(fieldDefinition.pdfType)}</p>
							</div>
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
										onCheckedChange={handleEnabledChange}
									/>
								</div>
							</div>

							<div className="flex flex-wrap items-end gap-1.5">
								<div className="min-w-0 flex-[1_1_10rem] space-y-0.5">
									<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Label</Label>
									<Input
										className={COMPACT_INPUT_CLASS_NAME}
										onChange={handleLabelChange}
										value={fieldDefinition.label}
									/>
								</div>
								<div className="min-w-28 flex-[0_1_9rem] space-y-0.5">
									<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Eingabe-Typ</Label>
									{canEditInputKind ? (
										<Select
											onValueChange={handleInputKindChange}
											value={fieldDefinition.inputKind === "boolean" ? "boolean" : "text"}
										>
											<SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS_NAME}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="text">Text</SelectItem>
												<SelectItem value="boolean">Checkbox</SelectItem>
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
										<SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS_NAME}>
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

							{showsEditableOptions ? (
								<div className="min-w-0 space-y-1">
									<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Optionen</Label>
									<div className="space-y-1">
										{fieldDefinition.options.map((option, optionIndex) => (
											<div
												className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-1.5"
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
											</div>
										))}
									</div>
									{inputVariables.length > 1 ? (
										<div className="min-w-0 space-y-0.5">
											<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>
												Bestehende Eingabe verwenden
											</Label>
											<Select
												onValueChange={handleVariableMappingChange}
												value={fieldDefinition.label}
											>
												<SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS_NAME}>
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
							) : null}
						</div>
					</div>
				</div>
			</Card>
		);
	},
	(previousProps, nextProps) =>
		previousProps.activePdfFieldName === nextProps.activePdfFieldName &&
		previousProps.fieldDefinition === nextProps.fieldDefinition &&
		previousProps.index === nextProps.index,
);

interface DocumentPreviewPaneProps {
	activePdfFieldName: string | null;
	onClear: () => void;
	onFieldSelect: (fieldName: string) => void;
	onFileUpload: (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => Promise<void>;
	pdfFileBytes: Uint8Array | null;
	pdfFileName: string;
}

const DocumentPreviewPane = memo(
	({
		activePdfFieldName,
		onClear,
		onFieldSelect,
		onFileUpload,
		pdfFileBytes,
		pdfFileName,
	}: DocumentPreviewPaneProps) => (
		<div className="col-span-1 flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-t p-4 md:border-t-0 md:border-l">
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
					activeFieldName={activePdfFieldName}
					hasUploadedFile={Boolean(pdfFileBytes)}
					onFieldSelect={onFieldSelect}
					pdfFile={pdfFileBytes}
				/>
			</div>
		</div>
	),
);

FieldDefinitionCard.displayName = "FieldDefinitionCard";
DocumentPreviewPane.displayName = "DocumentPreviewPane";

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
	const [newCategory, setNewCategory] = useState("");
	const [pdfFileBytes, setPdfFileBytes] = useState<Uint8Array | null>(null);
	const [pdfFileName, setPdfFileName] = useState("document.pdf");
	const [isPdfReplaced, setIsPdfReplaced] = useState(false);
	const [definition, setDefinition] = useState<DocumentDefinition>({
		fieldMappings: [],
		inputTags: [],
		version: 2,
	});
	const [activePdfFieldName, setActivePdfFieldName] = useState<string | null>(null);
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

	useEffect(() => {
		if (initializedRef.current || !sourceDocument) {
			return;
		}

		setTitle(sourceDocument.title);
		setCategory(sourceDocument.category);
		setVisibility(sourceDocument.visibility === "private" ? "private" : "public");
		const savedDefinition = normalizeSavedDocumentDefinition(sourceDocument.fieldDefinitions);
		if (savedDefinition.fieldMappings.length > 0) {
			setDefinition(savedDefinition);
			setActivePdfFieldName(savedDefinition.fieldMappings[0]?.fieldName ?? null);
		}
		initializedRef.current = true;
	}, [sourceDocument]);

	useEffect(() => {
		if (!sourceDocument || isPdfReplaced) {
			return;
		}
		setPdfFileName(`${sourceDocument.title}.pdf`);
	}, [isPdfReplaced, sourceDocument]);

	useEffect(() => {
		if (!sourceDocumentPdf?.pdfBase64 || isPdfReplaced || pdfFileBytes) {
			return;
		}
		if (sourceDocumentId && sourceDocumentPdf.id !== sourceDocumentId) {
			return;
		}

		setPdfFileBytes(decodeBase64ToUint8Array(sourceDocumentPdf.pdfBase64));
	}, [isPdfReplaced, pdfFileBytes, sourceDocumentId, sourceDocumentPdf]);

	const createMutation = useMutation(orpc.documents.templates.create.mutationOptions());
	const updateMutation = useMutation(orpc.documents.templates.update.mutationOptions());
	const enhanceMutation = useMutation(orpc.documents.parseForm.mutationOptions());

	const handlePdfUpload = useCallback(
		async (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => {
			setPdfFileBytes(file);
			setPdfFileName(fileMeta.name);
			setIsPdfReplaced(true);

			const { fields } = await parsePDFFormFields(file);
			setDefinition(buildDefaultDocumentDefinitionFromPdfFields(fields));
			setActivePdfFieldName(fields[0]?.name ?? null);
		},
		[],
	);

	const handleClearPdf = useCallback(() => {
		setPdfFileBytes(null);
		setDefinition({ fieldMappings: [], inputTags: [], version: 2 });
		setActivePdfFieldName(null);
		setPdfFileName("document.pdf");
		setIsPdfReplaced(true);
	}, []);

	const handleFieldUpdate = useCallback((index: number, update: Partial<EditorFieldRow>) => {
		setDefinition((current) => updateDocumentDefinitionAt(current, index, update));
	}, []);

	const handleFieldPreview = useCallback((fieldName: string) => {
		setActivePdfFieldName(fieldName);
	}, []);
	const handleFieldCardRef = useCallback((fieldName: string, node: HTMLDivElement | null) => {
		if (node) {
			fieldCardRefs.current.set(fieldName, node);
			return;
		}
		fieldCardRefs.current.delete(fieldName);
	}, []);
	const handlePdfFieldSelect = useCallback((fieldName: string) => {
		setActivePdfFieldName(fieldName);
		requestAnimationFrame(() => {
			fieldCardRefs.current.get(fieldName)?.scrollIntoView({
				block: "nearest",
				inline: "nearest",
			});
		});
	}, []);
	const handleMapToVariable = useCallback((index: number, variable: string) => {
		setDefinition((current) => assignDocumentMappingVariable(current, index, variable));
	}, []);
	const inputVariables = useMemo(
		() => definition.inputTags.map((inputTag) => inputTag.attributes.primary),
		[definition.inputTags],
	);

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
			const result = (await enhanceMutation.mutateAsync({
				fieldMappings: toFieldMappings(toEditorFieldDefinitions(definition)),
				fileBase64: encodeUint8ArrayToBase64(pdfFileBytes),
				inputFields: toEnhancementInputFields(toEditorFieldDefinitions(definition)),
			})) as ParsedFieldMappingResult;

			const aiByFieldName = new Map(
				result.fieldMapping.map((fieldMapping) => [fieldMapping.fieldName, fieldMapping]),
			);
			setDefinition((current) => {
				let nextDefinition = current;
				for (const [index, mapping] of current.fieldMappings.entries()) {
					const aiField = aiByFieldName.get(mapping.fieldName);
					if (aiField) {
						nextDefinition = updateDocumentDefinitionAt(nextDefinition, index, {
							description: aiField.description,
							label: aiField.label,
						});
					}
				}
				return nextDefinition;
			});
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
		isPdfReplaced,
		newCategory,
		pdfFileBytes,
		router,
		title,
		updateMutation,
		visibility,
	]);

	const rawCategorySuggestions = editorContext?.categorySuggestions;
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
							{definition.fieldMappings.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Noch keine Felder erkannt. Laden Sie ein fillbares PDF hoch.
								</p>
							) : null}
							{toEditorFieldDefinitions(definition).map((fieldDefinition, index) => (
								<FieldDefinitionCard
									activePdfFieldName={activePdfFieldName}
									fieldDefinition={fieldDefinition}
									index={index}
									inputVariables={inputVariables}
									onFieldCardRef={handleFieldCardRef}
									key={fieldDefinition.fieldName}
									onMapToVariable={handleMapToVariable}
									onPreview={handleFieldPreview}
									onUpdate={handleFieldUpdate}
								/>
							))}
						</div>
					</div>
				</div>

				<DocumentPreviewPane
					activePdfFieldName={activePdfFieldName}
					onClear={handleClearPdf}
					onFieldSelect={handlePdfFieldSelect}
					onFileUpload={handlePdfUpload}
					pdfFileBytes={pdfFileBytes}
					pdfFileName={pdfFileName}
				/>
			</Card>
		</div>
	);
}
