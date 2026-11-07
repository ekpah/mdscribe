"use client";

import {
	MAX_CITATION_QUOTE_LENGTH,
	parseCitationSource,
	resolveCitation,
} from "markdoc-md/citations";
import type { CitationRequest, CitationTextSource } from "markdoc-md/citations";
import { useCallback, useEffect, useRef, useState } from "react";

import type { OcrQuoteMatch } from "@/lib/citations/ocr-quote-matcher";
import {
	hasOcrBoxes,
	resolveOcrDocumentCitation,
} from "@/lib/citations/resolve-ocr-document-citation";
import type { OcrResult } from "@/lib/ocr-types";
import { orpc } from "@/lib/orpc";

import type { CitationPreview } from "./citation-preview-dialog";
import { blobToBase64 } from "./inputs/audio-submission";

interface CitationPreviewSources {
	files: ReadonlyMap<string, File>;
	texts: ReadonlyMap<string, CitationTextSource>;
	getOcrResult: (file: File, citation: CitationRequest) => OcrResult | undefined;
}

// Matches the batch limit of `resolveDocumentCitations`.
const MAX_LOCATED_QUOTES = 100;

/**
 * Owns one dialog session and the document quote locations; source snapshots stay with callers.
 * `prefetch` locates all quotes of a document in one request, so opening a citation does not wait.
 */
export const useCitationPreview = ({
	getSources,
}: {
	getSources: () => CitationPreviewSources;
}) => {
	const [previews, setPreviews] = useState<CitationPreview[] | null>(null);
	const sessionRef = useRef<{ controller: AbortController; urls: Set<string> } | null>(null);
	// Pending or settled quote locations per document; failed requests are dropped for a retry.
	const locationsRef = useRef(new WeakMap<File, Map<string, Promise<OcrQuoteMatch | null>>>());
	const prefetchRef = useRef<AbortController | null>(null);
	const releaseSession = useCallback(() => {
		const session = sessionRef.current;
		sessionRef.current = null;
		session?.controller.abort();
		for (const url of session?.urls ?? []) {
			URL.revokeObjectURL(url);
		}
	}, []);
	useEffect(() => {
		const prefetchController = new AbortController();
		prefetchRef.current = prefetchController;
		return () => {
			prefetchController.abort();
			releaseSession();
		};
	}, [releaseSession]);

	const locateQuotes = useCallback((file: File, quotes: string[], signal?: AbortSignal) => {
		const cache = locationsRef.current.get(file) ?? new Map();
		locationsRef.current.set(file, cache);
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

	const prefetch = useCallback(
		(citations: CitationRequest[]) => {
			const { files, getOcrResult } = getSources();
			const quotesByFile = new Map<File, string[]>();
			for (const citation of citations) {
				const reference = parseCitationSource(citation.source);
				const file = reference.kind === "file" ? files.get(reference.id) : undefined;
				const quote = citation.quote?.trim();
				// OCR boxes are matched locally when the citation opens.
				if (
					file &&
					quote &&
					quote.length <= MAX_CITATION_QUOTE_LENGTH &&
					!hasOcrBoxes(getOcrResult(file, citation))
				) {
					quotesByFile.set(file, [...(quotesByFile.get(file) ?? []), quote]);
				}
			}
			for (const [file, quotes] of quotesByFile) {
				locateQuotes(file, quotes, prefetchRef.current?.signal);
			}
		},
		[getSources, locateQuotes],
	);

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
								locateQuote: async (document, exactQuote, locateSignal) => {
									const [location] = locateQuotes(document, [exactQuote], locateSignal);
									const match = await location;
									locateSignal?.throwIfAborted();
									return match;
								},
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
		[getSources, locateQuotes, releaseSession],
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

	return { onOpenChange, prefetch, previews, selectCitations };
};
