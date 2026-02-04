import {
	DateFormatter,
	type DateValue,
	getLocalTimeZone,
	parseDate,
	today,
} from "@internationalized/date";

const germanFormatter = new DateFormatter("de-DE", { dateStyle: "short" });

/**
 * Parse date input from ISO (YYYY-MM-DD) or German (D.M.YYYY) format.
 * Returns null for invalid or empty input.
 */
export function parseDateInput(input: unknown): DateValue | null {
	if (!input || typeof input !== "string") return null;
	const trimmed = input.trim();
	if (!trimmed) return null;

	// ISO format: YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		try {
			return parseDate(trimmed);
		} catch {
			return null;
		}
	}

	// German format: D.M.YYYY or DD.MM.YYYY
	const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
	if (match) {
		const [, day, month, year] = match;
		try {
			return parseDate(
				`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
			);
		} catch {
			return null;
		}
	}

	return null;
}

/** Format a DateValue to German locale (e.g., "15.01.2024") */
export const formatDateGerman = (date: DateValue) =>
	germanFormatter.format(date.toDate(getLocalTimeZone()));

/** Get today's date as a DateValue */
export const getTodayDate = () => today(getLocalTimeZone());

/**
 * Normalize a date string to German format.
 * Accepts ISO or German input, returns German format or undefined.
 */
export const normalizeDateValue = (value: string) => {
	const parsed = parseDateInput(value);
	return parsed ? formatDateGerman(parsed) : undefined;
};
