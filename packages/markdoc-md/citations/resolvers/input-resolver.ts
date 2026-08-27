import type {
	CitationReference,
	CitationRequest,
	CitationResolution,
	CitationResolverContext,
	CitationTextMatch,
} from "./types";
import { MAX_CITATION_QUOTE_LENGTH, MAX_CITATION_TEXT_LENGTH } from "./types";

interface NormalizedText {
	ends: Uint32Array;
	starts: Uint32Array;
	text: string;
}

const normalizeTextWithIndices = (value: string): NormalizedText => {
	const parts: string[] = [];
	let starts = new Uint32Array(Math.max(16, value.length + 1));
	let ends = new Uint32Array(starts.length);
	let buffer = "";
	let mapLength = 0;
	let pendingSpace: { end: number; start: number } | null = null;
	const append = (normalized: string, start: number, end: number) => {
		const requiredLength = mapLength + normalized.length;
		if (requiredLength > starts.length) {
			const nextLength = Math.max(requiredLength, starts.length * 2);
			const nextStarts = new Uint32Array(nextLength);
			const nextEnds = new Uint32Array(nextLength);
			nextStarts.set(starts);
			nextEnds.set(ends);
			starts = nextStarts;
			ends = nextEnds;
		}
		buffer += normalized;
		for (let offset = 0; offset < normalized.length; offset += 1) {
			starts[mapLength] = start;
			ends[mapLength] = end;
			mapLength += 1;
		}
		if (buffer.length >= 4096) {
			parts.push(buffer);
			buffer = "";
		}
	};

	for (let index = 0; index < value.length;) {
		const charCode = value.charCodeAt(index);
		const codePoint = value.codePointAt(index) ?? charCode;
		const character = String.fromCodePoint(codePoint);
		const end = index + character.length;
		if (charCode === 45) {
			let cursor = end;
			while (value.charCodeAt(cursor) === 9 || value.charCodeAt(cursor) === 32) {
				cursor += 1;
			}
			if (value.charCodeAt(cursor) === 13) {
				cursor += 1;
			}
			if (value.charCodeAt(cursor) === 10) {
				cursor += 1;
				while (value.charCodeAt(cursor) === 9 || value.charCodeAt(cursor) === 32) {
					cursor += 1;
				}
				index = cursor;
				continue;
			}
		}
		const isAsciiWhitespace =
			charCode === 9 ||
			charCode === 10 ||
			charCode === 11 ||
			charCode === 12 ||
			charCode === 13 ||
			charCode === 32;
		if (isAsciiWhitespace || (charCode > 127 && /\s/u.test(character))) {
			pendingSpace = pendingSpace ? { end, start: pendingSpace.start } : { end, start: index };
			index = end;
			continue;
		}

		const normalizedCharacter =
			charCode < 128
				? charCode >= 65 && charCode <= 90
					? String.fromCharCode(charCode + 32)
					: character
				: character
						.normalize("NFKD")
						.toLocaleLowerCase()
						.replaceAll(/\p{M}/gu, "")
						.replaceAll("ß", "ss")
						.replaceAll("\u00ad", "");
		if (!normalizedCharacter) {
			for (let offset = mapLength - 1; offset >= 0 && ends[offset] === index; offset -= 1) {
				ends[offset] = end;
			}
			index = end;
			continue;
		}

		if (pendingSpace && (parts.length > 0 || buffer.length > 0)) {
			append(" ", pendingSpace.start, pendingSpace.end);
		}
		pendingSpace = null;
		append(normalizedCharacter, index, end);
		index = end;
	}
	if (buffer) {
		parts.push(buffer);
	}

	return {
		ends: ends.subarray(0, mapLength),
		starts: starts.subarray(0, mapLength),
		text: parts.join(""),
	};
};

export const normalizeCitationSearchText = (value: string): string =>
	normalizeTextWithIndices(value).text;

export const findQuoteInInputText = (text: string, quote: string): CitationTextMatch | null => {
	const normalizedText = normalizeTextWithIndices(text);
	const normalizedQuote = normalizeTextWithIndices(quote).text.trim();
	if (!normalizedQuote) {
		return null;
	}

	const normalizedStart = normalizedText.text.indexOf(normalizedQuote);
	if (normalizedStart < 0) {
		return null;
	}

	const start = normalizedText.starts[normalizedStart];
	const lastIndex = normalizedText.ends[normalizedStart + normalizedQuote.length - 1];
	if (start === undefined || lastIndex === undefined) {
		return null;
	}
	return { end: lastIndex, start };
};

export const resolveInputCitation = (
	request: CitationRequest,
	reference: CitationReference<"input">,
	context: CitationResolverContext,
): CitationResolution => {
	const sourceIdentity = reference.source.split("#", 1)[0] ?? reference.source;
	const input = context.texts?.get(reference.source) ?? context.texts?.get(sourceIdentity);
	if (!input) {
		return {
			code: "source-not-found",
			kind: "error",
			message: `The cited text source "${reference.id}" is not available.`,
			source: reference.source,
		};
	}
	if (input.text.length > MAX_CITATION_TEXT_LENGTH) {
		return {
			code: "source-too-large",
			kind: "error",
			message: "The cited text source is too large for local quote matching.",
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
	const match = quote ? (findQuoteInInputText(input.text, quote) ?? undefined) : undefined;

	return {
		kind: "text",
		label: input.label,
		match,
		source: reference.source,
		text: input.text,
	};
};
