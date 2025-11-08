"use client";

import Inputs from "@repo/design-system/components/inputs/Inputs";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import type { InputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import dynamic from "next/dynamic";
import { useState } from "react";
import { fillPDFForm } from "../_lib/fillPDFForm";
import { type PDFField, parsePDFFormFields } from "../_lib/parsePDFFormFields";
import PDFDebugPanel from "./PDFDebugPanel";
import PDFUploadSection from "./PDFUploadSection";
import toast from "react-hot-toast";

const PDFViewSection = dynamic(() => import("./PDFViewSection"), {
	ssr: false,
});

const _PDF_URL =
	"https://lifevest.zoll.com/-/media/lifevest-zoll-com/medical-professionals/how-order-lifevest/de-mo/mo_deu_online_pdf.ashx";

export default function PDFFormSection() {
	const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);
	const [inputTags, setInputTags] = useState<InputTagType[]>([]);
	const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [pdfFields, setPdfFields] = useState<PDFField[]>([]);
	const [filledPdf, setFilledPdf] = useState<Uint8Array | null>(null);
	const handleFileUpload = async (file: Uint8Array) => {
		setPdfFile(file);

		// get form fields from pdf
		const result = await parsePDFFormFields(file);

		const { inputTags, fieldMapping, fields } = result;
		setInputTags(inputTags);
		setFieldMapping(fieldMapping);
		setPdfFields(fields);
		setFieldValues({});
	};

	const handleFieldChange = async (values: Record<string, unknown>) => {
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

	return (
		<>
			<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
				<div
					className="hidden overflow-y-auto overscroll-none p-4 md:block"
					key="Inputs"
				>
					{" "}
					<Button onClick={handleFillPdf}>Fill PDF</Button>
					<Inputs inputTags={inputTags} onChange={handleFieldChange} />
				</div>
				<div
					className="col-span-3 flex flex-col overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
					key="Preview"
				>
					<PDFUploadSection onFileUpload={handleFileUpload} pdfFile={pdfFile} />
					<div className="mt-4 flex-1">
						<PDFViewSection pdfFile={filledPdf ?? pdfFile} />
					</div>
				</div>
			</Card>
			<PDFDebugPanel values={fieldValues} fieldMapping={fieldMapping} />
		</>
	);
}
