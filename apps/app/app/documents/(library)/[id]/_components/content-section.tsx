"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { InputPreviewSection } from "@/app/_components/input-preview-section";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section-dynamic";
import {
	buildParsedMarkdocFromDocumentDefinition,
	cloneUint8Array,
	decodeBase64ToUint8Array,
	downloadPdfBlob,
	fillPDFForm,
	printPdfBlob,
	toPdfBlob,
} from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";
import { orpc } from "@/lib/orpc";

export default function ContentSection({
	downloadFileName,
	documentId,
	definition,
}: {
	downloadFileName?: string;
	documentId: string;
	definition: DocumentDefinition;
}) {
	const inputTags = useMemo(() => {
		try {
			return buildParsedMarkdocFromDocumentDefinition(definition).inputTags;
		} catch (error) {
			console.error("Failed to build parsed markdoc from field definitions:", error);
			return [];
		}
	}, [definition]);
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);
	const [previewPdfBytes, setPreviewPdfBytes] = useState<Uint8Array | null>(null);
	const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);

	const { data: pdfData, isLoading: isLoadingPdf } = useQuery(
		orpc.documents.templates.getPdf.queryOptions({ input: { id: documentId } }),
	);

	useEffect(() => {
		setSourcePdfBytes(null);
		setPreviewPdfBytes(null);
		setValues({});
	}, [documentId]);

	useEffect(() => {
		if (!pdfData?.pdfBase64 || pdfData.id !== documentId) {
			return;
		}

		const decodedBytes = decodeBase64ToUint8Array(pdfData.pdfBase64);
		setSourcePdfBytes(decodedBytes);
		setPreviewPdfBytes(cloneUint8Array(decodedBytes));
	}, [documentId, pdfData?.id, pdfData?.pdfBase64]);

	const handleDownload = useCallback(() => {
		if (!previewPdfBytes) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}
		const blob = toPdfBlob(previewPdfBytes);
		downloadPdfBlob(blob, downloadFileName || "dokument.pdf");
		toast.success("PDF heruntergeladen");
	}, [downloadFileName, previewPdfBytes]);

	const handleRefreshPreview = useCallback(async () => {
		if (!sourcePdfBytes) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}

		setIsRefreshingPreview(true);
		try {
			if (Object.keys(values).length === 0) {
				setPreviewPdfBytes(cloneUint8Array(sourcePdfBytes));
				return;
			}

			const filledPdfBytes = await fillPDFForm(sourcePdfBytes, values, definition);
			setPreviewPdfBytes(filledPdfBytes);
		} catch (error) {
			console.error("Failed to refresh PDF preview:", error);
			toast.error("Vorschau konnte nicht aktualisiert werden.");
		} finally {
			setIsRefreshingPreview(false);
		}
	}, [definition, sourcePdfBytes, values]);

	const handlePrint = useCallback(() => {
		if (!previewPdfBytes) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}
		printPdfBlob(toPdfBlob(previewPdfBytes));
	}, [previewPdfBytes]);

	return (
		<InputPreviewSection
			inputTags={inputTags}
			onValuesChange={setValues}
			preview={() =>
				isLoadingPdf ? (
					<div className="flex min-h-40 items-center justify-center rounded-xl border border-input border-dashed px-4 py-6 text-sm text-muted-foreground">
						PDF wird geladen...
					</div>
				) : (
					<PDFViewSection hasUploadedFile={Boolean(previewPdfBytes)} pdfFile={previewPdfBytes} />
				)
			}
			previewToolbar={
				<>
					<Button
						disabled={!sourcePdfBytes || isRefreshingPreview}
						onClick={handleRefreshPreview}
						size="sm"
						variant="outline"
					>
						<RefreshCw className={`mr-2 h-4 w-4 ${isRefreshingPreview ? "animate-spin" : ""}`} />
						Aktualisieren
					</Button>
					<Button onClick={handleDownload} size="sm" variant="outline">
						<Download className="mr-2 h-4 w-4" />
						Herunterladen
					</Button>
					<Button onClick={handlePrint} size="sm" variant="outline">
						<Printer className="mr-2 h-4 w-4" />
						Drucken
					</Button>
				</>
			}
			resetKey={documentId}
		/>
	);
}
