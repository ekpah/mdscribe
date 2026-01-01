"use client";

import Inputs from "@repo/design-system/components/inputs/Inputs";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { fillPDFForm } from "../_lib/fillPDFForm";
import {
	type FieldMapping,
	type PDFField,
	convertPDFFieldsToInputTags,
	parsePDFFormFields,
} from "../_lib/parsePDFFormFields";
import PDFDebugPanel from "./PDFDebugPanel";
import PDFUploadSection from "./PDFUploadSection";

const PDFViewSection = dynamic(() => import("./PDFViewSection"), {
	ssr: false,
});

export default function PDFFormSection() {
	const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);
	const [fieldMapping, setFieldMapping] = useState<FieldMapping[]>([]);
	const [fields, setFields] = useState<PDFField[]>([]);
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [filledPdf, setFilledPdf] = useState<Uint8Array | null>(null);

	// Use oRPC mutation for AI enhancement
	const enhanceMutation = useMutation(
		orpc.documents.parseForm.mutationOptions({
			onSuccess: (data) => {
				setFieldMapping(data.fieldMapping);
				toast.success("Eingaben mit KI verbessert", { id: "enhance-ai" });
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Unbekannter Fehler aufgetreten";
				toast.error(
					`Eingaben konnten nicht verbessert werden: ${errorMessage}`,
					{ id: "enhance-ai" },
				);
			},
		}),
	);

	const handleClearDocument = () => {
		setPdfFile(null);
		setFieldMapping([]);
		setFields([]);
		setFieldValues({});
		setFilledPdf(null);
	};
	const { inputTags } = convertPDFFieldsToInputTags(fields, fieldMapping);
	const handleFileUpload = async (file: Uint8Array) => {
		setPdfFile(file);

		// get form fields from pdf
		const { fields } = await parsePDFFormFields(file);
		setFields(fields);
		// set initial field mapping, changes with every change of fields
		setFieldMapping(
			fields.map((field) => ({
				fieldName: field.name,
				label: field.name,
				description: "",
			})),
		);
	};

	const handleInputChange = async (values: Record<string, unknown>) => {
		setFieldValues(values);
	};

	const handleFillPdf = async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}
		const filledPdfResult = await fillPDFForm(
			pdfFile,
			fieldValues,
			fieldMapping,
		);
		setFilledPdf(filledPdfResult);
		toast.success("PDF-Formular ausgefüllt");
	};

	const copyInputTagsToClipboard = () => {
		navigator.clipboard.writeText(JSON.stringify(fieldMapping, null, 2));
		toast.success("Eingabe-Tags in Zwischenablage kopiert");
	};

	const handleEnhanceWithAI = async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}

		// Convert Uint8Array to base64
		const base64 = btoa(String.fromCharCode(...pdfFile));

		toast.loading("Eingaben werden mit KI verbessert...", {
			id: "enhance-ai",
		});

		enhanceMutation.mutate({
			fileBase64: base64,
			fieldMapping,
		});
	};

	return (
		<>
			<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
				<div
					className="hidden overflow-y-auto overscroll-none p-4 md:block"
					key="Inputs"
				>
					<div className="mb-4 flex flex-col gap-2">
						<Button onClick={handleFillPdf}>PDF ausfüllen</Button>
						<Button
							onClick={handleEnhanceWithAI}
							disabled={!pdfFile}
							variant="outline"
						>
							Eingaben mit KI verbessern
						</Button>
						<Button onClick={copyInputTagsToClipboard} variant="outline">
							Eingabe-Tags in Zwischenablage kopieren
						</Button>
					</div>
					<Inputs inputTags={inputTags} onChange={handleInputChange} />
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
			<PDFDebugPanel values={fieldValues} fieldMapping={fieldMapping} />
		</>
	);
}
