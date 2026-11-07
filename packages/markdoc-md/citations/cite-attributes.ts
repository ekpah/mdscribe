import { parseCitationSource } from "../render/utils/citation-source";
import { MAX_CITATION_QUOTE_LENGTH } from "./resolvers/types";
import type { CitationRequest } from "./resolvers/types";

export type CiteAttributeProblem =
	| { kind: "malformed" }
	| { kind: "quote-too-long" }
	| { kind: "source-invalid"; source: string };

interface CiteAttributes {
	citations?: unknown;
	quote?: unknown;
	source?: unknown;
}

/**
 * Reads the evidence of one cite tag: `citations=[{source, quote}, …]`, or the
 * single `source`/`quote` pair of older content. Every entry must be valid for
 * the mark to be usable; a tag with both forms or with no source is malformed.
 */
export const readCiteCitations = ({
	citations,
	quote,
	source,
}: CiteAttributes): { citations: CitationRequest[]; problems: CiteAttributeProblem[] } => {
	const hasPair = source !== undefined || quote !== undefined;
	let entries: unknown[] | null = null;
	if (citations === undefined) {
		entries = hasPair ? [{ quote, source }] : [];
	} else if (Array.isArray(citations) && !hasPair) {
		entries = citations;
	}
	if (!entries?.length) {
		return { citations: [], problems: [{ kind: "malformed" }] };
	}
	const valid: CitationRequest[] = [];
	const problems: CiteAttributeProblem[] = [];
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
			problems.push({ kind: "malformed" });
			continue;
		}
		const { quote: entryQuote, source: entrySource } = entry as CiteAttributes;
		const reference = parseCitationSource(entrySource);
		if (reference.kind === "invalid") {
			problems.push({ kind: "source-invalid", source: reference.source });
		}
		if (entryQuote !== undefined && typeof entryQuote !== "string") {
			problems.push({ kind: "malformed" });
		} else if (entryQuote && entryQuote.length > MAX_CITATION_QUOTE_LENGTH) {
			problems.push({ kind: "quote-too-long" });
		} else if (reference.kind !== "invalid") {
			valid.push({ quote: entryQuote?.trim() || undefined, source: reference.source });
		}
	}
	return { citations: problems.length ? [] : valid, problems };
};

/** The `citations=[…]` attribute of a cite tag, as a native Markdoc array. */
export const serializeCiteCitations = (citations: readonly CitationRequest[]): string =>
	`citations=[${citations
		.map(
			({ quote, source }) =>
				`{source: ${JSON.stringify(source)}${quote === undefined ? "" : `, quote: ${JSON.stringify(quote)}`}}`,
		)
		.join(", ")}]`;
