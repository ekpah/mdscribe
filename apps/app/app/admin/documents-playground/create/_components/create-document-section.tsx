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
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { fillPDFForm } from "@/app/admin/documents-playground/_lib/fill-pdf-form";
import { parsePDFFormFields } from "@/app/admin/documents-playground/_lib/parse-pdf-form-fields";
import type { FieldMapping, PDFField } from "@/app/admin/documents-playground/_lib/parse-pdf-form-fields";
import PDFDebugPanel from "@/app/admin/documents-playground/_components/pdf-debug-panel";
import PDFUploadSection from "@/app/admin/documents-playground/_components/pdf-upload-section";
import InputEditor from "./input-editor";

const PDFViewSection = dynamic(() => import("@/app/admin/documents-playground/_components/pdf-view-section"), {
	ssr: false,
});

export interface EnhancedFieldMapping extends FieldMapping {
	pdfType: PDFField["type"];
	markdocType: "Info" | "Switch";
}

const determineMarkdocType = (pdfType: PDFField["type"]): "Info" | "Switch" => {
	// Checkbox, dropdown, and radio become Switch
	if (pdfType === "checkbox" || pdfType === "dropdown" || pdfType === "radio") {
		return "Switch";
	}
	// Text and multiline become Info
	return "Info";
};

const buildEnhancedMapping = (
	aiMapping: FieldMapping,
	existingMappings: EnhancedFieldMapping[],
): EnhancedFieldMapping => {
	const existing = existingMappings.find(
		(fieldMapping) => fieldMapping.fieldName === aiMapping.fieldName,
	);
	return {
		...aiMapping,
		markdocType: existing?.markdocType || "Info",
		pdfType: existing?.pdfType || "text",
	};
};

const toPdfBlob = (pdfFile: Uint8Array): Blob => {
	const arrayBuffer = pdfFile.buffer.slice(
		pdfFile.byteOffset,
		pdfFile.byteOffset + pdfFile.byteLength,
	) as ArrayBuffer;
	return new Blob([arrayBuffer], { type: "application/pdf" });
};

const createEnhanceFormData = (
	pdfFile: Uint8Array,
	fieldMappings: EnhancedFieldMapping[],
) => {
	const file = new File([toPdfBlob(pdfFile)], "document.pdf", {
		type: "application/pdf",
	});
	const formData = new FormData();
	formData.append("file", file);
	formData.append("fieldMapping", JSON.stringify(fieldMappings));
	return formData;
};

const requestEnhancedMappings = async (
	formData: FormData,
): Promise<{ fieldMapping: FieldMapping[] }> => {
	const response = await fetch("/api/documents/parse-form", {
		body: formData,
		method: "POST",
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(errorText || "Eingaben konnten nicht verbessert werden");
	}
	return response.json();
};

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Unbekannter Fehler aufgetreten";

export default function CreateDocumentSection() {
	const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);
	const [fieldMappings, setFieldMappings] = useState<EnhancedFieldMapping[]>([]);
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [filledPdf, setFilledPdf] = useState<Uint8Array | null>(null);

	const handleClearDocument = useCallback(() => {
		setPdfFile(null);
		setFieldMappings([]);
		setFieldValues({});
		setFilledPdf(null);
	}, []);

	const handleFileUpload = useCallback(async (file: Uint8Array) => {
		setPdfFile(file);

		// get form fields from pdf
		const { fields: parsedFields } = await parsePDFFormFields(file);
		
		// set initial field mapping with enhanced properties
		setFieldMappings(
			parsedFields.map((field) => ({
				description: "",
				fieldName: field.name,
				label: field.name,
				markdocType: determineMarkdocType(field.type),
				pdfType: field.type,
			})),
		);
	}, []);

	const handleFillPdf = useCallback(async () => {
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
	}, [pdfFile, fieldMappings, fieldValues]);

	const handleFieldMappingsChange = useCallback((newMappings: EnhancedFieldMapping[]) => {
		setFieldMappings(newMappings);
	}, []);

	const handleEnhanceWithAI = useCallback(async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}

		toast.loading("Eingaben werden mit KI verbessert...", {
			id: "enhance-ai",
		});
		try {
			const formData = createEnhanceFormData(pdfFile, fieldMappings);
			const data = await requestEnhancedMappings(formData);
			setFieldMappings(
				data.fieldMapping.map((aiMapping) =>
					buildEnhancedMapping(aiMapping, fieldMappings),
				),
			);

			toast.success("Eingaben mit KI verbessert", { id: "enhance-ai" });
		} catch (error) {
			toast.error(
				`Eingaben konnten nicht verbessert werden: ${toErrorMessage(error)}`,
				{ id: "enhance-ai" },
			);
		}
	}, [fieldMappings, pdfFile]);

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
