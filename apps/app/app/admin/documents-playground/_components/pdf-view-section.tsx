"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toPdfBlobUrl } from "../_lib/pdf-data";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
const options = {
	cMapUrl: "/cmaps/",
	standardFontDataUrl: "/standard_fonts/",
	wasmUrl: "/wasm/",
};

const maxWidth = 800;

interface PDFViewSectionProps {
	pdfFile: Uint8Array | null;
	hasUploadedFile?: boolean;
}

export default function PDFViewSection({
	pdfFile,
	hasUploadedFile = false,
}: PDFViewSectionProps) {
	const [numPages, setNumPages] = useState<number>();
	const [pageNumber, setPageNumber] = useState<number>(1);
	const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState<number>();

	const onResize = useCallback<ResizeObserverCallback>((entries) => {
		const [entry] = entries;
		if (entry) {
			const nextWidth = entry.contentRect.width;
			setContainerWidth(nextWidth > 0 ? nextWidth : undefined);
		}
	}, []);

	useEffect(() => {
		if (!containerRef) {
			return;
		}

		const resizeObserver = new ResizeObserver(onResize);
		resizeObserver.observe(containerRef);

		return () => {
			resizeObserver.disconnect();
		};
	}, [containerRef, onResize]);

	const handleDocumentLoadSuccess = useCallback(
		({
			numPages: nextNumPages,
		}: {
			numPages: number;
		}): void => {
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

	const pdfUrl = useMemo(() => toPdfBlobUrl(pdfFile), [pdfFile]);

	useEffect(() => () => {
			if (pdfUrl) {
				URL.revokeObjectURL(pdfUrl);
			}
		}, [pdfUrl]);

	useEffect(() => {
		if (!pdfUrl) {
			return;
		}
		setPageNumber(1);
		setNumPages(undefined);
	}, [pdfUrl]);

	const pageWidthWithControls = useMemo(() => {
		if (!containerWidth) {
			return maxWidth - 120;
		}
		return Math.max(240, Math.min(containerWidth - 120, maxWidth - 120));
	}, [containerWidth]);

	const pageWidth = useMemo(() => {
		if (!containerWidth) {
			return maxWidth;
		}
		return Math.max(240, Math.min(containerWidth - 16, maxWidth));
	}, [containerWidth]);

	return (
		<div className="h-full min-h-0">
			<div
				ref={setContainerRef}
				className="relative flex h-full min-h-0 items-start justify-center overflow-hidden"
			>
				{pdfUrl ? (
					<div className="relative flex h-full min-h-0 w-full items-start justify-center overflow-auto">
						{numPages && numPages > 1 && hasUploadedFile ? (
							<>
									<Button
										variant="outline"
										size="icon"
										onClick={handlePreviousPage}
										disabled={pageNumber <= 1}
										className="absolute top-1/2 left-2 z-10 -translate-y-1/2"
									>
									<ChevronLeftIcon className="h-4 w-4" />
								</Button>
								<div className="flex min-h-full flex-col items-center justify-start py-2">
										<Document
											file={pdfUrl}
											onLoadSuccess={handleDocumentLoadSuccess}
											onLoadError={handleDocumentLoadError}
											options={options}
											className="max-w-full"
										>
										<Page
											key={`page_${pageNumber}`}
											pageNumber={pageNumber}
											width={pageWidthWithControls}
										/>
									</Document>
									{numPages && numPages > 1 ? (
										<div className="mt-2">
											<span className="text-sm font-medium">
												Seite {pageNumber} von {numPages}
											</span>
										</div>
									) : null}
								</div>
									<Button
										variant="outline"
										size="icon"
										onClick={handleNextPage}
										disabled={pageNumber >= numPages}
										className="absolute top-1/2 right-2 z-10 -translate-y-1/2"
									>
									<ChevronRightIcon className="h-4 w-4" />
								</Button>
							</>
						) : (
							<div className="flex min-h-full flex-col items-center justify-start py-2">
									<Document
										file={pdfUrl}
										onLoadSuccess={handleDocumentLoadSuccess}
										onLoadError={handleDocumentLoadError}
										options={options}
										className="max-w-full"
									>
									<Page
										key={`page_${pageNumber}`}
										pageNumber={pageNumber}
										width={pageWidth}
									/>
								</Document>
							</div>
						)}
					</div>
				) : (
					<div className="flex h-full min-h-40 w-full items-center justify-center rounded-xl border border-input border-dashed p-4">
						<div className="text-center">
							<p className="block text-sm font-medium">
								Laden Sie ein PDF hoch, um die Vorschau zu sehen
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
