"use client";

import {
	DndContext,
	DragOverlay,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
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
import { GripVertical, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createPortal } from "react-dom";
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

interface EditableFieldConnection {
	description: string;
	isEnabled: boolean;
	label: string;
	valueType: DocumentFieldDefinition["valueType"];
}

interface ParsedFieldMappingResult {
	fieldMapping: Array<{
		description: string;
		fieldName: string;
		label: string;
	}>;
}

const toEditableConnection = (
	fieldDefinition: DocumentFieldDefinition,
): EditableFieldConnection => ({
	description: fieldDefinition.description,
	isEnabled: fieldDefinition.isEnabled,
	label: fieldDefinition.label,
	valueType: fieldDefinition.valueType,
});

const swapFieldDefinitionConnections = (
	fieldDefinitions: DocumentFieldDefinition[],
	firstIndex: number,
	secondIndex: number,
): DocumentFieldDefinition[] => {
	if (
		firstIndex < 0 ||
		secondIndex < 0 ||
		firstIndex >= fieldDefinitions.length ||
		secondIndex >= fieldDefinitions.length ||
		firstIndex === secondIndex
	) {
		return fieldDefinitions;
	}

	const nextFieldDefinitions = [...fieldDefinitions];
	const firstFieldDefinition = nextFieldDefinitions[firstIndex];
	const secondFieldDefinition = nextFieldDefinitions[secondIndex];
	if (!firstFieldDefinition || !secondFieldDefinition) {
		return fieldDefinitions;
	}

	nextFieldDefinitions[firstIndex] = {
		...firstFieldDefinition,
		...toEditableConnection(secondFieldDefinition),
	};
	nextFieldDefinitions[secondIndex] = {
		...secondFieldDefinition,
		...toEditableConnection(firstFieldDefinition),
	};

	return nextFieldDefinitions;
};

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
	activeDragFieldInputKind: DocumentFieldDefinition["inputKind"] | null;
	activeDragFieldPdfType: DocumentFieldDefinition["pdfType"] | null;
	activeDragFieldSlotId: string | null;
	activePdfFieldName: string | null;
	fieldDefinition: DocumentFieldDefinition;
	fieldSlotId: string;
	index: number;
	onPreview: (fieldName: string) => void;
	onUpdate: (index: number, update: Partial<DocumentFieldDefinition>) => void;
}

const FieldDefinitionCard = memo(
	({
		activeDragFieldInputKind,
		activeDragFieldPdfType,
		activeDragFieldSlotId,
		activePdfFieldName,
		fieldDefinition,
		fieldSlotId,
		index,
		onPreview,
		onUpdate,
	}: FieldDefinitionCardProps) => {
		const canAcceptDrop =
			activeDragFieldPdfType === null ||
			(activeDragFieldPdfType === fieldDefinition.pdfType &&
				activeDragFieldInputKind === fieldDefinition.inputKind);
		const isPdfFieldActive = activePdfFieldName === fieldDefinition.fieldName;

		const {
			attributes,
			listeners,
			setNodeRef: setDraggableRef,
			isDragging,
		} = useDraggable({
			data: {
				index,
				inputKind: fieldDefinition.inputKind,
				pdfType: fieldDefinition.pdfType,
			},
			id: fieldSlotId,
		});
		const { isOver, setNodeRef: setDroppableRef } = useDroppable({
			data: {
				index,
				inputKind: fieldDefinition.inputKind,
				pdfType: fieldDefinition.pdfType,
			},
			disabled: !canAcceptDrop,
			id: fieldSlotId,
		});

		const setMappingRef = useCallback(
			(node: HTMLDivElement | null) => {
				setDraggableRef(node);
				setDroppableRef(node);
			},
			[setDraggableRef, setDroppableRef],
		);

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

		const isDropzoneActive =
			Boolean(activeDragFieldSlotId) && activeDragFieldSlotId !== fieldSlotId && canAcceptDrop;
		const showsEditableOptions =
			fieldDefinition.inputKind === "choice" &&
			fieldDefinition.pdfType === "checkbox" &&
			fieldDefinition.options.length > 0;

		return (
			<Card
				className={cn(
					"group p-1.5 transition-[box-shadow,opacity] duration-150",
					isPdfFieldActive ? "ring-2 ring-solarized-orange/70" : "",
				)}
				onFocusCapture={handlePreview}
				onPointerDownCapture={handlePreview}
			>
				<div className="flex flex-wrap gap-2">
					<div className="min-w-0 flex-[1_1_18rem] space-y-1">
						<div className="grid grid-cols-[minmax(0,1fr)_max-content] items-end gap-1.5">
							<div className="min-w-0 space-y-0.5">
								<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Name</Label>
								<Input
									className="h-7 min-w-0 font-mono text-xs"
									disabled
									value={fieldDefinition.fieldName}
								/>
							</div>
							<div className="space-y-0.5">
								<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Typ</Label>
								<div className="flex h-7 items-center">
									<Badge className="h-5 px-1.5 font-medium text-[10px]" variant="secondary">
										{toPdfTypeLabel(fieldDefinition.pdfType)}
									</Badge>
								</div>
							</div>
						</div>
					</div>

					<div
						className={cn(
							"min-w-0 flex-[2_1_22rem] rounded-md bg-muted/40 p-2 transition-[box-shadow,opacity] duration-150",
							isDragging ? "opacity-35" : "",
							Boolean(activeDragFieldSlotId) && !canAcceptDrop ? "opacity-60" : "",
							isDropzoneActive ? "ring-1 ring-dashed ring-muted-foreground/30" : "",
							isOver ? "ring-2 ring-solarized-orange/60" : "",
						)}
						ref={setMappingRef}
					>
						<div className="space-y-1">
							<div className="flex items-center justify-between gap-2">
								<button
									className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
									type="button"
									{...listeners}
									{...attributes}
								>
									<GripVertical className="h-3.5 w-3.5" />
									<span className="sr-only">Label-Zuordnung verschieben</span>
								</button>
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
									<Input
										className={COMPACT_INPUT_CLASS_NAME}
										disabled
										value={fieldDefinition.markdocType}
									/>
								</div>
							</div>

							{fieldDefinition.markdocType === "Info" ? (
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
		previousProps.activeDragFieldInputKind === nextProps.activeDragFieldInputKind &&
		previousProps.activeDragFieldPdfType === nextProps.activeDragFieldPdfType &&
		previousProps.activeDragFieldSlotId === nextProps.activeDragFieldSlotId &&
		previousProps.activePdfFieldName === nextProps.activePdfFieldName &&
		previousProps.fieldDefinition === nextProps.fieldDefinition &&
		previousProps.fieldSlotId === nextProps.fieldSlotId &&
		previousProps.index === nextProps.index,
);

interface DocumentPreviewPaneProps {
	activePdfFieldName: string | null;
	onClear: () => void;
	onFileUpload: (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => Promise<void>;
	pdfFileBytes: Uint8Array | null;
	pdfFileName: string;
}

const DragPreviewFieldCard = ({
	fieldDefinition,
}: {
	fieldDefinition: DocumentFieldDefinition;
}) => (
	<div className="w-[min(20rem,96vw)] rounded-md border border-solarized-orange/30 bg-muted/40 p-2 shadow-lg">
		<div className="space-y-1">
			<div className="flex items-center justify-between gap-2">
				<div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground">
					<GripVertical className="h-3.5 w-3.5" />
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<span className="text-muted-foreground text-xs">Aktiv</span>
					<Switch checked={fieldDefinition.isEnabled} disabled />
				</div>
			</div>
			<div className="flex flex-wrap items-end gap-1.5">
				<div className="min-w-0 flex-[1_1_10rem] space-y-0.5">
					<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Label</Label>
					<Input className="h-7 min-w-0" disabled value={fieldDefinition.label} />
				</div>
				<div className="min-w-28 flex-[0_1_9rem] space-y-0.5">
					<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Eingabe-Typ</Label>
					<Input
						className={COMPACT_INPUT_CLASS_NAME}
						disabled
						value={fieldDefinition.markdocType}
					/>
				</div>
			</div>
			{fieldDefinition.markdocType === "Info" ? (
				<div className="min-w-0 space-y-0.5">
					<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Wertetyp</Label>
					<Input className={COMPACT_INPUT_CLASS_NAME} disabled value={fieldDefinition.valueType} />
				</div>
			) : null}
			{fieldDefinition.markdocType === "Info" && fieldDefinition.description ? (
				<div className="min-w-0 space-y-0.5">
					<Label className={COMPACT_FIELD_LABEL_CLASS_NAME}>Beschreibung</Label>
					<Input className="h-7 min-w-0" disabled value={fieldDefinition.description} />
				</div>
			) : null}
		</div>
	</div>
);

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
	const fieldListScrollContainerRef = useRef<HTMLDivElement | null>(null);

	const [title, setTitle] = useState("");
	const [category, setCategory] = useState("");
	const [newCategory, setNewCategory] = useState("");
	const [pdfFileBytes, setPdfFileBytes] = useState<Uint8Array | null>(null);
	const [pdfFileName, setPdfFileName] = useState("document.pdf");
	const [isPdfReplaced, setIsPdfReplaced] = useState(false);
	const [fieldDefinitions, setFieldDefinitions] = useState<DocumentFieldDefinition[]>([]);
	const [activeDragFieldSlotId, setActiveDragFieldSlotId] = useState<string | null>(null);
	const [activePdfFieldName, setActivePdfFieldName] = useState<string | null>(null);
	const [isDragOverlayReady, setIsDragOverlayReady] = useState(false);

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
		if (Array.isArray(sourceDocument.fieldDefinitions)) {
			setFieldDefinitions(sourceDocument.fieldDefinitions as DocumentFieldDefinition[]);
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
		setIsDragOverlayReady(true);
	}, []);

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

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 6 },
		}),
	);

	const fieldSlotIds = useMemo(
		() => fieldDefinitions.map((_fieldDefinition, index) => `field-slot-${index}`),
		[fieldDefinitions],
	);

	const activeDragFieldIndex = useMemo(() => {
		if (!activeDragFieldSlotId) {
			return -1;
		}
		return fieldSlotIds.indexOf(activeDragFieldSlotId);
	}, [activeDragFieldSlotId, fieldSlotIds]);

	const activeDragFieldDefinition =
		activeDragFieldIndex >= 0 ? fieldDefinitions[activeDragFieldIndex] : null;
	const activeDragFieldInputKind = activeDragFieldDefinition?.inputKind ?? null;
	const activeDragFieldPdfType = activeDragFieldDefinition?.pdfType ?? null;

	const handleDragStart = useCallback((event: DragStartEvent) => {
		setActiveDragFieldSlotId(String(event.active.id));
	}, []);

	const handleDragCancel = useCallback(() => {
		setActiveDragFieldSlotId(null);
	}, []);

	const handleDragEnd = useCallback((event: DragEndEvent) => {
		setActiveDragFieldSlotId(null);

		const activeIndex = event.active.data.current?.index;
		const overIndex = event.over?.data.current?.index;
		const activeInputKind = event.active.data.current?.inputKind;
		const overInputKind = event.over?.data.current?.inputKind;
		const activePdfType = event.active.data.current?.pdfType;
		const overPdfType = event.over?.data.current?.pdfType;
		if (
			typeof activeIndex !== "number" ||
			typeof overIndex !== "number" ||
			typeof activeInputKind !== "string" ||
			typeof overInputKind !== "string" ||
			typeof activePdfType !== "string" ||
			typeof overPdfType !== "string" ||
			activeInputKind !== overInputKind ||
			activePdfType !== overPdfType ||
			activeIndex === overIndex
		) {
			return;
		}

		setFieldDefinitions((current) =>
			swapFieldDefinitionConnections(current, activeIndex, overIndex),
		);
	}, []);

	const canAutoScrollFieldList = useCallback(
		(element: Element) => element === fieldListScrollContainerRef.current,
		[],
	);

	const handleEnhanceWithAi = useCallback(async () => {
		if (!pdfFileBytes) {
			toast.error("Bitte zuerst ein PDF hochladen.");
			return;
		}

		toast.loading("Eingaben werden mit KI verbessert...", { id: "enhance-ai" });
		try {
			const result = (await enhanceMutation.mutateAsync({
				fieldMapping: fieldDefinitions.map((fieldDefinition) => ({
					description: fieldDefinition.description,
					fieldName: fieldDefinition.fieldName,
					inputKind: fieldDefinition.inputKind,
					label: fieldDefinition.label,
					options: fieldDefinition.options,
					pdfType: fieldDefinition.pdfType,
				})),
				fileBase64: encodeUint8ArrayToBase64(pdfFileBytes),
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

							<div className="shrink-0 pt-7">
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

					<div
						className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-none p-4 pt-4"
						ref={fieldListScrollContainerRef}
					>
						<DndContext
							autoScroll={{
								canScroll: canAutoScrollFieldList,
								enabled: true,
							}}
							onDragCancel={handleDragCancel}
							onDragEnd={handleDragEnd}
							onDragStart={handleDragStart}
							sensors={sensors}
						>
							<div className="space-y-2">
								{fieldDefinitions.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										Noch keine Felder erkannt. Laden Sie ein fillbares PDF hoch.
									</p>
								) : null}
								{fieldDefinitions.map((fieldDefinition, index) => {
									const fieldSlotId = fieldSlotIds[index];
									if (!fieldSlotId) {
										return null;
									}

									return (
										<FieldDefinitionCard
											activeDragFieldInputKind={activeDragFieldInputKind}
											activeDragFieldPdfType={activeDragFieldPdfType}
											activeDragFieldSlotId={activeDragFieldSlotId}
											activePdfFieldName={activePdfFieldName}
											fieldDefinition={fieldDefinition}
											fieldSlotId={fieldSlotId}
											index={index}
											onPreview={handleFieldPreview}
											key={fieldSlotId}
											onUpdate={handleFieldUpdate}
										/>
									);
								})}
							</div>
							{isDragOverlayReady
								? createPortal(
										<DragOverlay>
											{activeDragFieldDefinition ? (
												<DragPreviewFieldCard fieldDefinition={activeDragFieldDefinition} />
											) : null}
										</DragOverlay>,
										document.body,
									)
								: null}
						</DndContext>
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
