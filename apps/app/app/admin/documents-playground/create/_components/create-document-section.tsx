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
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import PDFDebugPanel from "@/app/admin/documents-playground/_components/pdf-debug-panel";
import { PDFUploadSection } from "@/app/documents/_components/pdf-upload-section";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section-dynamic";
import { encodeUint8ArrayToBase64, fillPDFForm, parsePDFFormFields } from "@/app/documents/_lib";
import type { DocumentFieldDefinition, DocumentPdfType } from "@/app/documents/_lib";
import { orpc } from "@/lib/orpc";

import InputEditor from "./input-editor";

export interface EnhancedFieldMapping {
	description: string;
	fieldName: string;
	label: string;
	markdocType: "Info" | "Switch";
	pdfType: DocumentPdfType;
}

type AiFieldMapping = {
	description: string;
	fieldName: string;
	label: string;
};

type ParseFormResult = {
	fieldMapping: AiFieldMapping[];
};

const determineMarkdocType = (pdfType: DocumentPdfType): "Info" | "Switch" => {
	// Checkbox, dropdown, and radio become Switch
	if (pdfType === "checkbox" || pdfType === "dropdown" || pdfType === "radio") {
		return "Switch";
	}
	// Text and multiline become Info
	return "Info";
};

const buildEnhancedMapping = (
	aiMapping: AiFieldMapping,
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

const toDocumentFieldDefinitions = (
	fieldMappings: EnhancedFieldMapping[],
): DocumentFieldDefinition[] =>
	fieldMappings.map((fieldMapping) => ({
		description: fieldMapping.description,
		fieldName: fieldMapping.fieldName,
		isEnabled: true,
		label: fieldMapping.label,
		markdocType: fieldMapping.markdocType,
		options: fieldMapping.pdfType === "checkbox" ? ["true", "false"] : [],
		pdfType: fieldMapping.pdfType,
		valueType: "string",
	}));

export default function CreateDocumentSection() {
	const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);
	const [pdfFileName, setPdfFileName] = useState<string>("document.pdf");
	const [fieldMappings, setFieldMappings] = useState<EnhancedFieldMapping[]>([]);
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [filledPdf, setFilledPdf] = useState<Uint8Array | null>(null);

	const enhanceMutation = useMutation(
		orpc.documents.parseForm.mutationOptions({
			onError: (error) => {
				const errorMessage =
					error instanceof Error ? error.message : "Unbekannter Fehler aufgetreten";
				toast.error(`Eingaben konnten nicht verbessert werden: ${errorMessage}`, {
					id: "enhance-ai",
				});
			},
			onSuccess: (data) => {
				const parsedData = data as ParseFormResult;
				setFieldMappings(
					parsedData.fieldMapping.map((aiMapping) =>
						buildEnhancedMapping(aiMapping, fieldMappings),
					),
				);
				toast.success("Eingaben mit KI verbessert", { id: "enhance-ai" });
			},
		}),
	);

	const handleClearDocument = useCallback(() => {
		setPdfFile(null);
		setPdfFileName("document.pdf");
		setFieldMappings([]);
		setFieldValues({});
		setFilledPdf(null);
	}, []);

	const handleFileUpload = useCallback(
		async (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => {
			setPdfFile(file);
			setPdfFileName(fileMeta.name);

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
		},
		[],
	);

	const handleFillPdf = useCallback(async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}
		const filledPdfResult = await fillPDFForm(
			pdfFile,
			fieldValues,
			toDocumentFieldDefinitions(fieldMappings),
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

		enhanceMutation.mutate({
			fieldMapping: fieldMappings.map((fieldMapping) => ({
				description: fieldMapping.description,
				fieldName: fieldMapping.fieldName,
				label: fieldMapping.label,
				pdfType: fieldMapping.pdfType,
			})),
			fileBase64: encodeUint8ArrayToBase64(pdfFile),
		});
	}, [enhanceMutation, fieldMappings, pdfFile]);

	return (
		<>
			<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
				<div className="hidden overflow-y-auto overscroll-none p-4 md:block" key="InputEditor">
					<div className="mb-4 flex flex-col gap-2">
						<Button onClick={handleFillPdf} disabled={!pdfFile}>
							PDF ausfüllen
						</Button>
						<Button onClick={handleEnhanceWithAI} disabled={!pdfFile} variant="outline">
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
						pdfFileName={pdfFileName}
					/>
					<div className="mt-4 flex-1">
						<PDFViewSection pdfFile={filledPdf ?? pdfFile} hasUploadedFile={Boolean(pdfFile)} />
					</div>
				</div>
			</Card>
			<PDFDebugPanel values={fieldValues} fieldMapping={fieldMappings} />
		</>
	);
}
