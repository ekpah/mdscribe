"use client";

import { Card } from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { FileText, ListChecks } from "lucide-react";
import { createMdscribeSource, resolveCitation } from "markdoc-md/citations";
import type { CitationRequest, CitationTextSource } from "markdoc-md/citations";
import type { InputTagType } from "markdoc-md/parse";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { CitationPreviewDialog } from "@/app/_components/citation-preview-dialog";
import type { CitationPreview } from "@/app/_components/citation-preview-dialog";
import { consumeContextTransferFromFragment } from "@/app/_components/context-transfer/client";
import { hydrateInputContextController } from "@/app/_components/context-transfer/hydrate";
import {
	InputContextControls,
	useInputContextState,
} from "@/app/_components/input-context/input-context-controls";
import { trackEvent } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";
import { resolveOcrDocumentCitation } from "@/lib/citations/resolve-ocr-document-citation";
import type { OcrResult } from "@/lib/ocr-types";
import { orpc } from "@/lib/orpc";

import type {
	FillInputsAudioFile,
	FillInputsContextFile,
	FillInputsInputField,
	FillInputsTextContext,
} from "./inputs/inputs";
import Inputs from "./inputs/inputs";

type MobilePanel = "inputs" | "preview";

interface InputPreviewSectionProps {
	activeInputFocusKey?: string | number;
	activeInputName?: string | null;
	activePreviewFocusKey?: string | number;
	contentType: "document" | "template";
	edgeTabs?: ReactNode;
	inputTags: InputTagType[];
	onInputBlur?: (inputName: string) => void;
	onInputSelect?: (inputName: string) => void;
	onValuesChange?: (values: Record<string, unknown>) => void;
	preview: (
		values: Record<string, unknown>,
		onCitationSelect: (citation: CitationRequest) => void,
	) => ReactNode;
	previewToolbar?: ReactNode;
	resetKey?: string;
	templateExamples?: string[];
	templateInformation?: string;
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

const getMobileTabClassName = (isActive: boolean) =>
	cn(
		"relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border-b px-1 text-muted-foreground transition-colors last:border-b-0 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		isActive && "bg-background text-foreground shadow-xs",
	);

const MobilePanelTab = ({
	controls,
	icon,
	id,
	isActive,
	label,
	onClick,
}: {
	controls: string;
	icon: ReactNode;
	id: string;
	isActive: boolean;
	label: string;
	onClick: () => void;
}) => (
	<button
		aria-controls={controls}
		aria-label={`${label} anzeigen`}
		aria-selected={isActive}
		className={getMobileTabClassName(isActive)}
		id={id}
		onClick={onClick}
		role="tab"
		type="button"
	>
		<span
			className={cn(
				"absolute left-0 h-10 w-1 rounded-r-full",
				isActive ? "bg-primary" : "bg-transparent",
			)}
		/>
		{icon}
		<span className="rotate-180 font-medium text-[11px] leading-none [writing-mode:vertical-rl]">
			{label}
		</span>
	</button>
);

const MobilePanelTabs = ({
	mobilePanel,
	mobileTabId,
	onPanelChange,
}: {
	mobilePanel: MobilePanel;
	mobileTabId: string;
	onPanelChange: (panel: MobilePanel) => void;
}) => (
	<div
		aria-label="Mobile Ansicht"
		className="flex w-11 shrink-0 flex-col border-r bg-muted/30 md:hidden"
		role="tablist"
	>
		<MobilePanelTab
			controls={`${mobileTabId}-preview-panel`}
			icon={<FileText aria-hidden className="h-4 w-4" />}
			id={`${mobileTabId}-preview-tab`}
			isActive={mobilePanel === "preview"}
			label="Template"
			onClick={() => onPanelChange("preview")}
		/>
		<MobilePanelTab
			controls={`${mobileTabId}-inputs-panel`}
			icon={<ListChecks aria-hidden className="h-4 w-4" />}
			id={`${mobileTabId}-inputs-tab`}
			isActive={mobilePanel === "inputs"}
			label="Eingaben"
			onClick={() => onPanelChange("inputs")}
		/>
	</div>
);

const getInputPanelClassName = (hasInputTags: boolean, mobilePanel: MobilePanel) =>
	cn(
		"min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:col-span-1",
		hasInputTags && mobilePanel === "inputs" && "flex",
		hasInputTags && mobilePanel !== "inputs" && "hidden md:flex",
		!hasInputTags && "hidden",
	);

const getPreviewPanelClassName = (
	hasInputTags: boolean,
	mobilePanel: MobilePanel,
	hasEdgeTabs: boolean,
) =>
	cn(
		"relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4",
		hasInputTags && mobilePanel === "preview" && "flex",
		hasInputTags && mobilePanel !== "preview" && "hidden md:flex",
		!hasInputTags && "flex",
		hasInputTags ? "md:col-span-2 md:border-l" : "md:col-span-3",
		hasEdgeTabs && "pr-14",
	);

export const InputPreviewSection = ({
	activeInputFocusKey,
	activeInputName,
	activePreviewFocusKey,
	contentType,
	edgeTabs,
	inputTags,
	onInputBlur,
	onInputSelect,
	onValuesChange,
	preview,
	previewToolbar,
	resetKey,
	templateExamples,
	templateInformation,
}: InputPreviewSectionProps) => {
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [mobilePanel, setMobilePanel] = useState<MobilePanel>("preview");
	const [previewPanelElement, setPreviewPanelElement] = useState<HTMLDivElement | null>(null);
	const [usesPreviewPanelPortal, setUsesPreviewPanelPortal] = useState(false);
	const [citationPreviews, setCitationPreviews] = useState<CitationPreview[] | null>(null);
	const inputContextController = useInputContextState();
	const citationAbortControllerRef = useRef<AbortController | null>(null);
	const citationFilesRef = useRef<ReadonlyMap<string, File>>(new Map());
	const citationOcrResultsRef = useRef<ReadonlyMap<File, OcrResult>>(new Map());
	const citationPreviewsRef = useRef<CitationPreview[] | null>(null);
	const citationTextSourcesRef = useRef<ReadonlyMap<string, CitationTextSource>>(new Map());
	const lastInputFocusKeyRef = useRef(activeInputFocusKey);
	const lastPreviewFocusKeyRef = useRef(activePreviewFocusKey);
	const mobileTabId = useId();
	const { data: session } = useSession();
	const isLoggedIn = Boolean(session?.user?.id);
	const hasInputTags = inputTags.length > 0;

	useEffect(() => {
		setValues({});
		onValuesChange?.({});
	}, [onValuesChange, resetKey]);

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

	useEffect(() => {
		if (!hasInputTags) {
			setMobilePanel("preview");
		}
	}, [hasInputTags]);

	useEffect(() => {
		if (
			activeInputFocusKey !== undefined &&
			!Object.is(lastInputFocusKeyRef.current, activeInputFocusKey)
		) {
			lastInputFocusKeyRef.current = activeInputFocusKey;
			setMobilePanel("inputs");
		}
	}, [activeInputFocusKey]);

	useEffect(() => {
		if (
			activePreviewFocusKey === undefined ||
			Object.is(lastPreviewFocusKeyRef.current, activePreviewFocusKey)
		) {
			return;
		}
		if (mobilePanel !== "preview") {
			return;
		}
		lastPreviewFocusKeyRef.current = activePreviewFocusKey;
		if (!activeInputName || !previewPanelElement) {
			return;
		}
		const activeTag = [
			...previewPanelElement.querySelectorAll<HTMLElement>("[data-markdoc-input]"),
		].find((element) => element.dataset.markdocInput === activeInputName);
		activeTag?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [activeInputName, activePreviewFocusKey, mobilePanel, previewPanelElement]);

	const handleFormChange = useCallback(
		(data: Record<string, unknown>) => {
			setValues(data);
			onValuesChange?.(data);
		},
		[onValuesChange],
	);

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

	const handleFillInputs = useCallback(
		async (
			inputFields: FillInputsInputField[],
			audioFiles: FillInputsAudioFile[],
			textContext: FillInputsTextContext,
			contextFiles: FillInputsContextFile[],
		) => {
			const textSourceSnapshot = createTextSourceSnapshot(textContext);
			const submittedFileIds = new Set(contextFiles.map(({ id }) => id));
			const fileSourceSnapshot = new Map(
				inputContextController.contextFiles
					.filter(({ id }) => submittedFileIds.has(id))
					.map(({ file, id }) => [id, file]),
			);
			const result = await orpc.scribe.fillInputs.call({
				audioFiles,
				contextFiles,
				inputFields,
				templateExamples,
				templateInformation,
				textContext,
			});
			inputContextController.setContextFileOcrResults(result.ocrResults);
			citationFilesRef.current = fileSourceSnapshot;
			citationOcrResultsRef.current = new Map(
				contextFiles.flatMap((contextFile, index) => {
					const file = contextFile.id ? fileSourceSnapshot.get(contextFile.id) : undefined;
					const ocrResult =
						contextFile.kind === "ocr" ? contextFile.ocrResult : result.ocrResults[index];
					return file && ocrResult ? [[file, ocrResult] as const] : [];
				}),
			);
			citationTextSourcesRef.current = textSourceSnapshot;
			trackEvent(`${contentType}-filled-with-ai`);
			return result;
		},
		[contentType, inputContextController, templateExamples, templateInformation],
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
		[],
	);
	const handleCitationSelect = useCallback(
		(citation: CitationRequest) => handleCitationsSelect([citation]),
		[handleCitationsSelect],
	);

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

	const inputPanelClassName = getInputPanelClassName(hasInputTags, mobilePanel);
	const previewPanelClassName = getPreviewPanelClassName(
		hasInputTags,
		mobilePanel,
		Boolean(edgeTabs),
	);

	return (
		<>
			<Card className="relative flex h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] overflow-hidden md:grid md:grid-cols-3">
				{hasInputTags ? (
					<MobilePanelTabs
						mobilePanel={mobilePanel}
						mobileTabId={mobileTabId}
						onPanelChange={setMobilePanel}
					/>
				) : null}
				<div
					aria-labelledby={hasInputTags ? `${mobileTabId}-inputs-tab` : undefined}
					className={inputPanelClassName}
					id={`${mobileTabId}-inputs-panel`}
					key="Inputs"
					role={hasInputTags ? "tabpanel" : undefined}
				>
					<Inputs
						activeInputFocusKey={mobilePanel === "inputs" ? activeInputFocusKey : undefined}
						activeInputName={activeInputName}
						key={resetKey}
						inputTags={inputTags}
						onChange={handleFormChange}
						onCitationsSelect={handleCitationsSelect}
						onFillInputs={isLoggedIn ? handleFillInputs : undefined}
						onInputBlur={onInputBlur}
						onInputSelect={onInputSelect}
						renderFillControls={({ onSubmit }) => (
							<InputContextControls
								className="shrink-0 border-t border-t-solarized-blue/30 bg-solarized-blue/5 px-4 py-3"
								controller={inputContextController}
								onSubmit={async ({ audioFiles, contextFiles, textContext }) => {
									await onSubmit(audioFiles, textContext, contextFiles);
								}}
								panelPortalTarget={usesPreviewPanelPortal ? previewPanelElement : null}
							/>
						)}
						showFillInputs={isLoggedIn}
					/>
				</div>
				{edgeTabs}
				<div
					aria-labelledby={hasInputTags ? `${mobileTabId}-preview-tab` : undefined}
					className={previewPanelClassName}
					id={`${mobileTabId}-preview-panel`}
					key="Preview"
					ref={handlePreviewPanelRef}
					role={hasInputTags ? "tabpanel" : undefined}
				>
					{previewToolbar ? (
						<div className="mb-3 flex items-center gap-2">{previewToolbar}</div>
					) : null}
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
						{preview(values, handleCitationSelect)}
					</div>
				</div>
			</Card>
			<CitationPreviewDialog
				onOpenChange={handleCitationDialogChange}
				previews={citationPreviews}
			/>
		</>
	);
};
