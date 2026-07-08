"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toPdfBlob } from "@/app/documents/_lib/pdf-data";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
	cMapUrl: "/cmaps/",
	standardFontDataUrl: "/standard_fonts/",
	wasmUrl: "/wasm/",
};

const maxWidth = 800;

interface PDFViewSectionProps {
	activeFieldName?: string | null;
	hasUploadedFile?: boolean;
	onFieldSelect?: (fieldName: string) => void;
	pdfFile: Uint8Array | null;
}

interface PdfFieldTarget {
	pageNumber: number;
	rect: [number, number, number, number];
}

interface PdfWidgetAnnotation {
	fieldName?: unknown;
	rect?: unknown;
}

interface PdfPageForAnnotations {
	getAnnotations: () => Promise<PdfWidgetAnnotation[]>;
}

interface PdfDocumentForAnnotations {
	getPage: (pageNumber: number) => Promise<PdfPageForAnnotations>;
	numPages: number;
}

interface PdfViewport {
	convertToViewportRectangle: (rect: number[]) => number[];
}

interface PdfPageForHighlight {
	getViewport: (params: { rotate?: number; scale: number }) => PdfViewport;
}

interface HighlightOverlayProps {
	activeFieldName?: string | null;
	fieldTargets: Map<string, PdfFieldTarget[]>;
	page: PdfPageForHighlight;
	pageNumber: number;
	rotate: number;
	scale: number;
}

interface FieldClickLayerProps {
	fieldTargets: Map<string, PdfFieldTarget[]>;
	onFieldSelect?: (fieldName: string) => void;
	page: PdfPageForHighlight;
	pageNumber: number;
	rotate: number;
	scale: number;
}

const getPageWidth = (containerWidth: number | undefined, reservedPixels: number): number => {
	if (!containerWidth) {
		return maxWidth - reservedPixels;
	}
	return Math.max(240, Math.min(containerWidth - reservedPixels, maxWidth - reservedPixels));
};

const isNumberRect = (rect: unknown): rect is [number, number, number, number] =>
	Array.isArray(rect) &&
	rect.length === 4 &&
	rect.every((coordinate) => typeof coordinate === "number");

const collectFieldTargets = async (
	pdfDocument: PdfDocumentForAnnotations,
): Promise<Map<string, PdfFieldTarget[]>> => {
	const fieldTargets = new Map<string, PdfFieldTarget[]>();
	const pageNumbers = Array.from({ length: pdfDocument.numPages }, (_value, index) => index + 1);

	await Promise.all(
		pageNumbers.map(async (pageNumber) => {
			const page = await pdfDocument.getPage(pageNumber);
			const annotations = (await page.getAnnotations()) as PdfWidgetAnnotation[];

			for (const annotation of annotations) {
				if (typeof annotation.fieldName !== "string" || !isNumberRect(annotation.rect)) {
					continue;
				}

				const existingTargets = fieldTargets.get(annotation.fieldName) ?? [];
				existingTargets.push({
					pageNumber,
					rect: annotation.rect,
				});
				fieldTargets.set(annotation.fieldName, existingTargets);
			}
		}),
	);

	return fieldTargets;
};

const getViewportStyle = (
	rect: [number, number, number, number],
	viewport: PdfViewport,
): CSSProperties => {
	const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
	const left = Math.min(x1, x2);
	const top = Math.min(y1, y2);
	const width = Math.abs(x2 - x1);
	const height = Math.abs(y2 - y1);

	return {
		height,
		left,
		top,
		width,
	};
};

const HighlightOverlay = ({
	activeFieldName,
	fieldTargets,
	page,
	pageNumber,
	rotate,
	scale,
}: HighlightOverlayProps) => {
	if (!activeFieldName) {
		return null;
	}

	const targets = fieldTargets
		.get(activeFieldName)
		?.filter((target) => target.pageNumber === pageNumber);
	if (!targets?.length) {
		return null;
	}

	const viewport = page.getViewport({ rotate, scale });

	return (
		<div className="pointer-events-none absolute inset-0 z-10">
			{targets.map((target, index) => (
				<div
					className="absolute rounded-[2px] border-2 border-solarized-orange bg-solarized-orange/20 shadow-[0_0_0_3px_rgba(203,75,22,0.18)]"
					key={`${activeFieldName}-${target.pageNumber}-${index}`}
					style={getViewportStyle(target.rect, viewport)}
				/>
			))}
		</div>
	);
};

const FieldClickLayer = ({
	fieldTargets,
	onFieldSelect,
	page,
	pageNumber,
	rotate,
	scale,
}: FieldClickLayerProps) => {
	if (!onFieldSelect) {
		return null;
	}

	const viewport = page.getViewport({ rotate, scale });
	const targets = [...fieldTargets.entries()].flatMap(([fieldName, fieldTargetsForName]) =>
		fieldTargetsForName
			.filter((target) => target.pageNumber === pageNumber)
			.map((target, index) => ({
				fieldName,
				key: `${fieldName}-${target.pageNumber}-${index}`,
				rect: target.rect,
			})),
	);

	if (targets.length === 0) {
		return null;
	}

	return (
		<div className="absolute inset-0 z-10">
			{targets.map((target) => (
				<button
					aria-label={`PDF-Feld ${target.fieldName} auswählen`}
					className="absolute cursor-pointer rounded-[2px] border border-transparent bg-transparent p-0 transition-colors hover:border-solarized-orange/40 hover:bg-solarized-orange/10 focus-visible:border-solarized-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solarized-orange/50"
					key={target.key}
					onClick={() => onFieldSelect(target.fieldName)}
					style={getViewportStyle(target.rect, viewport)}
					type="button"
				/>
			))}
		</div>
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
	const annotationLoadIdRef = useRef(0);
	const [fieldTargets, setFieldTargets] = useState<Map<string, PdfFieldTarget[]>>(new Map());
	const [numPages, setNumPages] = useState<number>();
	const [pageNumber, setPageNumber] = useState<number>(1);
	const pdfBlob = useMemo(() => {
		if (!pdfFile) {
			return null;
		}

		try {
			return toPdfBlob(pdfFile);
		} catch (error) {
			console.error("Failed to convert PDF bytes to Blob:", error);
			return null;
		}
	}, [pdfFile]);

	useEffect(() => {
		if (!pdfBlob) {
			return;
		}
		annotationLoadIdRef.current += 1;
		setPageNumber(1);
		setNumPages(undefined);
		setFieldTargets(new Map());
	}, [pdfBlob]);

	const handleDocumentLoadSuccess = useCallback((pdfDocument: PdfDocumentForAnnotations): void => {
		const annotationLoadId = annotationLoadIdRef.current + 1;
		annotationLoadIdRef.current = annotationLoadId;
		setNumPages(pdfDocument.numPages);

		const loadFieldTargets = async () => {
			try {
				const nextFieldTargets = await collectFieldTargets(pdfDocument);
				if (annotationLoadIdRef.current === annotationLoadId) {
					setFieldTargets(nextFieldTargets);
				}
			} catch (error) {
				console.error("PDF annotation load error:", error);
				if (annotationLoadIdRef.current === annotationLoadId) {
					setFieldTargets(new Map());
				}
			}
		};

		void loadFieldTargets();
	}, []);

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
		fieldTargets,
		handleDocumentLoadError,
		handleDocumentLoadSuccess,
		handleNextPage,
		handlePreviousPage,
		numPages,
		pageNumber,
		pdfBlob,
		setPageNumber,
	};
};

export const PDFViewSection = ({
	activeFieldName,
	hasUploadedFile = false,
	onFieldSelect,
	pdfFile,
}: PDFViewSectionProps) => {
	const { containerWidth, setContainerRef } = useContainerWidth();
	const {
		handleDocumentLoadError,
		handleDocumentLoadSuccess,
		handleNextPage,
		handlePreviousPage,
		fieldTargets,
		numPages,
		pageNumber,
		pdfBlob,
		setPageNumber,
	} = usePdfDocumentState(pdfFile);

	useEffect(() => {
		if (!activeFieldName) {
			return;
		}

		const target = fieldTargets.get(activeFieldName)?.[0];
		if (!target) {
			return;
		}

		setPageNumber(target.pageNumber);
	}, [activeFieldName, fieldTargets, setPageNumber]);

	if (!pdfBlob) {
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
							file={pdfBlob}
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
							>
								{({ page, pageNumber: renderedPageNumber, rotate, scale }) => (
									<>
										<FieldClickLayer
											fieldTargets={fieldTargets}
											onFieldSelect={onFieldSelect}
											page={page}
											pageNumber={renderedPageNumber}
											rotate={rotate}
											scale={scale}
										/>
										<HighlightOverlay
											activeFieldName={activeFieldName}
											fieldTargets={fieldTargets}
											page={page}
											pageNumber={renderedPageNumber}
											rotate={rotate}
											scale={scale}
										/>
									</>
								)}
							</Page>
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
