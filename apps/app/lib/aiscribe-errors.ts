import { ORPCError } from "@orpc/client";
import { USER_MESSAGES } from "./user-messages";

/**
 * Map an error from oRPC or the network layer to a user-facing German message.
 * Returns `null` for aborted requests (no toast needed).
 */
export function getAiscribeErrorMessage(error: unknown): string | null {
	// Aborted fetch / cancelled stream — silent
	if (error instanceof DOMException && error.name === "AbortError") {
		return null;
	}

	if (error instanceof ORPCError) {
		// Server already sends localised messages — prefer them
		switch (error.code) {
			case "UNAUTHORIZED":
				return error.message || USER_MESSAGES.unauthorized;
			case "FORBIDDEN":
				return error.message || USER_MESSAGES.subscriptionRequired;
			case "BAD_REQUEST":
				return error.message || USER_MESSAGES.missingInput;
			default:
				return error.message || USER_MESSAGES.unknownError;
		}
	}

	// Non-oRPC error with a message (e.g. network error)
	if (error instanceof Error) {
		// Cancelled streams sometimes surface as plain errors
		if (/abort|cancel/i.test(error.message)) {
			return null;
		}
	}

	return USER_MESSAGES.unknownError;
}
