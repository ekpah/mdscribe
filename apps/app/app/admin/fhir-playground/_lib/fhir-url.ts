const MAX_FHIR_RESPONSE_BYTES = 25 * 1024 * 1024;
const FHIR_REQUEST_TIMEOUT_MS = 20_000;
const MAX_FHIR_BUNDLE_PAGES = 20;

type FhirFetcher = (input: string, init: RequestInit) => Promise<Response>;

const parseHttpUrl = (rawUrl: string): URL => {
	let url: URL;
	try {
		url = new URL(rawUrl.trim());
	} catch {
		throw new Error("Bitte eine vollständige FHIR-URL eingeben.");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Die FHIR-URL muss HTTP oder HTTPS verwenden.");
	}
	if (url.username || url.password) {
		throw new Error("Zugangsdaten dürfen nicht in der FHIR-URL stehen.");
	}
	return url;
};

const assertResponseSize = (size: number): void => {
	if (size > MAX_FHIR_RESPONSE_BYTES) {
		throw new Error("Die FHIR-Antwort ist größer als 25 MB.");
	}
};

const fetchFhirValue = async (
	rawUrl: string,
	fetcher: FhirFetcher,
): Promise<{ bytes: number; value: unknown }> => {
	const url = parseHttpUrl(rawUrl);
	let response: Response;
	try {
		response = await fetcher(url.toString(), {
			headers: { Accept: "application/fhir+json, application/json" },
			signal: AbortSignal.timeout(FHIR_REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") {
			throw new Error("Der FHIR-Server hat nicht innerhalb von 20 Sekunden geantwortet.", {
				cause: error,
			});
		}
		throw new Error(
			"FHIR-Server nicht erreichbar. URL, Netzwerk und CORS-Freigabe des Servers prüfen.",
			{ cause: error },
		);
	}

	if (!response.ok) {
		throw new Error(
			`FHIR-Server antwortet mit HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
		);
	}

	const contentLength = response.headers.get("content-length");
	if (contentLength) {
		assertResponseSize(Number(contentLength));
	}
	const body = await response.text();
	const bytes = new TextEncoder().encode(body).byteLength;
	assertResponseSize(bytes);

	try {
		return { bytes, value: JSON.parse(body) as unknown };
	} catch {
		throw new Error("Der FHIR-Server hat kein gültiges JSON zurückgegeben.");
	}
};

export const fetchFhirJson = async (
	rawUrl: string,
	fetcher: FhirFetcher = globalThis.fetch,
): Promise<string> => {
	const { value } = await fetchFhirValue(rawUrl, fetcher);
	return JSON.stringify(value, null, 2);
};

export const fetchFhirBundlePages = async (
	rawUrl: string,
	fetcher: FhirFetcher = globalThis.fetch,
): Promise<string> => {
	const firstUrl = parseHttpUrl(rawUrl);
	const seenUrls = new Set<string>();
	const entries: unknown[] = [];
	let firstBundle: Record<string, unknown> | null = null;
	let totalBytes = 0;
	let nextUrl: string | null = firstUrl.toString();

	for (let page = 0; nextUrl && page < MAX_FHIR_BUNDLE_PAGES; page += 1) {
		if (seenUrls.has(nextUrl)) {
			throw new Error("Die FHIR-Paginierung enthält einen Zyklus.");
		}
		seenUrls.add(nextUrl);
		const { bytes, value } = await fetchFhirValue(nextUrl, fetcher);
		totalBytes += bytes;
		assertResponseSize(totalBytes);
		if (
			typeof value !== "object" ||
			value === null ||
			Array.isArray(value) ||
			(value as Record<string, unknown>).resourceType !== "Bundle"
		) {
			throw new Error("Der Patientenkontext ist kein FHIR Bundle.");
		}
		const bundle = value as Record<string, unknown>;
		firstBundle ??= bundle;
		if (Array.isArray(bundle.entry)) {
			entries.push(...bundle.entry);
		}
		const links = Array.isArray(bundle.link) ? bundle.link : [];
		const nextLink = links.find(
			(link) =>
				typeof link === "object" &&
				link !== null &&
				(link as Record<string, unknown>).relation === "next",
		) as Record<string, unknown> | undefined;
		nextUrl = typeof nextLink?.url === "string" ? nextLink.url : null;
		if (nextUrl && new URL(nextUrl).origin !== firstUrl.origin) {
			throw new Error("Die nächste FHIR-Seite verweist auf einen anderen Server.");
		}
	}

	if (nextUrl) {
		throw new Error(`Der Patientenkontext umfasst mehr als ${MAX_FHIR_BUNDLE_PAGES} Seiten.`);
	}
	return JSON.stringify(
		{
			...firstBundle,
			entry: entries,
			link: undefined,
			type: "collection",
		},
		null,
		2,
	);
};
