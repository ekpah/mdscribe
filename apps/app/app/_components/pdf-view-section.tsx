"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { PdfFieldHighlight } from "@/app/documents/_components/pdf-field-highlights";
import { toPdfBlob } from "@/app/documents/_lib/pdf-data";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
	cMapUrl: "/cmaps/",
	standardFontDataUrl: "/standard_fonts/",
	wasmUrl: "/wasm/",
};

const maxWidth = 800;

const pdfLoadingPlaceholder = (
	<div className="flex min-h-40 w-full items-center justify-center rounded-xl border border-input border-dashed px-4 py-6 text-sm text-muted-foreground">
		Vorschau wird aktualisiert...
	</div>
);

interface PDFViewSectionProps {
	activeFieldName?: string | null;
	activeFieldNames?: string[];
	activeFieldHighlights?: PdfFieldHighlight[];
	activeFieldNavigationKey?: string | number;
	hasUploadedFile?: boolean;
	onFieldSelect?: (fieldName: string, widgetValue?: string) => void;
	pdfFile: Uint8Array | null;
	resetKey?: string;
}

interface PdfFieldTarget {
	pageNumber: number;
	rect: [number, number, number, number];
	widgetValue?: string;
}

interface PdfWidgetAnnotation {
	buttonValue?: unknown;
	exportValue?: unknown;
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
	activeFieldHighlights: PdfFieldHighlight[];
	fieldTargets: Map<string, PdfFieldTarget[]>;
	page: PdfPageForHighlight;
	pageNumber: number;
	rotate: number;
	scale: number;
}

interface FieldClickLayerProps {
	fieldTargets: Map<string, PdfFieldTarget[]>;
	onFieldSelect?: (fieldName: string, widgetValue?: string) => void;
	page: PdfPageForHighlight;
	pageNumber: number;
	rotate: number;
	scale: number;
}

interface FieldScrollEffectProps {
	activeFieldHighlight?: PdfFieldHighlight;
	activeFieldNavigationKey?: string | number;
	fieldTargets: Map<string, PdfFieldTarget[]>;
	lastScrolledFieldKeyRef: MutableRefObject<string | null>;
	page: PdfPageForHighlight;
	pageNumber: number;
	rotate: number;
	scale: number;
	scrollContainer: HTMLDivElement | null;
}

interface PdfBuffer {
	blob: Blob;
	file: Uint8Array;
	generation: number;
	id: number;
}

interface PdfBufferLoadState {
	areFieldTargetsLoaded: boolean;
	fieldTargets: Map<string, PdfFieldTarget[]>;
	numPages?: number;
	paintedPageNumber?: number;
}

interface PdfBufferViewProps {
	activeFieldHighlight?: PdfFieldHighlight;
	activeFieldHighlights: PdfFieldHighlight[];
	activeFieldNavigationKey?: string | number;
	buffer: PdfBuffer;
	fieldTargets: Map<string, PdfFieldTarget[]>;
	isVisible: boolean;
	lastScrolledFieldKeyRef: MutableRefObject<string | null>;
	onDocumentLoadError: (error: Error) => void;
	onDocumentLoadSuccess: (buffer: PdfBuffer, pdfDocument: PdfDocumentForAnnotations) => void;
	onFieldSelect?: (fieldName: string, widgetValue?: string) => void;
	onPageRenderSuccess: (buffer: PdfBuffer, pageNumber: number) => void;
	pageNumber: number;
	pageWidth: number;
	scrollContainer: HTMLDivElement | null;
}

interface PdfViewStateParams {
	activeFieldHighlight?: PdfFieldHighlight;
	activeFieldNavigationKey?: string | number;
	pdfFile: Uint8Array | null;
	resetKey?: string;
}

interface PdfViewState {
	fieldTargets: Map<string, PdfFieldTarget[]>;
	handleDocumentLoadError: (error: Error) => void;
	handleDocumentLoadSuccess: (buffer: PdfBuffer, pdfDocument: PdfDocumentForAnnotations) => void;
	handleNextPage: () => void;
	handlePageRenderSuccess: (buffer: PdfBuffer, pageNumber: number) => void;
	handlePreviousPage: () => void;
	handleScrollContainerScroll: () => void;
	lastScrolledFieldKeyRef: MutableRefObject<string | null>;
	numPages?: number;
	pageNumber: number;
	pendingBuffer: PdfBuffer | null;
	pendingFieldTargets: Map<string, PdfFieldTarget[]>;
	pendingNumPages?: number;
	scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
	visibleBuffer: PdfBuffer | null;
}

const emptyFieldTargets = new Map<string, PdfFieldTarget[]>();

const resolveActiveFieldHighlights = (
	activeFieldHighlights: PdfFieldHighlight[] | undefined,
	activeFieldNames: string[] | undefined,
	activeFieldName: string | null | undefined,
): PdfFieldHighlight[] => {
	if (activeFieldHighlights && activeFieldHighlights.length > 0) {
		return activeFieldHighlights;
	}
	if (activeFieldNames && activeFieldNames.length > 0) {
		return activeFieldNames.map((fieldName) => ({ fieldName }));
	}
	return activeFieldName ? [{ fieldName: activeFieldName }] : [];
};

const getHighlightedTargets = (
	fieldTargets: Map<string, PdfFieldTarget[]>,
	highlight: PdfFieldHighlight,
): PdfFieldTarget[] => {
	const targets = fieldTargets.get(highlight.fieldName) ?? [];
	if (!highlight.widgetValues) {
		return targets;
	}

	const matchingTargets = targets.filter(
		(target) =>
			typeof target.widgetValue === "string" &&
			highlight.widgetValues?.includes(target.widgetValue),
	);
	if (matchingTargets.length > 0 || targets.length > 1) {
		return matchingTargets;
	}
	return targets;
};

const findHighlightedTarget = (
	fieldTargets: Map<string, PdfFieldTarget[]>,
	highlight: PdfFieldHighlight,
	pageNumber?: number,
): PdfFieldTarget | undefined =>
	getHighlightedTargets(fieldTargets, highlight).find(
		(target) => pageNumber === undefined || target.pageNumber === pageNumber,
	);

const getHighlightKey = (highlight: PdfFieldHighlight): string =>
	`${highlight.fieldName}:${highlight.widgetValues?.join("\u0000") ?? "*"}`;

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

const getAnnotationWidgetValue = (annotation: PdfWidgetAnnotation): string | undefined => {
	if (typeof annotation.exportValue === "string") {
		return annotation.exportValue;
	}
	return typeof annotation.buttonValue === "string" ? annotation.buttonValue : undefined;
};

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
				const widgetValue = getAnnotationWidgetValue(annotation);
				existingTargets.push({
					pageNumber,
					rect: annotation.rect,
					...(widgetValue === undefined ? {} : { widgetValue }),
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

const getViewportBounds = (rect: [number, number, number, number], viewport: PdfViewport) => {
	const convertedRect = viewport.convertToViewportRectangle(rect);
	const y1 = convertedRect[1] ?? 0;
	const y2 = convertedRect[3] ?? 0;
	const top = Math.min(y1, y2);
	const height = Math.abs(y2 - y1);
	return { height, top };
};

const createPdfBuffer = (file: Uint8Array, id: number, generation: number): PdfBuffer | null => {
	try {
		return {
			blob: toPdfBlob(file),
			file,
			generation,
			id,
		};
	} catch (error) {
		console.error("Failed to convert PDF bytes to Blob:", error);
		return null;
	}
};

const getPdfBufferClassName = (isVisible: boolean) =>
	isVisible
		? "relative z-10 flex min-h-full w-full flex-col items-center justify-start py-2"
		: "pointer-events-none absolute top-0 left-1/2 flex min-h-full w-full -translate-x-1/2 flex-col items-center justify-start py-2 opacity-0";

const HighlightOverlay = ({
	activeFieldHighlights,
	fieldTargets,
	page,
	pageNumber,
	rotate,
	scale,
}: HighlightOverlayProps) => {
	if (activeFieldHighlights.length === 0) {
		return null;
	}

	const targets = activeFieldHighlights.flatMap((highlight) =>
		getHighlightedTargets(fieldTargets, highlight)
			.filter((target) => target.pageNumber === pageNumber)
			.map((target, index) => ({
				fieldName: highlight.fieldName,
				key: `${getHighlightKey(highlight)}-${target.pageNumber}-${index}`,
				rect: target.rect,
			})),
	);
	if (targets.length === 0) {
		return null;
	}

	const viewport = page.getViewport({ rotate, scale });

	return (
		<div className="pointer-events-none absolute inset-0 z-10">
			{targets.map((target) => (
				<div
					className="absolute rounded-[2px] border-2 border-solarized-orange bg-solarized-orange/20 shadow-[0_0_0_3px_rgba(203,75,22,0.18)]"
					key={target.key}
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
				widgetValue: target.widgetValue,
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
					onClick={() => onFieldSelect(target.fieldName, target.widgetValue)}
					style={getViewportStyle(target.rect, viewport)}
					type="button"
				/>
			))}
		</div>
	);
};

const FieldScrollEffect = ({
	activeFieldHighlight,
	activeFieldNavigationKey,
	fieldTargets,
	lastScrolledFieldKeyRef,
	page,
	pageNumber,
	rotate,
	scale,
	scrollContainer,
}: FieldScrollEffectProps) => {
	useLayoutEffect(() => {
		if (!activeFieldHighlight || !scrollContainer) {
			return;
		}
		const scrollKey = `${getHighlightKey(activeFieldHighlight)}:${activeFieldNavigationKey ?? ""}`;
		if (lastScrolledFieldKeyRef.current === scrollKey) {
			return;
		}

		const target = findHighlightedTarget(fieldTargets, activeFieldHighlight, pageNumber);
		if (!target) {
			return;
		}

		const viewport = page.getViewport({ rotate, scale });
		const targetBounds = getViewportBounds(target.rect, viewport);
		const targetCenter = targetBounds.top + targetBounds.height / 2;
		const nextScrollTop = Math.max(0, targetCenter - scrollContainer.clientHeight / 2);
		scrollContainer.scrollTo({ behavior: "smooth", top: nextScrollTop });
		lastScrolledFieldKeyRef.current = scrollKey;
	}, [
		activeFieldHighlight,
		activeFieldNavigationKey,
		fieldTargets,
		lastScrolledFieldKeyRef,
		page,
		pageNumber,
		rotate,
		scale,
		scrollContainer,
	]);

	return null;
};

const PdfBufferView = ({
	activeFieldHighlight,
	activeFieldHighlights,
	activeFieldNavigationKey,
	buffer,
	fieldTargets,
	isVisible,
	lastScrolledFieldKeyRef,
	onDocumentLoadError,
	onDocumentLoadSuccess,
	onFieldSelect,
	onPageRenderSuccess,
	pageNumber,
	pageWidth,
	scrollContainer,
}: PdfBufferViewProps) => (
	<div className={getPdfBufferClassName(isVisible)}>
		<Document
			className="max-w-full [&_.react-pdf__Page]:max-w-full [&_.react-pdf__Page__canvas]:h-auto [&_.react-pdf__Page__canvas]:max-w-full"
			file={buffer.blob}
			loading={null}
			onLoadError={onDocumentLoadError}
			onLoadSuccess={(pdfDocument) => onDocumentLoadSuccess(buffer, pdfDocument)}
			options={options}
		>
			<Page
				key={`${buffer.id}-${pageNumber}`}
				loading={null}
				onRenderSuccess={() => onPageRenderSuccess(buffer, pageNumber)}
				pageNumber={pageNumber}
				renderAnnotationLayer={false}
				renderTextLayer={false}
				width={pageWidth}
			>
				{({ page, pageNumber: renderedPageNumber, rotate, scale }) => (
					<>
						{isVisible ? (
							<FieldClickLayer
								fieldTargets={fieldTargets}
								onFieldSelect={onFieldSelect}
								page={page}
								pageNumber={renderedPageNumber}
								rotate={rotate}
								scale={scale}
							/>
						) : null}
						{isVisible ? (
							<FieldScrollEffect
								activeFieldHighlight={activeFieldHighlight}
								activeFieldNavigationKey={activeFieldNavigationKey}
								fieldTargets={fieldTargets}
								lastScrolledFieldKeyRef={lastScrolledFieldKeyRef}
								page={page}
								pageNumber={renderedPageNumber}
								rotate={rotate}
								scale={scale}
								scrollContainer={scrollContainer}
							/>
						) : null}
						{isVisible ? (
							<HighlightOverlay
								activeFieldHighlights={activeFieldHighlights}
								fieldTargets={fieldTargets}
								page={page}
								pageNumber={renderedPageNumber}
								rotate={rotate}
								scale={scale}
							/>
						) : null}
					</>
				)}
			</Page>
		</Document>
	</div>
);

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

const usePdfViewState = ({
	activeFieldHighlight,
	activeFieldNavigationKey,
	pdfFile,
	resetKey,
}: PdfViewStateParams): PdfViewState => {
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const scrollTopRef = useRef(0);
	const nextBufferIdRef = useRef(1);
	const currentGenerationRef = useRef(0);
	const lastNavigatedFieldKeyRef = useRef<string | null>(null);
	const lastScrolledFieldKeyRef = useRef<string | null>(null);
	const pendingScrollRestoreTopRef = useRef<number | null>(null);
	const [visibleBuffer, setVisibleBuffer] = useState<PdfBuffer | null>(null);
	const [pendingBuffer, setPendingBuffer] = useState<PdfBuffer | null>(null);
	const [bufferLoadStates, setBufferLoadStates] = useState<Record<number, PdfBufferLoadState>>({});
	const [pageNumber, setPageNumber] = useState(1);

	const visibleLoadState = visibleBuffer ? bufferLoadStates[visibleBuffer.id] : undefined;
	const pendingLoadState = pendingBuffer ? bufferLoadStates[pendingBuffer.id] : undefined;
	const fieldTargets = visibleLoadState?.fieldTargets ?? emptyFieldTargets;
	const numPages = visibleLoadState?.numPages;
	const visibleBufferFile = visibleBuffer?.file;
	const pendingBufferFile = pendingBuffer?.file;

	const handleScrollContainerScroll = useCallback(() => {
		scrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
	}, []);

	useLayoutEffect(() => {
		const scrollTop = pendingScrollRestoreTopRef.current;
		if (scrollTop === null) {
			return;
		}

		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop = scrollTop;
		}
		scrollTopRef.current = scrollTop;
		pendingScrollRestoreTopRef.current = null;
	}, [visibleBuffer?.id]);

	useEffect(() => {
		currentGenerationRef.current += 1;
		nextBufferIdRef.current = 1;
		lastNavigatedFieldKeyRef.current = null;
		lastScrolledFieldKeyRef.current = null;
		pendingScrollRestoreTopRef.current = null;
		scrollTopRef.current = 0;
		setPageNumber(1);
		setVisibleBuffer(null);
		setPendingBuffer(null);
		setBufferLoadStates({});
	}, [resetKey]);

	useEffect(() => {
		if (!pdfFile) {
			currentGenerationRef.current += 1;
			setVisibleBuffer(null);
			setPendingBuffer(null);
			setBufferLoadStates({});
			return;
		}

		if (visibleBufferFile === pdfFile || pendingBufferFile === pdfFile) {
			return;
		}

		const nextBuffer = createPdfBuffer(
			pdfFile,
			nextBufferIdRef.current,
			currentGenerationRef.current,
		);
		nextBufferIdRef.current += 1;
		if (!nextBuffer) {
			return;
		}

		setPendingBuffer(nextBuffer);
	}, [pdfFile, pendingBufferFile, visibleBufferFile]);

	useEffect(() => {
		if (!activeFieldHighlight) {
			return;
		}
		const navigationKey = `${getHighlightKey(activeFieldHighlight)}:${activeFieldNavigationKey ?? ""}`;
		if (lastNavigatedFieldKeyRef.current === navigationKey) {
			return;
		}

		const target = findHighlightedTarget(fieldTargets, activeFieldHighlight);
		if (!target) {
			return;
		}

		setPageNumber(target.pageNumber);
		lastNavigatedFieldKeyRef.current = navigationKey;
	}, [activeFieldHighlight, activeFieldNavigationKey, fieldTargets]);

	useEffect(() => {
		if (!numPages || pageNumber <= numPages) {
			return;
		}
		setPageNumber(numPages);
	}, [numPages, pageNumber]);

	useLayoutEffect(() => {
		if (!pendingBuffer || !pendingLoadState) {
			return;
		}
		if (
			!pendingLoadState.areFieldTargetsLoaded ||
			pendingLoadState.numPages === undefined ||
			pendingLoadState.paintedPageNumber !== pageNumber
		) {
			return;
		}

		pendingScrollRestoreTopRef.current = scrollTopRef.current;
		setVisibleBuffer(pendingBuffer);
		setPendingBuffer(null);
		setBufferLoadStates((currentStates) => ({
			[pendingBuffer.id]: currentStates[pendingBuffer.id] ?? pendingLoadState,
		}));
	}, [pageNumber, pendingBuffer, pendingLoadState]);

	const handleDocumentLoadError = useCallback((error: Error): void => {
		console.error("PDF load error:", error);
	}, []);

	const handleDocumentLoadSuccess = useCallback(
		(buffer: PdfBuffer, pdfDocument: PdfDocumentForAnnotations): void => {
			if (buffer.generation !== currentGenerationRef.current) {
				return;
			}
			setBufferLoadStates((currentStates) => ({
				...currentStates,
				[buffer.id]: {
					...(currentStates[buffer.id] ?? {
						areFieldTargetsLoaded: false,
						fieldTargets: new Map<string, PdfFieldTarget[]>(),
					}),
					numPages: pdfDocument.numPages,
				},
			}));

			const loadFieldTargets = async () => {
				try {
					const nextFieldTargets = await collectFieldTargets(pdfDocument);
					setBufferLoadStates((currentStates) => {
						if (buffer.generation !== currentGenerationRef.current || !currentStates[buffer.id]) {
							return currentStates;
						}
						return {
							...currentStates,
							[buffer.id]: {
								...currentStates[buffer.id],
								areFieldTargetsLoaded: true,
								fieldTargets: nextFieldTargets,
							},
						};
					});
				} catch (error) {
					console.error("PDF annotation load error:", error);
					setBufferLoadStates((currentStates) => {
						if (buffer.generation !== currentGenerationRef.current || !currentStates[buffer.id]) {
							return currentStates;
						}
						return {
							...currentStates,
							[buffer.id]: {
								...currentStates[buffer.id],
								areFieldTargetsLoaded: true,
								fieldTargets: new Map<string, PdfFieldTarget[]>(),
							},
						};
					});
				}
			};

			void loadFieldTargets();
		},
		[],
	);

	const handlePageRenderSuccess = useCallback((buffer: PdfBuffer, renderedPageNumber: number) => {
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				setBufferLoadStates((currentStates) => {
					if (buffer.generation !== currentGenerationRef.current || !currentStates[buffer.id]) {
						return currentStates;
					}
					return {
						...currentStates,
						[buffer.id]: {
							...currentStates[buffer.id],
							paintedPageNumber: renderedPageNumber,
						},
					};
				});
			});
		});
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
		handlePageRenderSuccess,
		handlePreviousPage,
		handleScrollContainerScroll,
		lastScrolledFieldKeyRef,
		numPages,
		pageNumber,
		pendingBuffer,
		pendingFieldTargets: pendingLoadState?.fieldTargets ?? emptyFieldTargets,
		pendingNumPages: pendingLoadState?.numPages,
		scrollContainerRef,
		visibleBuffer,
	};
};

export const PDFViewSection = ({
	activeFieldNavigationKey,
	activeFieldName,
	activeFieldNames,
	activeFieldHighlights,
	hasUploadedFile = false,
	onFieldSelect,
	pdfFile,
	resetKey,
}: PDFViewSectionProps) => {
	const resolvedActiveFieldHighlights = resolveActiveFieldHighlights(
		activeFieldHighlights,
		activeFieldNames,
		activeFieldName,
	);
	const [primaryActiveFieldHighlight] = resolvedActiveFieldHighlights;
	const { containerWidth, setContainerRef } = useContainerWidth();
	const {
		fieldTargets,
		handleDocumentLoadError,
		handleDocumentLoadSuccess,
		handleNextPage,
		handlePageRenderSuccess,
		handlePreviousPage,
		handleScrollContainerScroll,
		lastScrolledFieldKeyRef,
		numPages,
		pageNumber,
		pendingBuffer,
		pendingFieldTargets,
		pendingNumPages,
		scrollContainerRef,
		visibleBuffer,
	} = usePdfViewState({
		activeFieldHighlight: primaryActiveFieldHighlight,
		activeFieldNavigationKey,
		pdfFile,
		resetKey,
	});

	if (!(visibleBuffer || pendingBuffer)) {
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

	const effectiveNumPages = numPages ?? pendingNumPages;
	const hasMultiplePages = Boolean(effectiveNumPages && effectiveNumPages > 1);
	const showPageControls = Boolean(visibleBuffer && numPages && numPages > 1 && hasUploadedFile);
	const pageWidth =
		hasUploadedFile && hasMultiplePages
			? getPageWidth(containerWidth, 120)
			: getPageWidth(containerWidth, 16);
	const bufferViews = [
		pendingBuffer
			? {
					buffer: pendingBuffer,
					fieldTargets: pendingFieldTargets,
					isVisible: false,
				}
			: null,
		visibleBuffer
			? {
					buffer: visibleBuffer,
					fieldTargets,
					isVisible: true,
				}
			: null,
	].filter((bufferView) => bufferView !== null);

	return (
		<div className="h-full min-h-0">
			<div
				className="relative flex h-full min-h-0 items-start justify-center overflow-hidden"
				ref={setContainerRef}
			>
				<div
					className="h-full min-h-0 w-full overflow-auto"
					onScroll={handleScrollContainerScroll}
					ref={scrollContainerRef}
				>
					<div className="relative min-h-full w-full">
						{bufferViews.map((bufferView) => (
							<PdfBufferView
								activeFieldHighlight={primaryActiveFieldHighlight}
								activeFieldHighlights={resolvedActiveFieldHighlights}
								activeFieldNavigationKey={activeFieldNavigationKey}
								buffer={bufferView.buffer}
								fieldTargets={bufferView.fieldTargets}
								isVisible={bufferView.isVisible}
								key={bufferView.buffer.id}
								lastScrolledFieldKeyRef={lastScrolledFieldKeyRef}
								onDocumentLoadError={handleDocumentLoadError}
								onDocumentLoadSuccess={handleDocumentLoadSuccess}
								onFieldSelect={onFieldSelect}
								onPageRenderSuccess={handlePageRenderSuccess}
								pageNumber={pageNumber}
								pageWidth={pageWidth}
								scrollContainer={scrollContainerRef.current}
							/>
						))}
						{visibleBuffer ? null : (
							<div className="flex min-h-full w-full items-center justify-center p-4" key="loading">
								{pdfLoadingPlaceholder}
							</div>
						)}
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
