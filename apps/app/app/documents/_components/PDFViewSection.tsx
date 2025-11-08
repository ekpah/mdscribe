"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useId, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { PDFField } from "../_lib/parsePDFFormFields";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
const options = {
	cMapUrl: "/cmaps/",
	standardFontDataUrl: "/standard_fonts/",
	wasmUrl: "/wasm/",
};

const maxWidth = 800;

interface PDFViewSectionProps {
	pdfFile: File | null;
	filledPdfUrl: string | null;
	fields: PDFField[];
}

export default function PDFViewSection({
	pdfFile,
	filledPdfUrl,
	fields,
}: PDFViewSectionProps) {
	const [numPages, setNumPages] = useState<number>();
	const [pageNumber, setPageNumber] = useState<number>(1);
	const [pageDimensions, setPageDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [_containerRef, _setContainerReff] = useState<HTMLElement | null>(null);
	const [containerWidth, setContainerWidth] = useState<number>();
	const _id = useId();

	const displayUrl =
		filledPdfUrl || (pdfFile ? URL.createObjectURL(pdfFile) : null);

	const _onResize = useCallback<ResizeObserverCallback>((entries) => {
		const [entry] = entries;
		if (entry) {
			setContainerWidth(entry.contentRect.width);
		}
	}, []);

	function onDocumentLoadSuccess({
		numPages: nextNumPages,
	}: PDFDocumentProxy): void {
		setNumPages(nextNumPages);
	}

	const _onPageLoadSuccess = (page: { width: number; height: number }) => {
		setPageDimensions({ width: page.width, height: page.height });
	};

	// Compute scale for overlaying fields on the PDF page correctly
	const _scale =
		containerWidth && pageDimensions
			? Math.min(containerWidth, maxWidth) / pageDimensions.width
			: 1;

	return (
		<div className="hidden h-full lg:block">
			<div className="relative h-full">
				{displayUrl ? (
					<div className="relative h-full">
						<Document
							file={displayUrl}
							onLoadSuccess={onDocumentLoadSuccess}
							options={options}
							className="h-full"
						>
							<Page
								key={`page_${pageNumber}`}
								pageNumber={pageNumber}
								width={
									containerWidth ? Math.min(containerWidth, maxWidth) : maxWidth
								}
							/>
						</Document>
						{numPages && numPages > 1 ? (
							<div className="mt-4 flex items-center justify-center gap-x-2">
								<Button
									variant="outline"
									size="icon"
									onClick={() => setPageNumber(pageNumber - 1)}
									disabled={pageNumber <= 1}
								>
									<ChevronLeftIcon className="h-4 w-4" />
								</Button>
								<span className="text-sm font-medium">
									Page {pageNumber} of {numPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									onClick={() => setPageNumber(pageNumber + 1)}
									disabled={pageNumber >= numPages}
								>
									<ChevronRightIcon className="h-4 w-4" />
								</Button>
							</div>
						) : null}
					</div>
				) : (
					<div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-solarized-base border-opacity-30 bg-solarized-base/[0.03]">
						<div className="text-center">
							<p className="mt-2 block text-sm font-medium text-solarized-base">
								Upload a PDF to see the preview
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
