import type { CitationSourceReference } from "../../render/utils/citation-source";

export interface CitationRequest {
	quote?: string;
	source: string;
}

export const MAX_CITATION_QUOTE_LENGTH = 4000;
export const MAX_CITATION_TEXT_LENGTH = 2 * 1024 * 1024;

export interface CitationTextSource {
	label: string;
	text: string;
}

export interface CitationTextMatch {
	end: number;
	start: number;
}

export interface CitationDocumentLocation {
	bounds: {
		height: number;
		width: number;
		x: number;
		y: number;
	};
	imageBase64: string;
	pageHeight: number;
	pageNumber: number;
	pageWidth: number;
	quote: string;
}

export type CitationResolutionErrorCode =
	| "cancelled"
	| "invalid-response"
	| "invalid-source"
	| "missing-context"
	| "quote-too-long"
	| "resolver-error"
	| "source-not-found"
	| "source-too-large";

export type CitationResolution =
	| {
			kind: "document";
			label: string;
			location?: CitationDocumentLocation;
			source: string;
			url: string;
	  }
	| {
			kind: "external";
			label: string;
			quote?: string;
			source: string;
			url: string;
	  }
	| {
			kind: "text";
			label: string;
			match?: CitationTextMatch;
			source: string;
			text: string;
	  }
	| {
			code: CitationResolutionErrorCode;
			kind: "error";
			message: string;
			source: string;
	  };

export interface CitationResolverContext {
	createFileUrl?: (file: File) => string;
	documentResolver?: (
		file: File,
		quote: string,
		signal?: AbortSignal,
	) => Promise<CitationDocumentLocation | null>;
	documentResolverEndpoint?: string;
	files?: ReadonlyMap<string, File>;
	fhir?: unknown;
	fhirResolver?: (
		request: CitationRequest,
		reference: Extract<CitationSourceReference, { kind: "fhir" }>,
		signal?: AbortSignal,
	) => CitationResolution | Promise<CitationResolution>;
	signal?: AbortSignal;
	texts?: ReadonlyMap<string, CitationTextSource>;
}

export type CitationReference<K extends CitationSourceReference["kind"]> = Extract<
	CitationSourceReference,
	{ kind: K }
>;
