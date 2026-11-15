/** A box in page fractions (0–1), independent of the image resolution. */
export interface PageBox {
	height: number;
	width: number;
	x: number;
	y: number;
}

/** OCR geometry of one page, in the page's own pixel frame. */
export interface SourcePage {
	blocks: { bbox: { height: number; width: number; x: number; y: number }; text: string }[];
	height: number;
	pageNumber: number;
	width: number;
}

export interface CitationSource {
	label: string;
	/** Citation URI, such as `mdscribe://input/notes` or `mdscribe://file/<id>`. */
	source: string;
	text: string;
	/** OCR pages of an image or PDF source; enables page locators. */
	pages?: SourcePage[];
}

/** Where evidence sits in its source. */
export type CitationLocator =
	| { kind: "text"; end: number; start: number }
	| { box: PageBox; kind: "page"; page: number };

export interface CitationEvidence {
	locator?: CitationLocator;
	/** Literal excerpt of the source: the durable part of a citation. */
	quote: string;
	source: string;
}

/** What is cited: a character range of the markdown, or one filled value. */
export type CitationTarget =
	| { end: number; kind: "span"; start: number }
	| { key: string; kind: "value" };

export interface Citation {
	/** Strongest evidence first. */
	evidence: CitationEvidence[];
	target: CitationTarget;
}

/** The decision-model questions the engine asks; `noul` answers are yes/no probabilities. */
export type DecisionQuestions = Record<
	string,
	{ criteria?: Record<string, string>; instructions: string; type: "choice" | "noul" }
>;

/**
 * Answers one batch of questions about a JSON state. Injected by the caller,
 * which owns the provider, credentials, limits, timeouts and usage logging.
 */
export type Decide = (
	questions: DecisionQuestions,
	state: string,
) => Promise<{ answers: Record<string, unknown> }>;
