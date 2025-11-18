"use client";

/**
 * CreateDocumentSection - Document Creation with Field Mapping Editor
 * 
 * This component provides an interface for creating documents by:
 * 1. Uploading PDF forms with fillable fields
 * 2. Editing field mappings (fieldName, label, description, types)
 * 3. Reordering fields via drag-and-drop
 * 4. AI-enhanced field mapping suggestions
 * 5. Real-time PDF preview
 * 
 * The InputEditor (left panel) shows editable field mappings where users can:
 * - Change field names (keys)
 * - Edit labels (display names)
 * - Add descriptions
 * - Select Markdoc type (Info or Switch)
 * - Select PDF field type (text, multiline, dropdown, checkbox, radio)
 * - Reorder fields by dragging
 * 
 * The right panel displays the uploaded PDF and filled PDF preview.
 */

import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import dynamic from "next/dynamic";
import { useState } from "react";
import toast from "react-hot-toast";
import { fillPDFForm } from "../../_lib/fillPDFForm";
import {
	type FieldMapping,
	type PDFField,
	parsePDFFormFields,
} from "../../_lib/parsePDFFormFields";
import PDFDebugPanel from "../../_components/PDFDebugPanel";
import PDFUploadSection from "../../_components/PDFUploadSection";
import InputEditor from "./InputEditor";

const PDFViewSection = dynamic(() => import("../../_components/PDFViewSection"), {
	ssr: false,
});

export interface EnhancedFieldMapping extends FieldMapping {
	pdfType: PDFField["type"];
	markdocType: "Info" | "Switch";
}

export default function CreateDocumentSection() {
	const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);
	const [fieldMappings, setFieldMappings] = useState<EnhancedFieldMapping[]>([]);
	const [fields, setFields] = useState<PDFField[]>([]);
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [filledPdf, setFilledPdf] = useState<Uint8Array | null>(null);

	const handleClearDocument = () => {
		setPdfFile(null);
		setFieldMappings([]);
		setFields([]);
		setFieldValues({});
		setFilledPdf(null);
	};

	const handleFileUpload = async (file: Uint8Array) => {
		setPdfFile(file);

		// get form fields from pdf
		const { fields } = await parsePDFFormFields(file);
		setFields(fields);
		
		// set initial field mapping with enhanced properties
		setFieldMappings(
			fields.map((field) => ({
				fieldName: field.name,
				label: field.name,
				description: "",
				pdfType: field.type,
				markdocType: determineMarkdocType(field.type),
			})),
		);
	};

	const determineMarkdocType = (pdfType: PDFField["type"]): "Info" | "Switch" => {
		// Checkbox, dropdown, and radio become Switch
		if (pdfType === "checkbox" || pdfType === "dropdown" || pdfType === "radio") {
			return "Switch";
		}
		// Text and multiline become Info
		return "Info";
	};

	const handleFillPdf = async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}
		const filledPdfResult = await fillPDFForm(
			pdfFile,
			fieldValues,
			fieldMappings,
		);
		setFilledPdf(filledPdfResult);
		toast.success("PDF-Formular ausgefüllt");
	};

	const handleFieldMappingsChange = (newMappings: EnhancedFieldMapping[]) => {
		setFieldMappings(newMappings);
	};

	const handleEnhanceWithAI = async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}

		try {
			// Convert Uint8Array to File for FormData
			const arrayBuffer = pdfFile.buffer.slice(
				pdfFile.byteOffset,
				pdfFile.byteOffset + pdfFile.byteLength,
			) as ArrayBuffer;
			const blob = new Blob([arrayBuffer], { type: "application/pdf" });
			const file = new File([blob], "document.pdf", {
				type: "application/pdf",
			});

			const formData = new FormData();
			formData.append("file", file);
			formData.append("fieldMapping", JSON.stringify(fieldMappings));
			toast.loading("Eingaben werden mit KI verbessert...", {
				id: "enhance-ai",
			});

			const response = await fetch("/api/documents/parse-form", {
				method: "POST",
				body: formData,
			});
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					errorText || "Eingaben konnten nicht verbessert werden",
				);
			}
			const data = await response.json();
			
			// Update field mappings with AI-enhanced version, preserving other fields
			const enhancedMappings = data.fieldMapping.map((aiMapping: FieldMapping) => {
				const existing = fieldMappings.find(fm => fm.fieldName === aiMapping.fieldName);
				return {
					...aiMapping,
					pdfType: existing?.pdfType || "text",
					markdocType: existing?.markdocType || "Info",
				};
			});
			setFieldMappings(enhancedMappings);

			toast.success("Eingaben mit KI verbessert", { id: "enhance-ai" });
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unbekannter Fehler aufgetreten";
			toast.error(`Eingaben konnten nicht verbessert werden: ${errorMessage}`, {
				id: "enhance-ai",
			});
		}
	};

	return (
		<>
			<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
				<div
					className="hidden overflow-y-auto overscroll-none p-4 md:block"
					key="InputEditor"
				>
					<div className="mb-4 flex flex-col gap-2">
						<Button onClick={handleFillPdf} disabled={!pdfFile}>
							PDF ausfüllen
						</Button>
						<Button
							onClick={handleEnhanceWithAI}
							disabled={!pdfFile}
							variant="outline"
						>
							Eingaben mit KI verbessern
						</Button>
					</div>
					<InputEditor 
						fieldMappings={fieldMappings}
						onFieldMappingsChange={handleFieldMappingsChange}
					/>
				</div>
				<div
					className="col-span-3 flex flex-col overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
					key="Preview"
				>
					<PDFUploadSection
						onFileUpload={handleFileUpload}
						onClear={handleClearDocument}
						pdfFile={pdfFile}
					/>
					<div className="mt-4 flex-1">
						<PDFViewSection
							pdfFile={filledPdf ?? pdfFile}
							hasUploadedFile={Boolean(pdfFile)}
						/>
					</div>
				</div>
			</Card>
			<PDFDebugPanel values={fieldValues} fieldMapping={fieldMappings} />
		</>
	);
}
