const HTTP_SCHEME_REGEX = /^https?:\/\//i;

export const PROVIDER_BASE_URL_ERROR_MESSAGE =
	"Bitte eine gültige URL im Format http(s)://host[:port][/pfad] eingeben.";

/**
 * Normalize user-provided provider URLs:
 * - trim whitespace
 * - auto-prefix http:// when scheme is omitted
 * - require http/https
 * - strip trailing slash(es)
 * - reject query/hash components
 */
export const normalizeProviderBaseUrl = (url: string): string => {
	const trimmed = url.trim();
	if (!trimmed) {
		throw new Error(PROVIDER_BASE_URL_ERROR_MESSAGE);
	}

	const candidate = HTTP_SCHEME_REGEX.test(trimmed) ? trimmed : `http://${trimmed}`;

	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		throw new Error(PROVIDER_BASE_URL_ERROR_MESSAGE);
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(PROVIDER_BASE_URL_ERROR_MESSAGE);
	}

	if (parsed.search || parsed.hash) {
		throw new Error(PROVIDER_BASE_URL_ERROR_MESSAGE);
	}

	const normalizedPath = parsed.pathname.replace(/\/+$/, "");
	if (!normalizedPath || normalizedPath === "/") {
		return parsed.origin;
	}

	return `${parsed.origin}${normalizedPath}`;
};

/**
 * Normalize OpenAI-compatible base URLs to always end with `/v1`.
 */
export const normalizeOpenAICompatibleBaseUrl = (url: string): string => {
	const trimmed = normalizeProviderBaseUrl(url).replace(/\/+$/, "");
	if (trimmed.toLowerCase().endsWith("/v1")) {
		return trimmed;
	}
	return `${trimmed}/v1`;
};
