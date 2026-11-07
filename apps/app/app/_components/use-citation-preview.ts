"use client";

import { resolveCitation } from "markdoc-md/citations";
import type { CitationRequest, CitationTextSource } from "markdoc-md/citations";
import { useCallback, useEffect, useRef, useState } from "react";

import type { OcrQuoteMatch } from "@/lib/citations/ocr-quote-matcher";
import { resolveOcrDocumentCitation } from "@/lib/citations/resolve-ocr-document-citation";
import type { OcrResult } from "@/lib/ocr-types";
import { orpc } from "@/lib/orpc";

import type { CitationPreview } from "./citation-preview-dialog";
import { blobToBase64 } from "./inputs/audio-submission";

interface CitationPreviewSources {
	files: ReadonlyMap<string, File>;
	texts: ReadonlyMap<string, CitationTextSource>;
	getOcrResult: (file: File, citation: CitationRequest) => OcrResult | undefined;
}

type QuoteLocator = (
	file: File,
	quote: string,
	signal?: AbortSignal,
) => Promise<OcrQuoteMatch | null>;

const locateDocumentQuote: QuoteLocator = async (file, quote, signal) => {
	const locations = await orpc.scribe.resolveDocumentCitations.call(
		{
			file: {
				data: await blobToBase64(file),
				mimeType: file.type,
				name: file.name,
				size: file.size,
			},
			quotes: [quote],
		},
		{ signal },
	);
	return locations[0] ?? null;
};

/** Owns one dialog session; source snapshots and optional locator caches stay with callers. */
export const useCitationPreview = ({
	getSources,
	locateQuote = locateDocumentQuote,
}: {
	getSources: () => CitationPreviewSources;
	locateQuote?: QuoteLocator;
}) => {
	const [previews, setPreviews] = useState<CitationPreview[] | null>(null);
	const sessionRef = useRef<{ controller: AbortController; urls: Set<string> } | null>(null);
	const releaseSession = useCallback(() => {
		const session = sessionRef.current;
		sessionRef.current = null;
		session?.controller.abort();
		for (const url of session?.urls ?? []) {
			URL.revokeObjectURL(url);
		}
	}, []);
	useEffect(() => releaseSession, [releaseSession]);

	const selectCitations = useCallback(
		async (citations: CitationRequest[]) => {
			if (!citations.length) {
				return;
			}
			releaseSession();
			const session = { controller: new AbortController(), urls: new Set<string>() };
			sessionRef.current = session;
			const { signal } = session.controller;
			const { files, texts, getOcrResult } = getSources();
			setPreviews(citations.map(({ source }) => ({ kind: "loading", source })));
			const resolutions = await Promise.all(
				citations.map((citation) =>
					resolveCitation(citation, {
						createFileUrl: (file) => {
							signal.throwIfAborted();
							const url = URL.createObjectURL(file);
							session.urls.add(url);
							return url;
						},
						documentResolver: (file, quote, requestSignal) =>
							resolveOcrDocumentCitation(file, quote, {
								locateQuote,
								ocrResult: getOcrResult(file, citation),
								signal: requestSignal,
							}),
						files,
						signal,
						texts,
					}),
				),
			);
			if (!signal.aborted) {
				setPreviews(resolutions);
			}
		},
		[getSources, locateQuote, releaseSession],
	);
	const onOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				releaseSession();
				setPreviews(null);
			}
		},
		[releaseSession],
	);

	return { onOpenChange, previews, selectCitations };
};
