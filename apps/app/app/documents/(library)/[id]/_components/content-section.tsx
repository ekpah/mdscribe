"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { InputPreviewSection } from "@/app/_components/input-preview-section";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section-dynamic";
import {
	cloneUint8Array,
	decodeBase64ToUint8Array,
	downloadPdfBlob,
	fillPDFForm,
	normalizeDocumentDefinition,
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
	const normalizedDefinition = useMemo(() => {
		try {
			return normalizeDocumentDefinition(definition);
		} catch (error) {
			console.error("Failed to build inputs from document definition:", error);
			return { fieldMappings: [], inputTags: [], version: 2 as const };
		}
	}, [definition]);
	const { fieldMappings, inputTags } = normalizedDefinition;
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);
	const [previewPdfBytes, setPreviewPdfBytes] = useState<Uint8Array | null>(null);
	const [activeInputFocusKey, setActiveInputFocusKey] = useState<number>();
	const [activePdfNavigationKey, setActivePdfNavigationKey] = useState(0);
	const [activePdfFieldName, setActivePdfFieldName] = useState<string | null>(null);
	const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);
	const [previewRefreshRequestKey, setPreviewRefreshRequestKey] = useState(0);
	const previewRefreshIdRef = useRef(0);

	const pdfFieldNameByInputName = useMemo(() => {
		const map = new Map<string, string>();
		for (const fieldMapping of fieldMappings) {
			if (!fieldMapping.isEnabled || map.has(fieldMapping.variable)) {
				continue;
			}
			map.set(fieldMapping.variable, fieldMapping.fieldName);
		}
		return map;
	}, [fieldMappings]);

	const activeInputName = useMemo(() => {
		if (!activePdfFieldName) {
			return null;
		}
		return (
			fieldMappings.find(
				(fieldMapping) => fieldMapping.isEnabled && fieldMapping.fieldName === activePdfFieldName,
			)?.variable ?? null
		);
	}, [activePdfFieldName, fieldMappings]);

	const { data: pdfData, isLoading: isLoadingPdf } = useQuery(
		orpc.documents.templates.getPdf.queryOptions({ input: { id: documentId } }),
	);

	useEffect(() => {
		previewRefreshIdRef.current += 1;
		setSourcePdfBytes(null);
		setPreviewPdfBytes(null);
		setValues({});
		setActiveInputFocusKey(undefined);
		setActivePdfNavigationKey(0);
		setActivePdfFieldName(null);
		setPreviewRefreshRequestKey(0);
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

	const refreshPreview = useCallback(
		async ({
			showMissingPdfToast = false,
			showRefreshErrorToast = false,
		}: {
			showMissingPdfToast?: boolean;
			showRefreshErrorToast?: boolean;
		} = {}) => {
			if (!sourcePdfBytes) {
				if (showMissingPdfToast) {
					toast.error("PDF ist noch nicht geladen.");
				}
				return;
			}

			const refreshId = previewRefreshIdRef.current + 1;
			previewRefreshIdRef.current = refreshId;
			setIsRefreshingPreview(true);
			try {
				const nextPdfBytes =
					Object.keys(values).length === 0
						? cloneUint8Array(sourcePdfBytes)
						: await fillPDFForm(sourcePdfBytes, values, definition);

				if (previewRefreshIdRef.current === refreshId) {
					setPreviewPdfBytes(nextPdfBytes);
				}
			} catch (error) {
				console.error("Failed to refresh PDF preview:", error);
				if (showRefreshErrorToast) {
					toast.error("Vorschau konnte nicht aktualisiert werden.");
				}
			} finally {
				if (previewRefreshIdRef.current === refreshId) {
					setIsRefreshingPreview(false);
				}
			}
		},
		[definition, sourcePdfBytes, values],
	);
	const refreshPreviewRef = useRef(refreshPreview);
	refreshPreviewRef.current = refreshPreview;

	useEffect(() => {
		if (!sourcePdfBytes || previewRefreshRequestKey === 0) {
			return;
		}

		const timeout = window.setTimeout(() => {
			void refreshPreviewRef.current();
		}, 600);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [previewRefreshRequestKey, sourcePdfBytes]);

	const handleRefreshPreview = useCallback(async () => {
		if (!sourcePdfBytes) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}

		await refreshPreview({ showMissingPdfToast: true, showRefreshErrorToast: true });
	}, [refreshPreview, sourcePdfBytes]);

	const handlePrint = useCallback(() => {
		if (!previewPdfBytes) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}
		printPdfBlob(toPdfBlob(previewPdfBytes));
	}, [previewPdfBytes]);

	const handleInputSelect = useCallback(
		(inputName: string) => {
			const pdfFieldName = pdfFieldNameByInputName.get(inputName);
			if (!pdfFieldName) {
				return;
			}
			setActivePdfFieldName(pdfFieldName);
			setActivePdfNavigationKey((currentKey) => currentKey + 1);
		},
		[pdfFieldNameByInputName],
	);

	const handleInputBlur = useCallback(() => {
		if (!sourcePdfBytes) {
			return;
		}
		setPreviewRefreshRequestKey((currentKey) => currentKey + 1);
	}, [sourcePdfBytes]);

	const handlePdfFieldSelect = useCallback((fieldName: string) => {
		setActivePdfFieldName(fieldName);
		setActivePdfNavigationKey((currentKey) => currentKey + 1);
		setActiveInputFocusKey((currentKey) => (currentKey ?? 0) + 1);
	}, []);

	return (
		<InputPreviewSection
			activeInputFocusKey={activeInputFocusKey}
			activeInputName={activeInputName}
			inputTags={inputTags}
			onInputBlur={handleInputBlur}
			onInputSelect={handleInputSelect}
			onValuesChange={setValues}
			preview={() =>
				isLoadingPdf ? (
					<div className="flex min-h-40 items-center justify-center rounded-xl border border-input border-dashed px-4 py-6 text-sm text-muted-foreground">
						PDF wird geladen...
					</div>
				) : (
					<PDFViewSection
						activeFieldNavigationKey={activePdfNavigationKey}
						activeFieldName={activePdfFieldName}
						hasUploadedFile={Boolean(previewPdfBytes)}
						onFieldSelect={handlePdfFieldSelect}
						pdfFile={previewPdfBytes}
						resetKey={documentId}
					/>
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
