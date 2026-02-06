const subscriptionKeywords = [
	"nutzungsgrenze",
	"abonnement",
	"abo",
	"kontingent",
	"stripe",
	"subscription",
];
const missingInputKeywords = [
	"pflicht",
	"eingabe",
	"input",
	"feld",
	"leer",
	"missing",
	"required",
];
const unauthorizedKeywords = [
	"unauthorized",
	"not authorized",
	"not authenticated",
	"auth",
	"anmelden",
	"einloggen",
	"melde dich an",
];
const abortKeywords = ["abort", "aborted", "canceled", "cancelled"];

export const AISCRIBE_ERROR_MESSAGES = {
	missingInput: "Bitte füllen Sie mindestens ein Pflichtfeld aus.",
	unauthorized: "Bitte melde dich an, um AIScribe zu nutzen.",
	subscription: "Dein Abonnement reicht nicht aus. Bitte aktualisiere dein Abo.",
	unknownApi:
		"Es ist ein unbekannter Fehler mit der API aufgetreten. Bitte versuchen Sie es später erneut.",
};

function hasKeyword(message: string, keywords: string[]): boolean {
	for (const keyword of keywords) {
		if (message.includes(keyword)) {
			return true;
		}
	}
	return false;
}

function getErrorCandidates(error: unknown): unknown[] {
	const candidates: unknown[] = [error];
	if (error && typeof error === "object" && "cause" in error) {
		const cause = (error as { cause?: unknown }).cause;
		if (cause && cause !== error) {
			candidates.push(cause);
		}
	}
	return candidates;
}

function extractErrorCode(candidates: unknown[]): string | undefined {
	for (const candidate of candidates) {
		if (!candidate || typeof candidate !== "object") {
			continue;
		}
		const code = (candidate as { code?: unknown }).code;
		if (typeof code === "string") {
			return code;
		}
		const status = (candidate as { status?: unknown }).status;
		if (typeof status === "number") {
			if (status === 401) {
				return "UNAUTHORIZED";
			}
			if (status === 403) {
				return "FORBIDDEN";
			}
			if (status === 400) {
				return "BAD_REQUEST";
			}
		}
	}
	return undefined;
}

function extractErrorMessage(candidates: unknown[]): string | undefined {
	for (const candidate of candidates) {
		if (candidate instanceof Error && candidate.message) {
			return candidate.message;
		}
		if (candidate && typeof candidate === "object") {
			const message = (candidate as { message?: unknown }).message;
			if (typeof message === "string") {
				return message;
			}
		}
	}
	return undefined;
}

export function getAiscribeErrorMessage(error: unknown): string {
	const candidates = getErrorCandidates(error);
	const code = extractErrorCode(candidates);
	const message = extractErrorMessage(candidates);
	const normalizedMessage = message?.toLowerCase() ?? "";

	if (normalizedMessage && hasKeyword(normalizedMessage, abortKeywords)) {
		return "";
	}

	if (code === "UNAUTHORIZED" || hasKeyword(normalizedMessage, unauthorizedKeywords)) {
		return AISCRIBE_ERROR_MESSAGES.unauthorized;
	}

	if (code === "FORBIDDEN" || hasKeyword(normalizedMessage, subscriptionKeywords)) {
		if (message && hasKeyword(normalizedMessage, subscriptionKeywords)) {
			return message;
		}
		return AISCRIBE_ERROR_MESSAGES.subscription;
	}

	if (
		(code === "BAD_REQUEST" && hasKeyword(normalizedMessage, missingInputKeywords)) ||
		hasKeyword(normalizedMessage, missingInputKeywords)
	) {
		if (message && hasKeyword(normalizedMessage, missingInputKeywords)) {
			return message;
		}
		return AISCRIBE_ERROR_MESSAGES.missingInput;
	}

	return AISCRIBE_ERROR_MESSAGES.unknownApi;
}
