import type {
	CitationReference,
	CitationRequest,
	CitationResolution,
} from "./types";

export const resolveInvalidCitation = (
	request: CitationRequest,
	reference: CitationReference<"invalid">,
): CitationResolution => ({
	code: "invalid-source",
	kind: "error",
	message:
		reference.reason === "unsafe-external"
			? "External citations require an HTTPS URL without embedded credentials."
			: `The citation source format "${request.source}" is not supported.`,
	source: request.source,
});
