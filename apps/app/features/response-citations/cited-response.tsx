"use client";

import { Loader2, Quote } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

import { CitationPreviewDialog } from "@/app/_components/citation-preview-dialog";
import { useCitationPreview } from "@/app/_components/use-citation-preview";
import { MemoizedCopySection } from "@/app/aiscribe/_components/memoized-copy-section";
import { addScribeCitations } from "@/features/response-citations/markup";
import type { OcrResult, OcrUIMessage } from "@/lib/ocr-types";

const NO_FILES: ReadonlyMap<string, File> = new Map();
const NO_OCR: ReadonlyMap<string, OcrResult> = new Map();

/** Citations, their phase and source previews of one generated message. */
const useResponseCitations = ({
	files = NO_FILES,
	message,
	ocrResults = NO_OCR,
}: {
	files?: ReadonlyMap<string, File>;
	message?: OcrUIMessage;
	ocrResults?: ReadonlyMap<string, OcrResult>;
}) => {
	const citations = useMemo(
		() => message?.parts.flatMap((p) => (p.type === "data-citation" ? [p.data] : [])) ?? [],
		[message],
	);
	const citationStatus = message?.parts.findLast((p) => p.type === "data-citation-status");
	const phase = citationStatus?.type === "data-citation-status" ? citationStatus.data : undefined;
	const texts = useMemo(
		() =>
			new Map(
				(
					message?.parts.flatMap((p) => (p.type === "data-citation-sources" ? p.data : [])) ?? []
				).map((s) => [s.source, s]),
			),
		[message],
	);
	const { previews, onOpenChange, prefetch, selectCitations } = useCitationPreview({
		getSources: useCallback(
			() => ({
				files,
				getOcrResult: (_file: File, citation: { source: string }) =>
					ocrResults.get(citation.source),
				texts,
			}),
			[files, ocrResults, texts],
		),
	});
	// Locate document quotes once all citations have arrived, so opening one does not wait.
	useEffect(() => {
		if (phase === "complete") {
			prefetch(citations.flatMap((span) => span.citations));
		}
	}, [citations, phase, prefetch]);
	const dialog = <CitationPreviewDialog onOpenChange={onOpenChange} previews={previews} />;
	return { citations, dialog, phase, selectCitations };
};

/** The answer and source snapshot belong to one generation, not the editable inputs. */
export const CitedResponse = ({
	content,
	files,
	isStreaming,
	message,
	ocrResults,
}: {
	content: string;
	files: ReadonlyMap<string, File>;
	isStreaming: boolean;
	message?: OcrUIMessage;
	ocrResults: ReadonlyMap<string, OcrResult>;
}) => {
	const { citations, dialog, phase, selectCitations } = useResponseCitations({
		files,
		message,
		ocrResults,
	});
	const decoratedContent = addScribeCitations(content, citations);
	let statusText = "";
	if (phase === "failed") {
		statusText =
			"Quellenhinweise konnten nicht vollständig ergänzt werden. Der Text bleibt verfügbar.";
	} else if (phase === "adding") {
		statusText = `Quellenhinweise werden ergänzt … (${citations.length})`;
	} else if (isStreaming) {
		statusText = "Wird weiter generiert …";
	} else if (citations.length) {
		statusText = `${citations.length} Quellenhinweise · Unterstrichene Aussagen anklicken, um die Quelle zu prüfen.`;
	} else if (phase === "complete") {
		statusText = "Keine passenden Quellenhinweise gefunden.";
	}

	return (
		<>
			<div className="[&_mark[data-citation-source]]:underline [&_mark[data-citation-source]]:decoration-solarized-blue/50 [&_mark[data-citation-source]]:decoration-dotted [&_mark[data-citation-source]]:underline-offset-4">
				<MemoizedCopySection content={decoratedContent} onCitationSelect={selectCitations} />
			</div>
			<output
				aria-live="polite"
				className="mt-3 flex items-center gap-2 text-muted-foreground text-xs"
			>
				{isStreaming && phase !== "complete" && phase !== "failed" ? (
					<Loader2 aria-hidden className="h-3 w-3 animate-spin" />
				) : null}
				<span>{statusText}</span>
			</output>
			{dialog}
		</>
	);
};

/**
 * Cited statements of a generated text as a list, for editors that cannot mark
 * them in place. A statement is listed while `text` still contains it, so edits
 * and rejected suggestions drop their citations.
 */
export const CitationList = ({
	draft,
	message,
	text,
}: {
	/** The generated text the citation offsets refer to. */
	draft: string;
	message?: OcrUIMessage;
	text: string;
}) => {
	const { citations, dialog, phase, selectCitations } = useResponseCitations({ message });
	const statements = citations
		.map((citation) => ({ citation, statement: draft.slice(citation.start, citation.end) }))
		.filter(({ statement }) => statement && text.includes(statement));
	if (phase === "adding") {
		return (
			<output
				aria-live="polite"
				className="mt-2 flex items-center gap-2 text-muted-foreground text-xs"
			>
				<Loader2 aria-hidden className="h-3 w-3 animate-spin" />
				<span>Quellenhinweise werden ergänzt … ({citations.length})</span>
			</output>
		);
	}
	if (!statements.length) {
		return phase === "failed" ? (
			<p className="mt-2 text-muted-foreground text-xs">
				Quellenhinweise konnten nicht ergänzt werden.
			</p>
		) : null;
	}
	return (
		<>
			<div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
				<span className="text-muted-foreground">{statements.length} Quellenhinweise:</span>
				{statements.map(({ citation, statement }) => (
					<button
						className="inline-flex max-w-64 items-center gap-1 rounded-md border border-solarized-blue/30 bg-solarized-blue/5 px-1.5 py-0.5 text-left hover:bg-solarized-blue/15 focus-visible:outline-2 focus-visible:outline-solarized-blue"
						key={`${citation.start}-${citation.end}`}
						onClick={() => selectCitations(citation.citations)}
						title={statement}
						type="button"
					>
						<Quote aria-hidden className="h-3 w-3 shrink-0 text-solarized-blue" />
						<span className="truncate">{statement}</span>
					</button>
				))}
			</div>
			{dialog}
		</>
	);
};
