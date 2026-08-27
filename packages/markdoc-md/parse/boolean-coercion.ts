/**
 * Shared boolean coercion utilities for Markdoc tag value normalization.
 *
 * These helpers are used across the rendering and input layers to consistently
 * convert between boolean, string ("true"/"false"), and numeric (0/1)
 * representations that arise when template variables are set by AI, voice
 * input, or manual entry.
 */

/**
 * Coerce an unknown value to a boolean.
 * Accepts: boolean, 1/0, "true"/"false", "1"/"0".
 * Returns `undefined` when the value cannot be confidently resolved.
 */
export const toBooleanValue = (value: unknown): boolean | undefined => {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "number") {
		if (value === 1) {
			return true;
		}
		if (value === 0) {
			return false;
		}
		return undefined;
	}

	if (typeof value !== "string") {
		return undefined;
	}

	const normalized = value.trim().toLowerCase();
	if (normalized === "true" || normalized === "1") {
		return true;
	}
	if (normalized === "false" || normalized === "0") {
		return false;
	}

	return undefined;
};

/**
 * Coerce an unknown value to a numeric or string representation suitable for
 * formula evaluation (fparser). Booleans and boolean-like strings are
 * converted to 1/0; other numbers and strings pass through.
 */
export const toFormulaValue = (value: unknown): number | string => {
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true") {
			return 1;
		}
		if (normalized === "false") {
			return 0;
		}
		return value;
	}

	return typeof value === "number" ? value : "";
};

/**
 * Normalize an unknown value to the "true"/"false" string representation used
 * by Markdoc switch/case rendering. Non-boolean switches pass strings through
 * as-is; other types return null.
 */
export const normalizeBooleanToString = (value: unknown): string | null => {
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (typeof value === "number") {
		if (value === 1) {
			return "true";
		}
		if (value === 0) {
			return "false";
		}
		return null;
	}

	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	if (normalized === "true" || normalized === "1") {
		return "true";
	}
	if (normalized === "false" || normalized === "0") {
		return "false";
	}

	return null;
};

/**
 * Extended boolean coercion for voice input that also recognizes common
 * German/English affirmative/negative words ("ja", "yes", "nein", "no").
 */
export const toVoiceBooleanValue = (value: string): boolean | undefined => {
	const normalized = value.trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "ja") {
		return true;
	}
	if (
		normalized === "false" ||
		normalized === "0" ||
		normalized === "no" ||
		normalized === "nein"
	) {
		return false;
	}
	return undefined;
};
