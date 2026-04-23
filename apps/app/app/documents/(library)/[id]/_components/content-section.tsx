"use client";

import Inputs from "@repo/design-system/components/inputs/inputs";
import type { VoiceFillAudioFile } from "@repo/design-system/components/inputs/inputs";
import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import type { InputTagType } from "@repo/markdoc-md/parse/parse-markdoc-to-inputs";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	buildParsedMarkdocFromFieldDefinitions,
	decodeBase64ToUint8Array,
	downloadPdfBlob,
	fillPDFForm,
	printPdfBlob,
	toPdfBlob,
} from "@/app/documents/_lib";
import type { DocumentFieldDefinition } from "@/app/documents/_lib";
import { useSession } from "@/lib/auth-client";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section";
import { orpc } from "@/lib/orpc";

export default function ContentSection({
	downloadFileName,
	documentId,
	fieldDefinitions,
}: {
	downloadFileName?: string;
	documentId: string;
	fieldDefinitions: DocumentFieldDefinition[];
}) {
	const inputTags = useMemo(() => {
		try {
			return buildParsedMarkdocFromFieldDefinitions(fieldDefinitions).inputTags;
		} catch (error) {
			console.error("Failed to build parsed markdoc from field definitions:", error);
			return [];
		}
	}, [fieldDefinitions]);
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);
	const [previewPdfBytes, setPreviewPdfBytes] = useState<Uint8Array | null>(null);
	const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);
	const { data: session } = useSession();
	const isLoggedIn = Boolean(session?.user?.id);

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
		setPreviewPdfBytes(decodedBytes);
	}, [documentId, pdfData?.id, pdfData?.pdfBase64]);

	const handleFormChange = useCallback((data: Record<string, unknown>) => {
		setValues(data);
	}, []);

	const handleVoiceFill = useCallback(
		async (nextInputTags: InputTagType[], audioFiles: VoiceFillAudioFile[]) => {
			const result = await orpc.scribe.voiceFill.call({
				audioFiles,
				inputTags: nextInputTags,
			});
			return result.fieldValues;
		},
		[],
	);

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
				setPreviewPdfBytes(sourcePdfBytes);
				return;
			}

			const filledPdfBytes = await fillPDFForm(
				sourcePdfBytes,
				values,
				fieldDefinitions,
			);
			setPreviewPdfBytes(filledPdfBytes);
		} catch (error) {
			console.error("Failed to refresh PDF preview:", error);
			toast.error("Vorschau konnte nicht aktualisiert werden.");
		} finally {
			setIsRefreshingPreview(false);
		}
	}, [fieldDefinitions, sourcePdfBytes, values]);

	const handlePrint = useCallback(() => {
		if (!previewPdfBytes) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}
		printPdfBlob(toPdfBlob(previewPdfBytes));
	}, [previewPdfBytes]);

	return (
		<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 overflow-hidden">
			<div className="hidden flex-col overflow-hidden md:flex" key="Inputs">
				<Inputs
					inputTags={inputTags}
					onChange={handleFormChange}
					onVoiceFill={isLoggedIn ? handleVoiceFill : undefined}
					showVoiceInput={isLoggedIn}
				/>
			</div>
			<div
				className="col-span-3 flex flex-col overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
				key="Preview"
			>
				<div className="mb-3 flex items-center gap-2">
					<Button
						disabled={!sourcePdfBytes || isRefreshingPreview}
						onClick={handleRefreshPreview}
						size="sm"
						variant="outline"
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${isRefreshingPreview ? "animate-spin" : ""}`}
						/>
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
				</div>
				{isLoadingPdf ? (
					<div className="flex min-h-40 items-center justify-center rounded-xl border border-input border-dashed px-4 py-6 text-sm text-muted-foreground">
						PDF wird geladen...
					</div>
				) : (
					<div className="min-h-0 flex-1">
						<PDFViewSection
							hasUploadedFile={Boolean(previewPdfBytes)}
							pdfFile={previewPdfBytes}
						/>
					</div>
				)}
			</div>
		</Card>
	);
}
