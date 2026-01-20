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
import { useState } from "react";
import type { EnhancedFieldMapping } from "./CreateDocumentSection";

interface InputEditorProps {
	fieldMappings: EnhancedFieldMapping[];
	onFieldMappingsChange: (mappings: EnhancedFieldMapping[]) => void;
}

export default function InputEditor({
	fieldMappings,
	onFieldMappingsChange,
}: InputEditorProps) {
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

	const handleDragStart = (index: number) => {
		setDraggedIndex(index);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		setDraggedOverIndex(index);
	};

	const handleDrop = (e: React.DragEvent, dropIndex: number) => {
		e.preventDefault();
		
		if (draggedIndex === null || draggedIndex === dropIndex) {
			setDraggedIndex(null);
			setDraggedOverIndex(null);
			return;
		}

		const newMappings = [...fieldMappings];
		const [draggedItem] = newMappings.splice(draggedIndex, 1);
		newMappings.splice(dropIndex, 0, draggedItem);

		onFieldMappingsChange(newMappings);
		setDraggedIndex(null);
		setDraggedOverIndex(null);
	};

	const handleDragEnd = () => {
		setDraggedIndex(null);
		setDraggedOverIndex(null);
	};

	const handleFieldChange = (
		index: number,
		field: keyof EnhancedFieldMapping,
		value: string,
	) => {
		const newMappings = [...fieldMappings];
		newMappings[index] = {
			...newMappings[index],
			[field]: value,
		};
		onFieldMappingsChange(newMappings);
	};

	const handleDeleteField = (index: number) => {
		const newMappings = fieldMappings.filter((_, i) => i !== index);
		onFieldMappingsChange(newMappings);
	};

	const handleAddField = () => {
		const newMapping: EnhancedFieldMapping = {
			fieldName: `field_${fieldMappings.length + 1}`,
			label: `Field ${fieldMappings.length + 1}`,
			description: "",
			pdfType: "text",
			markdocType: "Info",
		};
		onFieldMappingsChange([...fieldMappings, newMapping]);
	};

	if (fieldMappings.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
				<p>Keine Felder zum Bearbeiten.</p>
				<p className="text-sm">
					Laden Sie eine PDF-Datei hoch oder fügen Sie manuell Felder hinzu.
				</p>
				<Button onClick={handleAddField} variant="outline" size="sm">
					Feld hinzufügen
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p className="text-muted-foreground text-sm">
					Ziehen Sie die Felder, um sie neu anzuordnen. 
					Bearbeiten Sie die Eigenschaften jedes Feldes.
				</p>
				<Button onClick={handleAddField} variant="outline" size="sm" className="w-full">
					Feld hinzufügen
				</Button>
			</div>
			
			{fieldMappings.map((mapping, index) => (
				<Card
					key={`${mapping.fieldName}-${index}`}
					draggable
					onDragStart={() => handleDragStart(index)}
					onDragOver={(e) => handleDragOver(e, index)}
					onDrop={(e) => handleDrop(e, index)}
					onDragEnd={handleDragEnd}
					className={`cursor-move transition-all ${
						draggedIndex === index
							? "scale-95 opacity-50"
							: draggedOverIndex === index
								? "border-2 border-solarized-blue bg-solarized-blue/5"
								: ""
					}`}
				>
					<CardContent className="p-4">
						<div className="space-y-3">
							{/* Drag Handle and Delete Button */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<GripVertical className="h-5 w-5 text-muted-foreground" />
									<span className="font-semibold text-sm">
										Feld {index + 1}
									</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDeleteField(index)}
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
									onChange={(e) =>
										handleFieldChange(index, "fieldName", e.target.value)
									}
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
									onChange={(e) =>
										handleFieldChange(index, "label", e.target.value)
									}
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
									onChange={(e) =>
										handleFieldChange(index, "description", e.target.value)
									}
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
									<Select
										value={mapping.markdocType}
										onValueChange={(value) =>
											handleFieldChange(
												index,
												"markdocType",
												value as "Info" | "Switch",
											)
										}
									>
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
									<Select
										value={mapping.pdfType}
										onValueChange={(value) =>
											handleFieldChange(index, "pdfType", value)
										}
									>
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
			))}
		</div>
	);
}
