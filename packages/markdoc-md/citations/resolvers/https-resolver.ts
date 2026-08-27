import type { CitationReference, CitationRequest, CitationResolution } from "./types";

export const resolveHttpsCitation = (
	request: CitationRequest,
	reference: CitationReference<"external">,
): CitationResolution => ({
	kind: "external",
	label: reference.url.hostname,
	quote: request.quote?.trim() || undefined,
	source: reference.source,
	url: reference.url.href,
});
