"use client";

import Inputs from "@repo/design-system/components/inputs/Inputs";
import { Card } from "@repo/design-system/components/ui/card";
import type { InputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import dynamic from "next/dynamic";
import { useState } from "react";
import { type PDFField, parsePDFFormFields } from "../_lib/parsePDFFormFields";
import PDFDebugPanel from "./PDFDebugPanel";
import PDFUploadSection from "./PDFUploadSection";

const PDFViewSection = dynamic(() => import("./PDFViewSection"), {
	ssr: false,
});

const _PDF_URL =
	"https://lifevest.zoll.com/-/media/lifevest-zoll-com/medical-professionals/how-order-lifevest/de-mo/mo_deu_online_pdf.ashx";

export default function PDFFormSection() {
	const [pdfFile, setPdfFile] = useState<File | null>(null);
	const [inputTags, setInputTags] = useState<InputTagType[]>([]);
	const [_fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [filledPdfUrl, setFilledPdfUrl] = useState<string | null>(null);
	const [pdfFields, setPdfFields] = useState<PDFField[]>([]);

	const handleFileUpload = async (file: File) => {
		setPdfFile(file);

		// get form fields from pdf
		const result = await parsePDFFormFields(file);

		const { inputTags, fieldMapping, fields } = result;
		setInputTags(inputTags);
		setFieldMapping(fieldMapping);
		setPdfFields(fields);
		setFieldValues({});
		setFilledPdfUrl(null);
	};

	const handleFieldChange = async (values: Record<string, unknown>) => {
		setFieldValues(values);
		if (!pdfFile) {
			return;
		}
	};

	return (
		<>
			<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
				<div
					className="hidden overflow-y-auto overscroll-none p-4 md:block"
					key="Inputs"
				>
					<Inputs inputTags={inputTags} onChange={handleFieldChange} />
				</div>
				<div
					className="col-span-3 flex flex-col overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
					key="Preview"
				>
					<PDFUploadSection onFileUpload={handleFileUpload} pdfFile={pdfFile} />
					<div className="mt-4 flex-1">
						<PDFViewSection
							pdfFile={pdfFile}
							filledPdfUrl={filledPdfUrl}
							fields={pdfFields}
						/>
					</div>
				</div>
			</Card>
			<PDFDebugPanel values={fieldValues} />
		</>
	);
}
