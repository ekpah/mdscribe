"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { GripVertical, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

import type { EnhancedFieldMapping } from "./create-document-section";

interface InputEditorProps {
	fieldMappings: EnhancedFieldMapping[];
	onFieldMappingsChange: (mappings: EnhancedFieldMapping[]) => void;
}

interface FieldMappingCardProps {
	mapping: EnhancedFieldMapping;
	index: number;
	draggedIndex: number | null;
	draggedOverIndex: number | null;
	onDragStart: (index: number) => void;
	onDragOver: (event: DragEvent<HTMLDivElement>, index: number) => void;
	onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
	onDragEnd: () => void;
	onDeleteField: (index: number) => void;
	onFieldChange: (index: number, field: keyof EnhancedFieldMapping, value: string) => void;
}

const getCardDragClass = (
	index: number,
	draggedIndex: number | null,
	draggedOverIndex: number | null,
) => {
	if (draggedIndex === index) {
		return "scale-95 opacity-50";
	}
	if (draggedOverIndex === index) {
		return "border-2 border-solarized-blue bg-solarized-blue/5";
	}
	return "";
};

const reorderFieldMappings = (
	fieldMappings: EnhancedFieldMapping[],
	draggedIndex: number | null,
	dropIndex: number,
): EnhancedFieldMapping[] | null => {
	if (draggedIndex === null || draggedIndex === dropIndex) {
		return null;
	}

	const nextMappings = [...fieldMappings];
	const [draggedItem] = nextMappings.splice(draggedIndex, 1);
	nextMappings.splice(dropIndex, 0, draggedItem);
	return nextMappings;
};

const createNewFieldMapping = (currentCount: number): EnhancedFieldMapping => ({
	description: "",
	fieldName: `field_${currentCount + 1}`,
	inputKind: "text",
	label: `Field ${currentCount + 1}`,
	markdocType: "Info",
	options: [],
	pdfType: "text",
});

const FieldMappingCard = ({
	mapping,
	index,
	draggedIndex,
	draggedOverIndex,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	onDeleteField,
	onFieldChange,
}: FieldMappingCardProps) => {
	const handlers = useMemo(
		() => ({
			handleCardDragOver: (event: DragEvent<HTMLDivElement>) => {
				onDragOver(event, index);
			},
			handleCardDragStart: () => {
				onDragStart(index);
			},
			handleCardDrop: (event: DragEvent<HTMLDivElement>) => {
				onDrop(event, index);
			},
			handleDeleteClick: () => {
				onDeleteField(index);
			},
			handleDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
				onFieldChange(index, "description", event.target.value);
			},
			handleFieldNameChange: (event: ChangeEvent<HTMLInputElement>) => {
				onFieldChange(index, "fieldName", event.target.value);
			},
			handleLabelChange: (event: ChangeEvent<HTMLInputElement>) => {
				onFieldChange(index, "label", event.target.value);
			},
			handleMarkdocTypeChange: (value: string) => {
				onFieldChange(index, "markdocType", value as "Info" | "Switch");
			},
			handlePdfTypeChange: (value: string) => {
				onFieldChange(index, "pdfType", value);
			},
		}),
		[index, onDeleteField, onDragOver, onDragStart, onDrop, onFieldChange],
	);
	const cardDragClass = getCardDragClass(index, draggedIndex, draggedOverIndex);

	return (
		<Card
			key={`${mapping.fieldName}-${index}`}
			draggable
			onDragStart={handlers.handleCardDragStart}
			onDragOver={handlers.handleCardDragOver}
			onDrop={handlers.handleCardDrop}
			onDragEnd={onDragEnd}
			className={`cursor-move transition-all ${cardDragClass}`}
		>
			<CardContent className="p-4">
				<div className="space-y-3">
					{/* Drag Handle and Delete Button */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<GripVertical className="h-5 w-5 text-muted-foreground" />
							<span className="font-semibold text-sm">Feld {index + 1}</span>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={handlers.handleDeleteClick}
							className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
							type="button"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>

					{/* Field Name */}
					<div className="space-y-1">
						<Label htmlFor={`fieldName-${index}`} className="text-xs">
							Feldname (Key)
						</Label>
						<Input
							id={`fieldName-${index}`}
							value={mapping.fieldName}
							onChange={handlers.handleFieldNameChange}
							className="font-mono text-sm"
							placeholder="field_name"
						/>
					</div>

					{/* Label */}
					<div className="space-y-1">
						<Label htmlFor={`label-${index}`} className="text-xs">
							Label (Anzeigename)
						</Label>
						<Input
							id={`label-${index}`}
							value={mapping.label}
							onChange={handlers.handleLabelChange}
							className="text-sm"
							placeholder="Anzeigename"
						/>
					</div>

					{/* Description */}
					<div className="space-y-1">
						<Label htmlFor={`description-${index}`} className="text-xs">
							Beschreibung
						</Label>
						<Textarea
							id={`description-${index}`}
							value={mapping.description}
							onChange={handlers.handleDescriptionChange}
							className="min-h-[60px] resize-none text-sm"
							placeholder="Optionale Beschreibung"
						/>
					</div>

					{/* Type Selectors */}
					<div className="grid grid-cols-2 gap-3">
						{/* Markdoc Type */}
						<div className="space-y-1">
							<Label htmlFor={`markdocType-${index}`} className="text-xs">
								Markdoc-Typ
							</Label>
							<Select value={mapping.markdocType} onValueChange={handlers.handleMarkdocTypeChange}>
								<SelectTrigger id={`markdocType-${index}`} className="text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="Info">Info</SelectItem>
									<SelectItem value="Switch">Switch</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* PDF Type */}
						<div className="space-y-1">
							<Label htmlFor={`pdfType-${index}`} className="text-xs">
								PDF-Feldtyp
							</Label>
							<Select value={mapping.pdfType} onValueChange={handlers.handlePdfTypeChange}>
								<SelectTrigger id={`pdfType-${index}`} className="text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="text">Text</SelectItem>
									<SelectItem value="multiline">Multiline</SelectItem>
									<SelectItem value="dropdown">Dropdown</SelectItem>
									<SelectItem value="checkbox">Checkbox</SelectItem>
									<SelectItem value="radio">Radio</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

const InputEditor = ({ fieldMappings, onFieldMappingsChange }: InputEditorProps) => {
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

	const handleDragStart = useCallback((index: number) => {
		setDraggedIndex(index);
	}, []);

	const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
		e.preventDefault();
		setDraggedOverIndex(index);
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>, dropIndex: number) => {
			e.preventDefault();
			const reorderedMappings = reorderFieldMappings(fieldMappings, draggedIndex, dropIndex);
			if (!reorderedMappings) {
				setDraggedIndex(null);
				setDraggedOverIndex(null);
				return;
			}

			onFieldMappingsChange(reorderedMappings);
			setDraggedIndex(null);
			setDraggedOverIndex(null);
		},
		[draggedIndex, fieldMappings, onFieldMappingsChange],
	);

	const handleDragEnd = useCallback(() => {
		setDraggedIndex(null);
		setDraggedOverIndex(null);
	}, []);

	const mappingHandlers = useMemo(
		() => ({
			handleAddField: () => {
				const newMapping = createNewFieldMapping(fieldMappings.length);
				onFieldMappingsChange([...fieldMappings, newMapping]);
			},
			handleDeleteField: (index: number) => {
				const newMappings = fieldMappings.filter((_, i) => i !== index);
				onFieldMappingsChange(newMappings);
			},
			handleFieldChange: (index: number, field: keyof EnhancedFieldMapping, value: string) => {
				const newMappings = [...fieldMappings];
				newMappings[index] = {
					...newMappings[index],
					[field]: value,
				};
				onFieldMappingsChange(newMappings);
			},
		}),
		[fieldMappings, onFieldMappingsChange],
	);

	if (fieldMappings.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
				<p>Keine Felder zum Bearbeiten.</p>
				<p className="text-sm">
					Laden Sie eine PDF-Datei hoch oder fügen Sie manuell Felder hinzu.
				</p>
				<Button onClick={mappingHandlers.handleAddField} variant="outline" size="sm">
					Feld hinzufügen
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p className="text-muted-foreground text-sm">
					Ziehen Sie die Felder, um sie neu anzuordnen. Bearbeiten Sie die Eigenschaften jedes
					Feldes.
				</p>
				<Button
					onClick={mappingHandlers.handleAddField}
					variant="outline"
					size="sm"
					className="w-full"
				>
					Feld hinzufügen
				</Button>
			</div>

			{fieldMappings.map((mapping, index) => (
				<FieldMappingCard
					key={mapping.fieldName}
					mapping={mapping}
					index={index}
					draggedIndex={draggedIndex}
					draggedOverIndex={draggedOverIndex}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onDragEnd={handleDragEnd}
					onDeleteField={mappingHandlers.handleDeleteField}
					onFieldChange={mappingHandlers.handleFieldChange}
				/>
			))}
		</div>
	);
};

export default InputEditor;
