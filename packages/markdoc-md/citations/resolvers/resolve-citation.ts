import { parseCitationSource } from "../../render/utils/citation-source";
import { resolveFhirCitation } from "./fhir-resolver";
import { resolveFileCitation } from "./file-resolver";
import { resolveHttpsCitation } from "./https-resolver";
import { resolveInputCitation } from "./input-resolver";
import { resolveInvalidCitation } from "./invalid-resolver";
import type { CitationRequest, CitationResolution, CitationResolverContext } from "./types";
import { MAX_CITATION_QUOTE_LENGTH } from "./types";

export const resolveCitation = async (
	request: CitationRequest,
	context: CitationResolverContext,
): Promise<CitationResolution> => {
	const source = typeof request?.source === "string" ? request.source : "";
	const quote = typeof request?.quote === "string" ? request.quote : undefined;
	const normalizedRequest = { ...request, quote, source };
	try {
		if (context.signal?.aborted) {
			return {
				code: "cancelled",
				kind: "error",
				message: "Citation resolution was cancelled.",
				source,
			};
		}
		if (quote && quote.length > MAX_CITATION_QUOTE_LENGTH) {
			return {
				code: "quote-too-long",
				kind: "error",
				message: "The citation quote is too long.",
				source,
			};
		}
		const reference = parseCitationSource(source);
		switch (reference.kind) {
			case "external":
				return resolveHttpsCitation(normalizedRequest, reference);
			case "fhir":
				return await resolveFhirCitation(normalizedRequest, reference, context);
			case "file":
				return await resolveFileCitation(normalizedRequest, reference, context);
			case "input":
				return resolveInputCitation(normalizedRequest, reference, context);
			case "invalid":
				return resolveInvalidCitation(normalizedRequest, reference);
		}
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return {
				code: "cancelled",
				kind: "error",
				message: "Citation resolution was cancelled.",
				source,
			};
		}
		return {
			code: "resolver-error",
			kind: "error",
			message: "The citation source could not be resolved.",
			source,
		};
	}
};
