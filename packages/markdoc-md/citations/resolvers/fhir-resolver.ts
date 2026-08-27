import { evaluateFhirSource } from "../../sources/fhir";
import { findQuoteInInputText } from "./input-resolver";
import type {
	CitationReference,
	CitationRequest,
	CitationResolution,
	CitationResolverContext,
} from "./types";

export const resolveFhirCitation = async (
	request: CitationRequest,
	reference: CitationReference<"fhir">,
	context: CitationResolverContext,
): Promise<CitationResolution> => {
	if (context.fhirResolver) {
		return context.fhirResolver(request, reference, context.signal);
	}
	if (context.fhir === undefined) {
		return {
			code: "missing-context",
			kind: "error",
			message: `No FHIR context is available for "${reference.source}".`,
			source: reference.source,
		};
	}

	try {
		const expression = reference.source.slice("fhir://".length).split("#", 1)[0] ?? "";
		const results = evaluateFhirSource(context.fhir, expression);
		const text = results
			.map((result) => (typeof result === "string" ? result : JSON.stringify(result, null, 2)))
			.join("\n\n");
		const quote = request.quote?.trim();
		const match = quote ? (findQuoteInInputText(text, quote) ?? undefined) : undefined;
		return {
			kind: "text",
			label: `FHIR · ${expression}`,
			match,
			source: reference.source,
			text,
		};
	} catch (error) {
		return {
			code: "resolver-error",
			kind: "error",
			message: "The FHIRPath expression could not be evaluated.",
			source: reference.source,
		};
	}
};
