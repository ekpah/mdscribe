export const MAX_CITATION_SOURCE_LENGTH = 8192;

export type CitationSourceReference =
	| {
			id: string;
			kind: "file";
			locator: string;
			source: string;
	  }
	| {
			id: string;
			kind: "input";
			locator: string;
			source: string;
	  }
	| {
			kind: "external";
			source: string;
			url: URL;
	  }
	| {
			kind: "fhir";
			source: string;
			url: URL;
	  }
	| {
			kind: "invalid";
			reason: "empty" | "too-long" | "unsafe-external" | "unsupported";
			source: string;
	  };

const parseInternalSource = (url: URL, source: string): CitationSourceReference | null => {
	if (url.protocol !== "mdscribe:") {
		return null;
	}

	const kind = url.hostname.toLowerCase();
	if (kind !== "file" && kind !== "input") {
		return { kind: "invalid", reason: "unsupported", source };
	}

	const encodedId = url.pathname.replace(/^\/+/, "");
	if (!encodedId || encodedId.includes("/")) {
		return { kind: "invalid", reason: "unsupported", source };
	}

	try {
		return {
			id: decodeURIComponent(encodedId),
			kind,
			// The fragment is reserved for a source-specific locator, for example
			// #page=2&bbox=10,20,30,40 or #char=120,182.
			locator: url.hash.slice(1),
			source,
		};
	} catch {
		return { kind: "invalid", reason: "unsupported", source };
	}
};

/**
 * Parse the single URI-like value used by the cite tag.
 *
 * Supported canonical forms:
 * - https://example.test/report
 * - fhir://Patient/123#path=name
 * - mdscribe://file/<upload-id>#page=2&bbox=10,20,30,40
 * - mdscribe://input/<input-id>#char=120,182
 *
 * Locators live in the fragment so the source identity stays stable and a
 * resolver can interpret the range without navigating the URI.
 */
export const parseCitationSource = (rawSource: unknown): CitationSourceReference => {
	if (typeof rawSource !== "string") {
		return { kind: "invalid", reason: "unsupported", source: "" };
	}
	const source = rawSource.trim();
	if (!source) {
		return { kind: "invalid", reason: "empty", source };
	}
	if (source.length > MAX_CITATION_SOURCE_LENGTH) {
		return { kind: "invalid", reason: "too-long", source };
	}

	let url: URL;
	try {
		url = new URL(source);
	} catch {
		return { kind: "invalid", reason: "unsupported", source };
	}

	if (url.protocol === "https:") {
		if (url.username || url.password) {
			return { kind: "invalid", reason: "unsafe-external", source };
		}
		return { kind: "external", source, url };
	}

	const internalSource = parseInternalSource(url, source);
	if (internalSource) {
		return internalSource;
	}

	if (url.protocol === "fhir:") {
		if (!source.toLowerCase().startsWith("fhir://")) {
			return { kind: "invalid", reason: "unsupported", source };
		}
		const expression = source.slice("fhir:".length).replace(/^\/\//, "").split("#", 1)[0];
		if (!expression?.trim()) {
			return { kind: "invalid", reason: "unsupported", source };
		}
		return { kind: "fhir", source, url };
	}

	return {
		kind: "invalid",
		reason: url.protocol === "http:" ? "unsafe-external" : "unsupported",
		source,
	};
};

export const createMdscribeSource = (kind: "file" | "input", id: string): string =>
	`mdscribe://${kind}/${encodeURIComponent(id)}`;

/** Parse a citation source when a caller only needs safe external previews. */
export const parseExternalCitationUrl = (source: unknown): URL | null => {
	const parsed = parseCitationSource(source);
	return parsed.kind === "external" ? parsed.url : null;
};
