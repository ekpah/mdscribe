"use client";

import { Loader2 } from "lucide-react";
import { useMemo } from "react";

import { CitationPreviewDialog } from "@/app/_components/citation-preview-dialog";
import { useCitationPreview } from "@/app/_components/use-citation-preview";
import { MemoizedCopySection } from "@/app/aiscribe/_components/memoized-copy-section";
import { addScribeCitations } from "@/features/response-citations/markup";
import type { OcrResult, OcrUIMessage } from "@/lib/ocr-types";

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
	const citations =
		message?.parts.flatMap((p) => (p.type === "data-citation" ? [p.data] : [])) ?? [];
	const citationStatus = message?.parts.findLast((p) => p.type === "data-citation-status");
	const phase = citationStatus?.type === "data-citation-status" ? citationStatus.data : undefined;
	const decoratedContent = addScribeCitations(content, citations);
	const texts = useMemo(
		() =>
			new Map(
				(
					message?.parts.flatMap((p) => (p.type === "data-citation-sources" ? p.data : [])) ?? []
				).map((s) => [s.source, s]),
			),
		[message],
	);
	const {
		previews,
		onOpenChange: closePreview,
		selectCitations,
	} = useCitationPreview({
		getSources: () => ({
			files,
			getOcrResult: (_file, citation) => ocrResults.get(citation.source),
			texts,
		}),
	});
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
			<CitationPreviewDialog onOpenChange={closePreview} previews={previews} />
		</>
	);
};
