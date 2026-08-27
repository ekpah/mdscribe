"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { InputPreviewSection } from "@/app/_components/input-preview-section";
import {
	getInputIdForPdfWidget,
	getPdfFieldHighlightsForInput,
} from "@/app/documents/_components/pdf-field-highlights";
import { DocumentPreviewTabs } from "@/app/documents/_components/document-preview-tabs";
import type { DocumentPreviewView } from "@/app/documents/_components/document-preview-tabs";
import { PDFViewSection } from "@/app/documents/_components/pdf-view-section-dynamic";
import {
	cloneUint8Array,
	decodeBase64ToUint8Array,
	downloadPdfBlob,
	fillPDFForm,
	getEnabledDocumentInputs,
	normalizeDocumentDefinition,
	printPdfBlob,
	toPdfBlob,
} from "@/app/documents/_lib";
import type { DocumentDefinition } from "@/app/documents/_lib";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

const DocumentInformationPreview = ({ information }: { information: string }) => (
	<div className="min-h-full">
		{information ? (
			<pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
				{information}
			</pre>
		) : (
			<div className="flex min-h-full items-center justify-center">
				<div className="max-w-sm rounded-md border border-dashed bg-muted/30 p-6 text-center">
					<p className="font-medium text-sm">
						{USER_MESSAGES.documentEditor.informationEmpty}
					</p>
					<p className="mt-2 text-muted-foreground text-sm">
						{USER_MESSAGES.documentEditor.informationEmptyDescription}
					</p>
				</div>
			</div>
		)}
	</div>
);

export default function ContentSection({
	downloadFileName,
	documentId,
	definition,
	information,
}: {
	downloadFileName?: string;
	documentId: string;
	definition: DocumentDefinition;
	information: string;
}) {
	const normalizedDefinition = useMemo(() => {
		try {
			return normalizeDocumentDefinition(definition);
		} catch (error) {
			console.error("Failed to build inputs from document definition:", error);
			return { bindings: [], inputs: [] };
		}
	}, [definition]);
	const inputs = useMemo(
		() => getEnabledDocumentInputs(normalizedDefinition),
		[normalizedDefinition],
	);
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);
	const [previewPdfBytes, setPreviewPdfBytes] = useState<Uint8Array | null>(null);
	const [activeInputFocusKey, setActiveInputFocusKey] = useState<number>();
	const [activePdfNavigationKey, setActivePdfNavigationKey] = useState(0);
	const [activeInputName, setActiveInputName] = useState<string | null>(null);
	const [contentView, setContentView] = useState<DocumentPreviewView>("document");
	const [isRefreshingPreview, setIsRefreshingPreview] = useState(false);
	const [hasPreviewError, setHasPreviewError] = useState(false);
	const [previewRefreshRequestKey, setPreviewRefreshRequestKey] = useState(0);
	const previewRefreshIdRef = useRef(0);

	const activePdfFieldHighlights = useMemo(
		() => getPdfFieldHighlightsForInput(normalizedDefinition, undefined, activeInputName),
		[activeInputName, normalizedDefinition],
	);

	const { data: pdfData, isLoading: isLoadingPdf } = useQuery(
		orpc.documents.templates.getPdf.queryOptions({ input: { id: documentId } }),
	);

	useEffect(() => {
		previewRefreshIdRef.current += 1;
		setSourcePdfBytes(null);
		setPreviewPdfBytes(null);
		setValues({});
		setActiveInputFocusKey(undefined);
		setActiveInputName(null);
		setActivePdfNavigationKey(0);
		setHasPreviewError(false);
		setPreviewRefreshRequestKey(0);
	}, [documentId]);

	useEffect(() => {
		if (!pdfData?.pdfBase64 || pdfData.id !== documentId) {
			return;
		}

		const decodedBytes = decodeBase64ToUint8Array(pdfData.pdfBase64);
		setSourcePdfBytes(decodedBytes);
		setPreviewPdfBytes(cloneUint8Array(decodedBytes));
		setHasPreviewError(false);
	}, [documentId, pdfData?.id, pdfData?.pdfBase64]);

	const handleDownload = useCallback(() => {
		if (!previewPdfBytes || hasPreviewError) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}
		const blob = toPdfBlob(previewPdfBytes);
		downloadPdfBlob(blob, downloadFileName || "dokument.pdf");
		toast.success("PDF heruntergeladen");
	}, [downloadFileName, hasPreviewError, previewPdfBytes]);

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
						: await fillPDFForm(sourcePdfBytes, values, normalizedDefinition);

				if (previewRefreshIdRef.current === refreshId) {
					setPreviewPdfBytes(nextPdfBytes);
					setHasPreviewError(false);
				}
			} catch (error) {
				console.error("Failed to refresh PDF preview:", error);
				if (previewRefreshIdRef.current === refreshId) {
					setHasPreviewError(true);
				}
				if (showRefreshErrorToast) {
					toast.error("Vorschau konnte nicht aktualisiert werden.");
				}
			} finally {
				if (previewRefreshIdRef.current === refreshId) {
					setIsRefreshingPreview(false);
				}
			}
		},
		[normalizedDefinition, sourcePdfBytes, values],
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
		if (!previewPdfBytes || hasPreviewError) {
			toast.error("PDF ist noch nicht geladen.");
			return;
		}
		printPdfBlob(toPdfBlob(previewPdfBytes));
	}, [hasPreviewError, previewPdfBytes]);

	const handleInputSelect = useCallback((inputName: string) => {
		setActiveInputName(inputName);
		setActivePdfNavigationKey((currentKey) => currentKey + 1);
		setContentView("document");
	}, []);

	const handleInputBlur = useCallback(() => {
		if (!sourcePdfBytes) {
			return;
		}
		setPreviewRefreshRequestKey((currentKey) => currentKey + 1);
	}, [sourcePdfBytes]);

	const handlePdfFieldSelect = useCallback(
		(fieldName: string, widgetValue?: string) => {
			const inputId = getInputIdForPdfWidget(normalizedDefinition, fieldName, widgetValue);
			if (!inputId) {
				return;
			}
			setActiveInputName(inputId);
			setActivePdfNavigationKey((currentKey) => currentKey + 1);
			setActiveInputFocusKey((currentKey) => (currentKey ?? 0) + 1);
		},
		[normalizedDefinition],
	);

	return (
		<InputPreviewSection
			activeInputFocusKey={activeInputFocusKey}
			activeInputName={activeInputName}
			contentType="document"
			edgeTabs={
				<DocumentPreviewTabs activeView={contentView} onViewChange={setContentView} />
			}
			inputTags={inputs}
			onInputBlur={handleInputBlur}
			onInputSelect={handleInputSelect}
			onValuesChange={setValues}
			preview={() => {
				if (contentView === "information") {
					return <DocumentInformationPreview information={information} />;
				}
				return isLoadingPdf ? (
					<div className="flex min-h-40 items-center justify-center rounded-xl border border-input border-dashed px-4 py-6 text-sm text-muted-foreground">
						PDF wird geladen...
					</div>
				) : (
					<PDFViewSection
						activeFieldHighlights={activePdfFieldHighlights}
						activeFieldNavigationKey={activePdfNavigationKey}
						hasUploadedFile={Boolean(previewPdfBytes)}
						onFieldSelect={handlePdfFieldSelect}
						pdfFile={previewPdfBytes}
						resetKey={documentId}
					/>
				);
			}}
			previewToolbar={
				contentView === "document" ? (
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
						<Button disabled={hasPreviewError} onClick={handleDownload} size="sm" variant="outline">
							<Download className="mr-2 h-4 w-4" />
							Herunterladen
						</Button>
						<Button disabled={hasPreviewError} onClick={handlePrint} size="sm" variant="outline">
							<Printer className="mr-2 h-4 w-4" />
							Drucken
						</Button>
					</>
				) : undefined
			}
			resetKey={documentId}
			templateInformation={information}
		/>
	);
}
