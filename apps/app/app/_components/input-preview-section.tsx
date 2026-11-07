"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { Bot, Eraser, Redo2, Undo2 } from "lucide-react";
import { createMdscribeSource, resolveCitation } from "markdoc-md/citations";
import type { CitationRequest, CitationTextSource } from "markdoc-md/citations";
import type { InputTagType } from "markdoc-md/parse";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CitationPreviewDialog } from "@/app/_components/citation-preview-dialog";
import type { CitationPreview } from "@/app/_components/citation-preview-dialog";
import { consumeContextTransferFromFragment } from "@/app/_components/context-transfer/client";
import { hydrateInputContextController } from "@/app/_components/context-transfer/hydrate";
import {
	InputContextControls,
	useInputContextState,
} from "@/app/_components/input-context/input-context-controls";
import { blobToBase64 } from "@/app/_components/inputs/audio-submission";
import { trackEvent } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";
import type { OcrQuoteMatch } from "@/lib/citations/ocr-quote-matcher";
import {
	hasOcrBoxes,
	resolveOcrDocumentCitation,
} from "@/lib/citations/resolve-ocr-document-citation";
import type { OcrResult } from "@/lib/ocr-types";
import { orpc } from "@/lib/orpc";

import type { SideInputsSelection } from "./input-side-panel";
import { InputSidePanelCard } from "./input-side-panel";
import type {
	FillInputsAudioFile,
	FillInputsContextFile,
	FillInputsInputField,
	FillInputsResult,
	FillInputsTextContext,
	TemplateFields,
} from "./inputs/inputs";
import { collectFillInputFields, useTemplateFields } from "./inputs/inputs";
import type { InlineFields } from "./markdoc-inline-inputs";

/** Where field edits happen: inline tags, their details, and the document step bar. */
const fieldEditorSelector = "[data-markdoc-input], [data-inline-panel], [data-field-editor]";

// Matches the batch limit of `resolveDocumentCitations`.
const MAX_LOCATED_QUOTES = 100;

interface InputPreviewSectionProps extends SideInputsSelection {
	contentType: "document" | "template";
	edgeTabs?: ReactNode;
	inputTags: InputTagType[];
	/**
	 * Fields are edited in the preview, with a bottom toolbar, instead of in the
	 * side input column. Gated by `inlineInputsFlag`.
	 */
	inlineInputs?: boolean;
	/** Shows a field for review; templates focus its inline tag by default. */
	onReviewField?: (inputName: string) => void;
	onValuesChange?: (values: Record<string, unknown>) => void;
	preview: (
		values: Record<string, unknown>,
		onCitationSelect: (citation: CitationRequest) => void,
		/** Field states and writes for editing inside the preview. */
		fields: InlineFields,
		/** The complete field state, for editors that reuse the side-form controls. */
		form: TemplateFields,
	) => ReactNode;
	previewToolbar?: ReactNode;
	resetKey?: string;
	templateExamples?: string[];
	templateInformation?: string;
	/** Further global actions in the bottom toolbar, such as copying the text. */
	toolbarActions?: ReactNode;
}

const TEXT_CONTEXT_LABELS: Record<keyof FillInputsTextContext, string> = {
	anamnese: "Anamnese",
	befunde: "Befunde",
	diagnoseblock: "Diagnosen",
	epikrise: "Epikrise",
	notes: "Notizen",
};

const createTextSourceSnapshot = (
	textContext: FillInputsTextContext,
): ReadonlyMap<string, CitationTextSource> =>
	new Map(
		Object.entries(textContext)
			.filter((entry): entry is [keyof FillInputsTextContext, string] => Boolean(entry[1]?.trim()))
			.map(([id, text]) => [
				createMdscribeSource("input", id),
				{ label: TEXT_CONTEXT_LABELS[id], text },
			]),
	);

const revokePreviewUrls = (previews: CitationPreview[] | null) => {
	for (const preview of previews ?? []) {
		if (preview.kind === "document" && preview.url.startsWith("blob:")) {
			URL.revokeObjectURL(preview.url);
		}
	}
};

export const InputPreviewSection = ({
	activeInputFocusKey,
	activeInputName,
	activePreviewFocusKey,
	contentType,
	edgeTabs,
	inlineInputs = false,
	inputTags,
	onInputBlur,
	onInputSelect,
	onReviewField,
	onValuesChange,
	preview,
	previewToolbar,
	resetKey,
	templateExamples,
	templateInformation,
	toolbarActions,
}: InputPreviewSectionProps) => {
	const [previewPanelElement, setPreviewPanelElement] = useState<HTMLDivElement | null>(null);
	const [usesPreviewPanelPortal, setUsesPreviewPanelPortal] = useState(false);
	const [citationPreviews, setCitationPreviews] = useState<CitationPreview[] | null>(null);
	const inputContextController = useInputContextState();
	const citationAbortControllerRef = useRef<AbortController | null>(null);
	const citationFilesRef = useRef<ReadonlyMap<string, File>>(new Map());
	const citationOcrResultsRef = useRef<ReadonlyMap<File, OcrResult>>(new Map());
	// Pending or settled quote locations per document; failed requests are dropped for a retry.
	const citationLocationsRef = useRef(
		new WeakMap<File, Map<string, Promise<OcrQuoteMatch | null>>>(),
	);
	const citationPrefetchRef = useRef<AbortController | null>(null);
	const citationPreviewsRef = useRef<CitationPreview[] | null>(null);
	const citationTextSourcesRef = useRef<ReadonlyMap<string, CitationTextSource>>(new Map());
	const lastReviewedFieldRef = useRef<string | null>(null);
	const { data: session } = useSession();
	const isLoggedIn = Boolean(session?.user?.id);
	const hasInputTags = inputTags.length > 0;

	const inputContextControllerRef = useRef(inputContextController);
	inputContextControllerRef.current = inputContextController;
	const hasHydratedTransferRef = useRef(false);

	useEffect(() => {
		if (hasHydratedTransferRef.current) {
			return;
		}
		hasHydratedTransferRef.current = true;

		const hydrateTransfer = async () => {
			try {
				const payload = await consumeContextTransferFromFragment();
				if (payload) {
					hydrateInputContextController(inputContextControllerRef.current, payload);
				}
			} catch (error) {
				console.error("Failed to hydrate context transfer:", error);
				toast.error("Kontext konnte nicht übernommen werden.");
			}
		};

		void hydrateTransfer();
	}, []);

	const handlePreviewPanelRef = useCallback((node: HTMLDivElement | null) => {
		setPreviewPanelElement(node);
	}, []);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 768px)");
		const handleChange = () => {
			setUsesPreviewPanelPortal(mediaQuery.matches);
		};

		handleChange();
		mediaQuery.addEventListener("change", handleChange);

		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
	}, []);

	// One request per document locates all of its quotes; each quote shares that request.
	const locateQuotes = useCallback((file: File, quotes: string[], signal?: AbortSignal) => {
		const cache = citationLocationsRef.current.get(file) ?? new Map();
		citationLocationsRef.current.set(file, cache);
		const missing = [...new Set(quotes)].filter((quote) => !cache.has(quote));
		for (let start = 0; start < missing.length; start += MAX_LOCATED_QUOTES) {
			const batch = missing.slice(start, start + MAX_LOCATED_QUOTES);
			const request = (async () =>
				orpc.scribe.resolveDocumentCitations.call(
					{
						file: {
							data: await blobToBase64(file),
							mimeType: file.type,
							name: file.name,
							size: file.size,
						},
						quotes: batch,
					},
					{ signal },
				))();
			const settle = async (index: number) => {
				const locations = await request;
				return locations[index] ?? null;
			};
			// A failed request is forgotten, so opening the citation retries it.
			const forgetOnFailure = async (quote: string, location: Promise<OcrQuoteMatch | null>) => {
				try {
					await location;
				} catch {
					if (cache.get(quote) === location) {
						cache.delete(quote);
					}
				}
			};
			for (const [index, quote] of batch.entries()) {
				const location = settle(index);
				cache.set(quote, location);
				void forgetOnFailure(quote, location);
			}
		}
		return quotes.map((quote) => cache.get(quote) as Promise<OcrQuoteMatch | null>);
	}, []);

	const handleFillInputs = useCallback(
		async (
			inputFields: FillInputsInputField[],
			audioFiles: FillInputsAudioFile[],
			textContext: FillInputsTextContext,
			contextFiles: FillInputsContextFile[],
			onProgress?: (result: FillInputsResult, stage: "decisions" | "values") => void,
		) => {
			const textSourceSnapshot = createTextSourceSnapshot(textContext);
			const submittedFileIds = new Set(contextFiles.map(({ id }) => id));
			const fileSourceSnapshot = new Map(
				inputContextController.contextFiles
					.filter(({ id }) => submittedFileIds.has(id))
					.map(({ file, id }) => [id, file]),
			);
			citationPrefetchRef.current?.abort();
			citationLocationsRef.current = new WeakMap();
			// Citations of early decision-model answers must already be resolvable.
			const rememberSources = ({ ocrResults }: FillInputsResult) => {
				inputContextController.setContextFileOcrResults(
					ocrResults,
					contextFiles.map(({ id }) => id),
				);
				citationFilesRef.current = fileSourceSnapshot;
				citationOcrResultsRef.current = new Map(
					contextFiles.flatMap((contextFile, index) => {
						const file = contextFile.id ? fileSourceSnapshot.get(contextFile.id) : undefined;
						const ocrResult = ocrResults[index] ?? contextFile.ocrResult;
						return file && ocrResult ? [[file, ocrResult] as const] : [];
					}),
				);
				citationTextSourcesRef.current = textSourceSnapshot;
			};
			let complete: FillInputsResult | undefined;
			const events = await orpc.scribe.fillInputsStream.call({
				audioFiles,
				contextFiles,
				inputFields,
				templateExamples,
				templateInformation,
				textContext,
			});
			for await (const event of events) {
				rememberSources(event);
				if (event.stage === "complete") {
					complete = event;
				} else {
					onProgress?.(event, event.stage);
				}
			}
			if (!complete) {
				throw new Error("Die Antwort ist unvollständig.");
			}
			trackEvent(`${contentType}-filled-with-ai`);
			// Locate document citations right away, so opening one does not wait.
			const prefetch = new AbortController();
			citationPrefetchRef.current = prefetch;
			for (const [id, file] of fileSourceSnapshot) {
				const source = createMdscribeSource("file", id);
				const quotes = Object.values(complete.suggestions).flatMap(({ citations }) =>
					(citations ?? []).flatMap((citation) => {
						const quote = citation.source === source ? citation.quote?.trim() : undefined;
						return quote && quote.length <= 4000 ? [quote] : [];
					}),
				);
				if (quotes.length && !hasOcrBoxes(citationOcrResultsRef.current.get(file))) {
					locateQuotes(file, quotes, prefetch.signal);
				}
			}
			return complete;
		},
		[contentType, inputContextController, locateQuotes, templateExamples, templateInformation],
	);

	const handleCitationsSelect = useCallback(
		(citations: CitationRequest[]) => {
			if (citations.length === 0) {
				return;
			}
			citationAbortControllerRef.current?.abort();
			const abortController = new AbortController();
			citationAbortControllerRef.current = abortController;
			setCitationPreviews((current) => {
				revokePreviewUrls(current);
				return citations.map(({ source }) => ({ kind: "loading", source }));
			});

			void (async () => {
				const resolutions = await Promise.all(
					citations.map((citation) =>
						resolveCitation(citation, {
							documentResolver: (file, quote, signal) =>
								resolveOcrDocumentCitation(file, quote, {
									locateQuote: async (document, exactQuote, requestSignal) => {
										const [location] = locateQuotes(document, [exactQuote], requestSignal);
										const match = await location;
										requestSignal?.throwIfAborted();
										return match;
									},
									ocrResult: citationOcrResultsRef.current.get(file),
									signal,
								}),
							files: citationFilesRef.current,
							signal: abortController.signal,
							texts: citationTextSourcesRef.current,
						}),
					),
				);
				if (abortController.signal.aborted) {
					return;
				}
				setCitationPreviews((current) => {
					revokePreviewUrls(current);
					return resolutions;
				});
			})();
		},
		[locateQuotes],
	);
	const handleCitationSelect = useCallback(
		(citation: CitationRequest) => handleCitationsSelect([citation]),
		[handleCitationsSelect],
	);
	const fields = useTemplateFields(inputTags, {
		onFillInputs: isLoggedIn ? handleFillInputs : undefined,
	});
	const { reset, setValue, clearHandlers, states, values, fieldSources, undo, redo } = fields;

	// A new template or document starts empty, with nothing to undo.
	useEffect(() => {
		reset(true);
	}, [reset, resetKey]);

	// ⌘/Ctrl+Z undoes and ⇧⌘/Ctrl+Shift+Z or Ctrl+Y redoes field changes, also while
	// typing in a field. Other text boxes, such as the context notes, keep their own undo.
	useEffect(() => {
		if (!inlineInputs) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			const key = event.key.toLowerCase();
			const isUndo = key === "z" && !event.shiftKey;
			const isRedo = (key === "z" && event.shiftKey) || (key === "y" && !event.metaKey);
			if (!(event.metaKey || event.ctrlKey) || event.altKey || !(isUndo || isRedo)) {
				return;
			}
			const active = document.activeElement;
			const isEditable =
				active instanceof HTMLElement &&
				(active.matches("input, textarea, select") || active.isContentEditable);
			const isFieldEditor = Boolean(active?.closest(fieldEditorSelector));
			if (isEditable && !isFieldEditor) {
				return;
			}
			event.preventDefault();
			// A field shows its own draft while focused; refocus it to show the restored value.
			const field = isEditable && active instanceof HTMLElement ? active : null;
			field?.blur();
			if (isUndo) {
				undo();
			} else {
				redo();
			}
			if (field) {
				requestAnimationFrame(() => {
					if (field.isConnected) {
						field.focus({ preventScroll: true });
					}
				});
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [inlineInputs, redo, undo]);

	useEffect(() => {
		onValuesChange?.(values);
	}, [onValuesChange, values]);

	const inlineFields = useMemo<InlineFields>(
		() => ({
			clearValue: (key) => clearHandlers[key]?.(),
			setValue,
			showSources: handleCitationsSelect,
			states,
		}),
		[clearHandlers, handleCitationsSelect, setValue, states],
	);

	// Unconfirmed AI values in form order; each click shows the next one.
	const aiFieldNames = useMemo(
		() =>
			collectFillInputFields(inputTags)
				.fields.map(({ label }) => label)
				.filter((name) => fieldSources[name] === "ai"),
		[fieldSources, inputTags],
	);
	const handleReviewNext = useCallback(() => {
		const last = lastReviewedFieldRef.current;
		const next = aiFieldNames[(last ? aiFieldNames.indexOf(last) : -1) + 1] ?? aiFieldNames[0];
		if (!next) {
			return;
		}
		lastReviewedFieldRef.current = next;
		if (onReviewField) {
			onReviewField(next);
			return;
		}
		const tag = [
			...(previewPanelElement?.querySelectorAll<HTMLElement>("[data-markdoc-input]") ?? []),
		].find((element) => element.dataset.markdocInput === next && element.getClientRects().length);
		const control = tag?.matches("[data-tag-focus]")
			? tag
			: tag?.querySelector<HTMLElement>("[data-tag-focus]");
		control?.scrollIntoView({ behavior: "smooth", block: "center" });
		control?.focus({ preventScroll: true });
	}, [aiFieldNames, onReviewField, previewPanelElement]);

	const handleCitationDialogChange = useCallback((open: boolean) => {
		if (open) {
			return;
		}
		citationAbortControllerRef.current?.abort();
		citationAbortControllerRef.current = null;
		setCitationPreviews((current) => {
			revokePreviewUrls(current);
			return null;
		});
	}, []);

	useEffect(() => {
		citationPreviewsRef.current = citationPreviews;
	}, [citationPreviews]);

	useEffect(
		() => () => {
			citationAbortControllerRef.current?.abort();
			revokePreviewUrls(citationPreviewsRef.current);
		},
		[],
	);

	const fillControls =
		hasInputTags && fields.fill ? (
			<InputContextControls
				className={
					inlineInputs
						? "w-auto shrink-0"
						: "shrink-0 border-t border-t-solarized-blue/30 bg-solarized-blue/5 px-4 py-3"
				}
				closeOnSubmit={inlineInputs}
				controller={inputContextController}
				onSubmit={async ({ audioFiles, contextFiles, textContext }) => {
					await fields.fill?.(audioFiles, textContext, contextFiles);
				}}
				panelPortalTarget={usesPreviewPanelPortal ? previewPanelElement : null}
			/>
		) : null;
	const citationDialog = (
		<CitationPreviewDialog onOpenChange={handleCitationDialogChange} previews={citationPreviews} />
	);

	if (!inlineInputs) {
		return (
			<>
				<InputSidePanelCard
					activeInputFocusKey={activeInputFocusKey}
					activeInputName={activeInputName}
					activePreviewFocusKey={activePreviewFocusKey}
					contentType={contentType}
					edgeTabs={edgeTabs}
					fields={fields}
					fillControls={fillControls}
					inputTags={inputTags}
					onCitationsSelect={handleCitationsSelect}
					onInputBlur={onInputBlur}
					onInputSelect={onInputSelect}
					preview={preview(values, handleCitationSelect, inlineFields, fields)}
					previewPanelElement={previewPanelElement}
					previewPanelRef={handlePreviewPanelRef}
					previewToolbar={previewToolbar}
				/>
				{citationDialog}
			</>
		);
	}

	return (
		<>
			{/* Inline-size containment keeps a wide PDF or step bar from widening the page on phones. */}
			<Card className="relative flex h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] flex-col gap-0 overflow-hidden py-0 [contain:inline-size]">
				{edgeTabs}
				<div
					className={cn(
						"relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4",
						edgeTabs && "pr-14",
					)}
					ref={handlePreviewPanelRef}
				>
					{previewToolbar ? (
						<div className="mb-3 flex flex-wrap items-center gap-2">{previewToolbar}</div>
					) : null}
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
						{preview(values, handleCitationSelect, inlineFields, fields)}
					</div>
				</div>
				{hasInputTags ? (
					// Context, fill and the actions that apply to every field.
					// It covers the side tabs where a short screen runs them into it, and wraps
					// the field actions onto a second row instead of squeezing the buttons.
					<div className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-t-solarized-blue/30 bg-card bg-linear-to-b from-solarized-blue/5 to-solarized-blue/5 px-3 py-2">
						{fillControls}
						<div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
							{aiFieldNames.length ? (
								<Button
									className="border-solarized-orange/40 text-solarized-orange hover:text-solarized-orange"
									onClick={handleReviewNext}
									size="sm"
									type="button"
									variant="outline"
								>
									<Bot aria-hidden className="h-4 w-4" />
									<span aria-hidden className="sm:hidden">
										{aiFieldNames.length}
									</span>
									<span className="max-sm:sr-only">
										{aiFieldNames.length === 1
											? "1 KI-Wert prüfen"
											: `${aiFieldNames.length} KI-Werte prüfen`}
									</span>
								</Button>
							) : null}
							<Button
								aria-label="Rückgängig"
								disabled={!fields.canUndo}
								onClick={undo}
								size="icon"
								title="Rückgängig (⌘Z / Strg+Z)"
								type="button"
								variant="outline"
							>
								<Undo2 aria-hidden className="h-4 w-4" />
							</Button>
							<Button
								aria-label="Wiederholen"
								disabled={!fields.canRedo}
								onClick={redo}
								size="icon"
								title="Wiederholen (⇧⌘Z / Strg+Y)"
								type="button"
								variant="outline"
							>
								<Redo2 aria-hidden className="h-4 w-4" />
							</Button>
							<Button
								aria-label="Alle Eingaben leeren"
								className="h-8 max-sm:w-8 max-sm:px-0"
								onClick={() => reset()}
								size="sm"
								title="Alle Eingaben leeren"
								type="button"
								variant="outline"
							>
								<Eraser aria-hidden className="h-4 w-4" />
								<span className="max-sm:sr-only">Alle leeren</span>
							</Button>
							{toolbarActions}
						</div>
					</div>
				) : null}
			</Card>
			{citationDialog}
		</>
	);
};
