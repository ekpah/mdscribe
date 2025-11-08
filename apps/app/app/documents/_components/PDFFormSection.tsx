"use client";

import Inputs from "@repo/design-system/components/inputs/Inputs";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import type { InputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import dynamic from "next/dynamic";
import { useState } from "react";
import { fillPDFForm } from "../_lib/fillPDFForm";
import {
	type FieldMapping,
	type PDFField,
	convertPDFFieldsToInputTags,
	parsePDFFormFields,
} from "../_lib/parsePDFFormFields";
import PDFDebugPanel from "./PDFDebugPanel";
import PDFUploadSection from "./PDFUploadSection";
import toast from "react-hot-toast";

const PDFViewSection = dynamic(() => import("./PDFViewSection"), {
	ssr: false,
});

export default function PDFFormSection() {
	const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);

	const [fieldMapping, setFieldMapping] = useState<FieldMapping[]>([]);
	const [fields, setFields] = useState<PDFField[]>([]);
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});

	const [filledPdf, setFilledPdf] = useState<Uint8Array | null>(null);

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
			toast.error("No PDF file selected");
			return;
		}
		const filledPdfResult = await fillPDFForm(
			pdfFile,
			fieldValues,
			fieldMapping,
		);
		setFilledPdf(filledPdfResult);
		toast.success("PDF form filled");
	};

	const copyInputTagsToClipboard = () => {
		navigator.clipboard.writeText(JSON.stringify(fieldMapping, null, 2));
		toast.success("Input tags copied to clipboard");
	};

	const handleEnhanceWithAI = async () => {
		if (!pdfFile) {
			toast.error("No PDF file selected");
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
			formData.append("fieldMapping", JSON.stringify(fieldMapping));
			toast.loading("Enhancing inputs with AI...", { id: "enhance-ai" });

			const response = await fetch("/api/documents/parse-form", {
				method: "POST",
				body: formData,
			});
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(errorText || "Failed to enhance inputs");
			}
			const data = await response.json();
			// Update field mapping with AI-enhanced version
			setFieldMapping(data.fieldMapping);

			toast.success("Inputs enhanced with AI", { id: "enhance-ai" });
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			toast.error(`Failed to enhance inputs: ${errorMessage}`, {
				id: "enhance-ai",
			});
		}
	};

	return (
		<>
			<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
				<div
					className="hidden overflow-y-auto overscroll-none p-4 md:block"
					key="Inputs"
				>
					<div className="mb-4 flex flex-col gap-2">
						<Button onClick={handleFillPdf}>Fill PDF</Button>
						<Button
							onClick={handleEnhanceWithAI}
							disabled={!pdfFile}
							variant="outline"
						>
							Enhance inputs with AI
						</Button>
						<Button onClick={copyInputTagsToClipboard} variant="outline">
							Copy input tags to clipboard
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
						<PDFViewSection pdfFile={filledPdf ?? pdfFile} />
					</div>
				</div>
			</Card>
			<PDFDebugPanel values={fieldValues} fieldMapping={fieldMapping} />
		</>
	);
}
