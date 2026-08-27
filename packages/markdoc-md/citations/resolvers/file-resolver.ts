import type {
	CitationDocumentLocation,
	CitationReference,
	CitationRequest,
	CitationResolution,
	CitationResolverContext,
} from "./types";
import { MAX_CITATION_QUOTE_LENGTH } from "./types";

const DEFAULT_DOCUMENT_RESOLVER_ENDPOINT = "/api/citations/resolve-document";

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isDocumentLocation = (value: unknown): value is CitationDocumentLocation => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<CitationDocumentLocation>;
	const bounds = candidate.bounds;
	return (
		Boolean(bounds) &&
		isFiniteNumber(bounds?.height) &&
		(bounds?.height ?? 0) > 0 &&
		isFiniteNumber(bounds?.width) &&
		(bounds?.width ?? 0) > 0 &&
		isFiniteNumber(bounds?.x) &&
		(bounds?.x ?? -1) >= 0 &&
		isFiniteNumber(bounds?.y) &&
		(bounds?.y ?? -1) >= 0 &&
		typeof candidate.imageBase64 === "string" &&
		candidate.imageBase64.length > 0 &&
		isFiniteNumber(candidate.pageHeight) &&
		candidate.pageHeight > 0 &&
		isFiniteNumber(candidate.pageNumber) &&
		candidate.pageNumber > 0 &&
		isFiniteNumber(candidate.pageWidth) &&
		candidate.pageWidth > 0 &&
		(bounds?.x ?? 0) + (bounds?.width ?? 0) <= candidate.pageWidth &&
		(bounds?.y ?? 0) + (bounds?.height ?? 0) <= candidate.pageHeight &&
		typeof candidate.quote === "string"
	);
};

const locateQuoteWithLiteParse = async (
	file: File,
	quote: string,
	endpoint: string,
	signal?: AbortSignal,
): Promise<CitationDocumentLocation | null> => {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("quote", quote);

	const response = await fetch(endpoint, { body: formData, method: "POST", signal });
	if (response.status === 404) {
		return null;
	}
	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok || !isDocumentLocation(payload)) {
		const message =
			payload !== null &&
			typeof payload === "object" &&
			"message" in payload &&
			typeof payload.message === "string"
				? payload.message
				: "The quote could not be located in the document.";
		throw new Error(message);
	}
	return payload;
};

export const resolveFileCitation = async (
	request: CitationRequest,
	reference: CitationReference<"file">,
	context: CitationResolverContext,
): Promise<CitationResolution> => {
	const file = context.files?.get(reference.id);
	if (!file) {
		return {
			code: "source-not-found",
			kind: "error",
			message: `The cited file "${reference.id}" is not available.`,
			source: reference.source,
		};
	}

	const quote = request.quote?.trim();
	if (quote && quote.length > MAX_CITATION_QUOTE_LENGTH) {
		return {
			code: "quote-too-long",
			kind: "error",
			message: "The citation quote is too long.",
			source: reference.source,
		};
	}
	try {
		const location = quote
			? context.documentResolver
				? await context.documentResolver(file, quote, context.signal)
				: await locateQuoteWithLiteParse(
						file,
						quote,
						context.documentResolverEndpoint ?? DEFAULT_DOCUMENT_RESOLVER_ENDPOINT,
						context.signal,
					)
			: null;
		if (location !== null && !isDocumentLocation(location)) {
			return {
				code: "invalid-response",
				kind: "error",
				message: "The document resolver returned an invalid location.",
				source: reference.source,
			};
		}
		const createFileUrl =
			context.createFileUrl ??
			(typeof URL.createObjectURL === "function"
				? (value: File) => URL.createObjectURL(value)
				: undefined);
		if (!createFileUrl) {
			return {
				code: "missing-context",
				kind: "error",
				message: "File citations require a createFileUrl implementation.",
				source: reference.source,
			};
		}
		return {
			kind: "document",
			label: file.name,
			location: location ?? undefined,
			source: reference.source,
			url: createFileUrl(file),
		};
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return {
				code: "cancelled",
				kind: "error",
				message: "Citation resolution was cancelled.",
				source: reference.source,
			};
		}
		return {
			code: "resolver-error",
			kind: "error",
			message: "The quote could not be located in the document.",
			source: reference.source,
		};
	}
};
