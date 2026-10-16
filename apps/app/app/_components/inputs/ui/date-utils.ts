import { parseDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

const pad = (value: number, length: number) => String(value).padStart(length, "0");

const parseDateSafely = (value: string): DateValue | null => {
	try {
		return parseDate(value);
	} catch {
		return null;
	}
};

const parseIsoDateInput = (value: string): DateValue | null => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}

	return parseDateSafely(value);
};

const parseGermanDateInput = (value: string): DateValue | null => {
	const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
	if (!match) {
		return null;
	}

	const [, day, month, year] = match;
	const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	return parseDateSafely(isoDate);
};

/**
 * Parse date input from ISO (YYYY-MM-DD) or German (D.M.YYYY) format.
 * Returns null for invalid or empty input.
 */
export const parseDateInput = (input: unknown): DateValue | null => {
	if (!input || typeof input !== "string") {
		return null;
	}
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	return parseIsoDateInput(trimmed) ?? parseGermanDateInput(trimmed);
};

/**
 * Format a DateValue as German "DD.MM.YYYY" (e.g., "15.01.2024"). The year is always
 * four digits, so parseDateInput reads every value back, including the partial years
 * ("0002") a date field commits while the user types.
 */
export const formatDateGerman = ({ day, month, year }: DateValue) =>
	`${pad(day, 2)}.${pad(month, 2)}.${pad(year, 4)}`;

/**
 * Normalize a date string to German format.
 * Accepts ISO or German input, returns German format or undefined.
 */
export const normalizeDateValue = (value: string) => {
	const parsed = parseDateInput(value);
	return parsed ? formatDateGerman(parsed) : undefined;
};
