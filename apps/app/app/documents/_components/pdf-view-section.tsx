"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { toPdfBlobUrl } from "@/app/documents/_lib/pdf-data";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
	cMapUrl: "/cmaps/",
	standardFontDataUrl: "/standard_fonts/",
	wasmUrl: "/wasm/",
};

const maxWidth = 800;

interface PDFViewSectionProps {
	hasUploadedFile?: boolean;
	pdfFile: Uint8Array | null;
}

const getPageWidth = (
	containerWidth: number | undefined,
	reservedPixels: number,
): number => {
	if (!containerWidth) {
		return maxWidth - reservedPixels;
	}
	return Math.max(
		240,
		Math.min(containerWidth - reservedPixels, maxWidth - reservedPixels),
	);
};

const useContainerWidth = () => {
	const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState<number>();

	const handleResize = useCallback<ResizeObserverCallback>((entries) => {
		const [entry] = entries;
		if (!entry) {
			return;
		}

		const nextWidth = entry.contentRect.width;
		setContainerWidth(nextWidth > 0 ? nextWidth : undefined);
	}, []);

	useEffect(() => {
		if (!containerRef) {
			return;
		}

		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(containerRef);
		return () => {
			resizeObserver.disconnect();
		};
	}, [containerRef, handleResize]);

	return {
		containerWidth,
		setContainerRef,
	};
};

const usePdfDocumentState = (pdfFile: Uint8Array | null) => {
	const [numPages, setNumPages] = useState<number>();
	const [pageNumber, setPageNumber] = useState<number>(1);
	const pdfUrl = useMemo(() => toPdfBlobUrl(pdfFile), [pdfFile]);

	useEffect(
		() => () => {
			if (pdfUrl) {
				URL.revokeObjectURL(pdfUrl);
			}
		},
		[pdfUrl],
	);

	useEffect(() => {
		if (!pdfUrl) {
			return;
		}
		setPageNumber(1);
		setNumPages(undefined);
	}, [pdfUrl]);

	const handleDocumentLoadSuccess = useCallback(
		({ numPages: nextNumPages }: { numPages: number }): void => {
			setNumPages(nextNumPages);
		},
		[],
	);

	const handleDocumentLoadError = useCallback((error: Error): void => {
		console.error("PDF load error:", error);
	}, []);

	const handlePreviousPage = useCallback(() => {
		setPageNumber((currentPage) => Math.max(1, currentPage - 1));
	}, []);

	const handleNextPage = useCallback(() => {
		setPageNumber((currentPage) => {
			if (!numPages) {
				return currentPage + 1;
			}
			return Math.min(numPages, currentPage + 1);
		});
	}, [numPages]);

	return {
		handleDocumentLoadError,
		handleDocumentLoadSuccess,
		handleNextPage,
		handlePreviousPage,
		numPages,
		pageNumber,
		pdfUrl,
	};
};

export const PDFViewSection = ({
	hasUploadedFile = false,
	pdfFile,
}: PDFViewSectionProps) => {
	const { containerWidth, setContainerRef } = useContainerWidth();
	const {
		handleDocumentLoadError,
		handleDocumentLoadSuccess,
		handleNextPage,
		handlePreviousPage,
		numPages,
		pageNumber,
		pdfUrl,
	} = usePdfDocumentState(pdfFile);

	if (!pdfUrl) {
		return (
			<div className="h-full min-h-0">
				<div className="flex h-full min-h-40 w-full items-center justify-center rounded-xl border border-input border-dashed p-4">
					<div className="text-center">
						<p className="block font-medium text-sm">
							Laden Sie ein PDF hoch, um die Vorschau zu sehen
						</p>
					</div>
				</div>
			</div>
		);
	}

	const showPageControls = Boolean(numPages && numPages > 1 && hasUploadedFile);
	const pageWidth = showPageControls
		? getPageWidth(containerWidth, 120)
		: getPageWidth(containerWidth, 16);

	return (
		<div className="h-full min-h-0">
			<div
				className="relative flex h-full min-h-0 items-start justify-center overflow-hidden"
				ref={setContainerRef}
			>
				<div className="h-full min-h-0 w-full overflow-auto">
					<div className="flex min-h-full w-full flex-col items-center justify-start py-2">
						<Document
							className="max-w-full [&_.react-pdf__Page]:max-w-full [&_.react-pdf__Page__canvas]:h-auto [&_.react-pdf__Page__canvas]:max-w-full"
							file={pdfUrl}
							onLoadError={handleDocumentLoadError}
							onLoadSuccess={handleDocumentLoadSuccess}
							options={options}
						>
							<Page
								key={`page_${pageNumber}`}
								pageNumber={pageNumber}
								renderAnnotationLayer={false}
								renderTextLayer={false}
								width={pageWidth}
							/>
						</Document>
					</div>
				</div>

				{showPageControls ? (
					<Button
						className="absolute top-1/2 left-2 z-20 -translate-y-1/2"
						disabled={pageNumber <= 1}
						onClick={handlePreviousPage}
						size="icon"
						variant="outline"
					>
						<ChevronLeftIcon className="h-4 w-4" />
					</Button>
				) : null}

				{showPageControls ? (
					<Button
						className="absolute top-1/2 right-2 z-20 -translate-y-1/2"
						disabled={!numPages || pageNumber >= numPages}
						onClick={handleNextPage}
						size="icon"
						variant="outline"
					>
						<ChevronRightIcon className="h-4 w-4" />
					</Button>
				) : null}

				{numPages && numPages > 1 ? (
					<div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md border bg-background/95 px-2 py-1 shadow-xs backdrop-blur-xs">
						<span className="font-medium text-sm">
							Seite {pageNumber} von {numPages}
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
};
