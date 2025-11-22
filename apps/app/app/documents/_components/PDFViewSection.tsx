"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
			setContainerWidth(entry.contentRect.width);
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

	function onDocumentLoadSuccess({
		numPages: nextNumPages,
	}: {
		numPages: number;
	}): void {
		setNumPages(nextNumPages);
	}

	const pdfUrl = useMemo(() => {
		if (pdfFile) {
			return URL.createObjectURL(
				new Blob([pdfFile as BlobPart], { type: "application/pdf" }),
			);
		}
		return null;
	}, [pdfFile]);

	useEffect(() => {
		return () => {
			if (pdfUrl) {
				URL.revokeObjectURL(pdfUrl);
			}
		};
	}, [pdfUrl]);

	return (
		<div className="hidden h-full lg:block">
			<div
				ref={setContainerRef}
				className="relative flex h-full items-center justify-center"
			>
				{pdfUrl ? (
					<div className="relative flex h-full items-center justify-center">
						{numPages && numPages > 1 && hasUploadedFile ? (
							<>
								<Button
									variant="outline"
									size="icon"
									onClick={() => setPageNumber(pageNumber - 1)}
									disabled={pageNumber <= 1}
									className="absolute left-2 z-10"
								>
									<ChevronLeftIcon className="h-4 w-4" />
								</Button>
								<div className="flex flex-col items-center">
									<Document
										file={pdfUrl}
										onLoadSuccess={onDocumentLoadSuccess}
										options={options}
										className="h-full"
									>
										<Page
											key={`page_${pageNumber}`}
											pageNumber={pageNumber}
											width={
												containerWidth
													? Math.min(containerWidth - 120, maxWidth - 120)
													: maxWidth - 120
											}
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
									onClick={() => setPageNumber(pageNumber + 1)}
									disabled={pageNumber >= numPages}
									className="absolute right-2 z-10"
								>
									<ChevronRightIcon className="h-4 w-4" />
								</Button>
							</>
						) : (
							<Document
								file={pdfUrl}
								onLoadSuccess={onDocumentLoadSuccess}
								options={options}
								className="h-full"
							>
								<Page
									key={`page_${pageNumber}`}
									pageNumber={pageNumber}
									width={
										containerWidth
											? Math.min(containerWidth, maxWidth)
											: maxWidth
									}
								/>
							</Document>
						)}
					</div>
				) : (
					<div className="flex w-full h-full min-h-40 items-center justify-center rounded-xl border border-input border-dashed p-4">
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
