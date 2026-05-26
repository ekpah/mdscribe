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
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { PDFUploadSection } from "@/app/documents/_components/pdf-upload-section";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section-dynamic";
import {
	buildDefaultFieldDefinitionsFromPdfFields,
	decodeBase64ToUint8Array,
	encodeUint8ArrayToBase64,
	parsePDFFormFields,
} from "@/app/documents/_lib";
import type { DocumentFieldDefinition } from "@/app/documents/_lib";
import { orpc } from "@/lib/orpc";

const FALLBACK_CATEGORIES = ["Kardiologie", "Gastroenterologie", "Diverses", "Onkologie"] as const;
const COMPACT_FIELD_LABEL_CLASS_NAME = "block truncate text-[11px]";
const COMPACT_INPUT_CLASS_NAME = "h-7 min-w-0 text-xs";
const COMPACT_SELECT_TRIGGER_CLASS_NAME = "h-7 min-w-0 overflow-hidden text-xs [&>span]:truncate";
const META_LABEL_CLASS_NAME =
	"text-muted-foreground text-[10px] uppercase leading-none tracking-normal";
const META_VALUE_CLASS_NAME = "mt-1 min-w-0 truncate font-medium text-xs";

const toPdfTypeLabel = (pdfType: DocumentFieldDefinition["pdfType"]): string => {
	switch (pdfType) {
		case "text":
			return "Text";
		case "multiline":
			return "Mehrzeilig";
		case "dropdown":
			return "Dropdown";
		case "checkbox":
			return "Checkbox";
		case "radio":
			return "Radio";
		default:
			return pdfType;
	}
};

const toInputKindLabel = (inputKind: DocumentFieldDefinition["inputKind"]): string => {
	switch (inputKind) {
		case "boolean":
			return "Checkbox";
		case "choice":
			return "Auswahl";
		case "text":
			return "Text";
		default:
			return inputKind;
	}
};

const isDocumentInputKind = (value: unknown): value is DocumentFieldDefinition["inputKind"] =>
	value === "boolean" || value === "choice" || value === "text";

const isDocumentMarkdocType = (value: unknown): value is DocumentFieldDefinition["markdocType"] =>
	value === "Info" || value === "Switch";

const isDocumentPdfType = (value: unknown): value is DocumentFieldDefinition["pdfType"] =>
	value === "checkbox" ||
	value === "dropdown" ||
	value === "multiline" ||
	value === "radio" ||
	value === "text";

const isDocumentValueType = (value: unknown): value is DocumentFieldDefinition["valueType"] =>
	value === "date" || value === "number" || value === "string";

const normalizeSavedFieldDefinition = (value: unknown): DocumentFieldDefinition | null => {
	if (!value || typeof value !== "object") {
		return null;
	}

	const field = value as Partial<DocumentFieldDefinition>;
	const fieldName = typeof field.fieldName === "string" ? field.fieldName.trim() : "";
	if (!fieldName) {
		return null;
	}

	const inputKind = isDocumentInputKind(field.inputKind) ? field.inputKind : "text";
	const pdfType = isDocumentPdfType(field.pdfType) ? field.pdfType : "text";
	const isSwitch = inputKind !== "text";
	const rawOptions = Array.isArray(field.options) ? field.options : [];
	const options =
		inputKind === "boolean"
			? ["true", "false"]
			: isSwitch
				? rawOptions.filter((option): option is string => typeof option === "string")
				: [];
	const textCheckboxValue =
		pdfType === "text" && inputKind === "boolean"
			? field.textCheckboxValue?.trim() || "x"
			: field.textCheckboxValue;

	return {
		description: typeof field.description === "string" ? field.description : "",
		fieldName,
		inputKind,
		isEnabled: field.isEnabled ?? true,
		label: typeof field.label === "string" && field.label.trim() ? field.label : fieldName,
		markdocType:
			isDocumentMarkdocType(field.markdocType) &&
			field.markdocType === (isSwitch ? "Switch" : "Info")
				? field.markdocType
				: isSwitch
					? "Switch"
					: "Info",
		maxLength:
			typeof field.maxLength === "number" && field.maxLength > 0 ? field.maxLength : undefined,
		options,
		pdfType,
		textCheckboxValue,
		valueType: isSwitch
			? "string"
			: isDocumentValueType(field.valueType)
				? field.valueType
				: "string",
	};
};

const normalizeSavedFieldDefinitions = (value: unknown): DocumentFieldDefinition[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((field) => {
		const normalized = normalizeSavedFieldDefinition(field);
		return normalized ? [normalized] : [];
	});
};

interface ParsedFieldMappingResult {
	fieldMapping: Array<{
		description: string;
		fieldName: string;
		label: string;
	}>;
}

const toInputFieldType = (
	fieldDefinition: DocumentFieldDefinition,
): "boolean" | "date" | "number" | "string" | "switch" => {
	if (fieldDefinition.inputKind === "boolean") {
		return "boolean";
	}
	if (fieldDefinition.inputKind === "choice") {
		return "switch";
	}
	return fieldDefinition.valueType;
};

const toEnhancementInputFields = (fieldDefinitions: DocumentFieldDefinition[]) => {
	const inputFields: Array<{
		description?: string;
		label: string;
		options?: string[];
		type: "boolean" | "date" | "number" | "string" | "switch";
	}> = [];
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

const toFieldMappings = (fieldDefinitions: DocumentFieldDefinition[]) =>
	fieldDefinitions.map((fieldDefinition) => ({
		description: fieldDefinition.description,
		fieldName: fieldDefinition.fieldName,
		inputKind: fieldDefinition.inputKind,
		label: fieldDefinition.label,
		options: fieldDefinition.options,
		pdfType: fieldDefinition.pdfType,
	}));

const updateFieldDefinitionAt = (
	fieldDefinitions: DocumentFieldDefinition[],
	index: number,
	update: Partial<DocumentFieldDefinition>,
): DocumentFieldDefinition[] => {
	const nextFieldDefinitions = [...fieldDefinitions];
	const currentFieldDefinition = nextFieldDefinitions[index];
	if (!currentFieldDefinition) {
		return fieldDefinitions;
	}

	nextFieldDefinitions[index] = {
		...currentFieldDefinition,
		...update,
	};
	return nextFieldDefinitions;
};

interface FieldDefinitionCardProps {
	activePdfFieldName: string | null;
	fieldDefinition: DocumentFieldDefinition;
	index: number;
	onPreview: (fieldName: string) => void;
	onUpdate: (index: number, update: Partial<DocumentFieldDefinition>) => void;
}

const FieldDefinitionCard = memo(
	({
		activePdfFieldName,
		fieldDefinition,
		index,
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
		const maxLengthLabel =
			fieldDefinition.maxLength === undefined
				? "Keine Begrenzung"
				: `${fieldDefinition.maxLength} Zeichen`;

		return (
			<Card
				className={cn(
					"group overflow-hidden p-0 transition-[box-shadow,opacity] duration-150",
					isPdfFieldActive ? "ring-2 ring-solarized-orange/70" : "",
				)}
				onFocusCapture={handlePreview}
				onPointerDownCapture={handlePreview}
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
							<div className="grid grid-cols-2 gap-2">
								<div className="min-w-0">
									<p className={META_LABEL_CLASS_NAME}>Typ</p>
									<p className={META_VALUE_CLASS_NAME}>{toPdfTypeLabel(fieldDefinition.pdfType)}</p>
								</div>
								<div className="min-w-0">
									<p className={META_LABEL_CLASS_NAME}>Zeichenlimit</p>
									<p className={META_VALUE_CLASS_NAME}>{maxLengthLabel}</p>
								</div>
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
										className="h-7 min-w-0"
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
										className="h-7 min-w-0"
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
										className="h-7 min-w-0"
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
													className="h-7 min-w-0 text-xs"
													onChange={(event) => handleOptionChange(optionIndex, event.target.value)}
													value={option}
												/>
											</div>
										))}
									</div>
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
	onFileUpload: (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => Promise<void>;
	pdfFileBytes: Uint8Array | null;
	pdfFileName: string;
}

const DocumentPreviewPane = memo(
	({
		activePdfFieldName,
		onClear,
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
	const initializedRef = useRef(false);

	const [title, setTitle] = useState("");
	const [category, setCategory] = useState("");
	const [newCategory, setNewCategory] = useState("");
	const [pdfFileBytes, setPdfFileBytes] = useState<Uint8Array | null>(null);
	const [pdfFileName, setPdfFileName] = useState("document.pdf");
	const [isPdfReplaced, setIsPdfReplaced] = useState(false);
	const [fieldDefinitions, setFieldDefinitions] = useState<DocumentFieldDefinition[]>([]);
	const [activePdfFieldName, setActivePdfFieldName] = useState<string | null>(null);

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
		const savedFieldDefinitions = normalizeSavedFieldDefinitions(sourceDocument.fieldDefinitions);
		if (savedFieldDefinitions.length > 0) {
			setFieldDefinitions(savedFieldDefinitions);
			setActivePdfFieldName(savedFieldDefinitions[0]?.fieldName ?? null);
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
			setFieldDefinitions(buildDefaultFieldDefinitionsFromPdfFields(fields));
			setActivePdfFieldName(fields[0]?.name ?? null);
		},
		[],
	);

	const handleClearPdf = useCallback(() => {
		setPdfFileBytes(null);
		setFieldDefinitions([]);
		setActivePdfFieldName(null);
		setPdfFileName("document.pdf");
		setIsPdfReplaced(true);
	}, []);

	const handleFieldUpdate = useCallback(
		(index: number, update: Partial<DocumentFieldDefinition>) => {
			setFieldDefinitions((current) => updateFieldDefinitionAt(current, index, update));
		},
		[],
	);

	const handleFieldPreview = useCallback((fieldName: string) => {
		setActivePdfFieldName(fieldName);
	}, []);

	const handleEnhanceWithAi = useCallback(async () => {
		if (!pdfFileBytes) {
			toast.error("Bitte zuerst ein PDF hochladen.");
			return;
		}

		toast.loading("Eingaben werden mit KI verbessert...", { id: "enhance-ai" });
		try {
			const result = (await enhanceMutation.mutateAsync({
				fieldMappings: toFieldMappings(fieldDefinitions),
				fileBase64: encodeUint8ArrayToBase64(pdfFileBytes),
				inputFields: toEnhancementInputFields(fieldDefinitions),
			})) as ParsedFieldMappingResult;

			const aiByFieldName = new Map(
				result.fieldMapping.map((fieldMapping) => [fieldMapping.fieldName, fieldMapping]),
			);
			setFieldDefinitions((current) =>
				current.map((fieldDefinition) => {
					const aiField = aiByFieldName.get(fieldDefinition.fieldName);
					if (!aiField) {
						return fieldDefinition;
					}
					return {
						...fieldDefinition,
						description: aiField.description,
						label: aiField.label,
					};
				}),
			);
			toast.success("Eingaben mit KI verbessert", { id: "enhance-ai" });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unbekannter Fehler";
			toast.error(`Eingaben konnten nicht verbessert werden: ${message}`, {
				id: "enhance-ai",
			});
		}
	}, [enhanceMutation, fieldDefinitions, pdfFileBytes]);

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
					fieldDefinitions,
					id: documentId,
					title: title.trim(),
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
				fieldDefinitions,
				pdfBase64: encodeUint8ArrayToBase64(pdfFileBytes),
				title: title.trim(),
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
		fieldDefinitions,
		isPdfReplaced,
		newCategory,
		pdfFileBytes,
		router,
		title,
		updateMutation,
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
	const isSavePending = createMutation.isPending || updateMutation.isPending;

	return (
		<div
			className="flex h-[calc(100vh-(--spacing(16))-(--spacing(6)))] min-h-0 w-full flex-col overflow-hidden"
			data-documents-editor-root
		>
			<div className="mb-3 shrink-0 flex items-center justify-between gap-2">
				<h1 className="font-semibold text-lg">
					{documentId ? "Dokument bearbeiten" : "Dokument erstellen"}
				</h1>
				<Button disabled={isSavePending} onClick={handleSave}>
					{isSavePending ? "Speichert..." : "Speichern"}
				</Button>
			</div>

			<Card className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden md:grid-cols-[minmax(360px,9fr)_minmax(0,11fr)]">
				<div className="hidden h-full min-h-0 min-w-0 overflow-hidden md:flex md:flex-col">
					<div className="shrink-0 space-y-4 p-4 pb-0">
						<div className="flex flex-wrap items-start gap-2">
							<div className="min-w-0 flex-[1_1_14rem] space-y-2">
								<Label htmlFor="document-category">
									Kategorie <span className="text-solarized-red">*</span>
								</Label>
								<input name="category" type="hidden" value={resolvedCategory} />
								<Select onValueChange={setCategory} value={category}>
									<SelectTrigger
										className={cn(
											"min-w-0 overflow-hidden [&>span]:truncate",
											!isCategoryValid ? "border-solarized-red" : "",
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
								{!isCategoryValid ? (
									<p className="mt-1 text-solarized-red text-xs">Kategorie ist erforderlich</p>
								) : null}
							</div>

							<div className="min-w-0 flex-[1_1_14rem] space-y-2">
								<Label htmlFor="document-title">
									Name <span className="text-solarized-red">*</span>
								</Label>
								<Input
									className={cn("min-w-0", !isNameValid ? "border-solarized-red" : "")}
									id="document-title"
									onChange={(event) => setTitle(event.target.value)}
									placeholder="Dokumentname eingeben"
									value={title}
								/>
								{!isNameValid ? (
									<p className="mt-1 text-solarized-red text-xs">Name ist erforderlich</p>
								) : null}
							</div>

							<div className="shrink-0 self-end">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											aria-label="Eingaben mit KI verbessern"
											disabled={!pdfFileBytes || enhanceMutation.isPending}
											onClick={handleEnhanceWithAi}
											size="icon"
											variant="outline"
										>
											<Sparkles className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left">
										<span className="text-xs">Eingaben mit KI verbessern</span>
									</TooltipContent>
								</Tooltip>
							</div>
						</div>

						{category === "new" ? (
							<div className="space-y-2">
								<Label htmlFor="document-new-category">
									Neue Kategorie <span className="text-solarized-red">*</span>
								</Label>
								<Input
									className={!newCategory.trim() ? "border-solarized-red" : ""}
									id="document-new-category"
									onChange={(event) => setNewCategory(event.target.value)}
									placeholder="Füge eine Kategorie hinzu"
									value={newCategory}
								/>
								{!newCategory.trim() ? (
									<p className="mt-1 text-solarized-red text-xs">Neue Kategorie ist erforderlich</p>
								) : null}
							</div>
						) : null}
					</div>

					<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-none p-4 pt-4">
						<div className="space-y-2">
							{fieldDefinitions.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Noch keine Felder erkannt. Laden Sie ein fillbares PDF hoch.
								</p>
							) : null}
							{fieldDefinitions.map((fieldDefinition, index) => (
								<FieldDefinitionCard
									activePdfFieldName={activePdfFieldName}
									fieldDefinition={fieldDefinition}
									index={index}
									key={fieldDefinition.fieldName}
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
					onFileUpload={handlePdfUpload}
					pdfFileBytes={pdfFileBytes}
					pdfFileName={pdfFileName}
				/>
			</Card>
		</div>
	);
}
