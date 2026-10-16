import { parseDate } from "@internationalized/date";

import type { InputField } from "@/orpc/scribe/types";

/**
 * Turns template tags into decision-model questions. Each field becomes one
 * choice question, a date three (day, month, year). Every question has the
 * option `other` for "not reported or not among the options".
 */

export interface DecisionOption {
	/** Option text shown to the decision model. */
	description: string;
	value: string | number | boolean;
}

export interface FieldQuestion {
	instructions: string;
	options: DecisionOption[];
	part: "value" | "day" | "month" | "year";
}

interface QuestionContext {
	/** Every number written in the sources, see `getNumberOptions`. */
	numbers: DecisionOption[];
	/** Today in ISO format, for relative dates such as "vor 3 Tagen". */
	referenceDate: string;
}

export const OTHER_OPTION = "other";

// All text fields stay LLM work, including quantities written as text.
export const supportsDecision = (field: InputField): boolean =>
	["number", "boolean", "date"].includes(field.type ?? "") ||
	Boolean(field.type === "switch" && field.options?.length && field.options.length <= 254);

// Standalone numbers only: parts of dates, times, ratios or ranges ("07.10.2026",
// "11:48", "1:100", "2-3") are skipped, and "1.200" or "1,250" may use a thousands
// separator, so such ambiguous numbers are left to the LLM.
// Glued units ("3l") and sentence punctuation ("PAWP 8.") are fine.
const NUMBER = /(?<![\p{L}\p{N}.,:+−–-])[+−-]?\d+(?:[.,]\d+)?(?![\p{N}:–-]|[.,]\d)/gu;

export const findNumbers = (text: string) =>
	[...text.matchAll(NUMBER)].flatMap(({ 0: literal, index }) => {
		const value = Number(literal.replace(",", ".").replace("−", "-"));
		return Number.isFinite(value) && !/^[+−-]?[1-9]\d{0,2}[.,]\d{3}$/u.test(literal)
			? [{ index, literal, value }]
			: [];
	});

/** Each distinct number written in the sources, in document order. */
export const getNumberOptions = (texts: string[]): DecisionOption[] => {
	const options = new Map<number, DecisionOption>();
	for (const { literal, value } of texts.flatMap(findNumbers)) {
		if (!options.has(value)) {
			options.set(value, { description: literal, value });
		}
	}
	return [...options.values()];
};

export const explicitDates = (text: string) =>
	[
		...text.matchAll(
			/(?<![\p{L}\p{N}])(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\s*\d{1,2}\.\s*\d{4})(?![\p{L}\p{N}])/gu,
		),
	].flatMap(([literal]) => {
		const parts = literal.replaceAll(/\s/gu, "").split(".");
		const iso =
			parts.length === 3
				? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
				: literal;
		try {
			return [parseDate(iso).toString()];
		} catch {
			// Invalid calendar dates are not repaired or guessed.
			return [];
		}
	});

const MONTHS = [
	"Januar",
	"Februar",
	"März",
	"April",
	"Mai",
	"Juni",
	"Juli",
	"August",
	"September",
	"Oktober",
	"November",
	"Dezember",
];

const range = (from: number, count: number) =>
	Array.from({ length: count }, (_, index) => from + index);

const describeField = (field: InputField) =>
	JSON.stringify({
		description: field.description,
		label: field.label,
		type: field.type,
		unit: field.unit,
	});

const numberQuestion = (field: InputField, { numbers }: QuestionContext): FieldQuestion[] => [
	{
		instructions: `Which number in the patient context is the value of ${describeField(field)}? Match the field's meaning and unit. Use resting/baseline values. For pressures written A / B (C): systolic=A, diastolic=B, mean=C. Never calculate. Choose ${OTHER_OPTION} if the value is not explicitly reported or not among the options.`,
		options: numbers,
		part: "value",
	},
];

// A date is decided as day, month and year, so any written or relative date in
// the reference year ±50 is representable without a list of whole dates.
const dateQuestions = (field: InputField, { referenceDate }: QuestionContext): FieldQuestion[] => {
	const subject = `the date reported for ${describeField(field)} in the patient context`;
	const rules = `Resolve unambiguous relative dates (e.g. 'vor 3 Tagen') from referenceDate ${referenceDate}. Choose ${OTHER_OPTION} if the date is missing, partial or ambiguous. Never substitute today's date.`;
	const { year } = parseDate(referenceDate);
	return [
		{
			// "Tag 1" must not be read as Monday.
			instructions: `Which day of the month (calendar day 1–31, not the weekday) is ${subject}? ${rules}`,
			options: range(1, 31).map((day) => ({ description: `${day}. day of the month`, value: day })),
			part: "day",
		},
		{
			instructions: `Which month is ${subject}? ${rules}`,
			options: range(1, 12).map((month) => ({
				description: `${month} (${MONTHS[month - 1]})`,
				value: month,
			})),
			part: "month",
		},
		{
			instructions: `Which year is ${subject}? ${rules}`,
			options: range(year - 50, 101).map((value) => ({ description: String(value), value })),
			part: "year",
		},
	];
};

const optionQuestion = (field: InputField): FieldQuestion[] => [
	{
		instructions:
			field.type === "boolean"
				? `Is ${describeField(field)} explicitly reported as present (true) or absent (false) in the patient context? Respect selected checkboxes and negation. Choose ${OTHER_OPTION} if it is not documented; absence of a finding is not false.`
				: `Which option is explicitly reported for ${describeField(field)} in the patient context? Respect selected checkboxes and negation. Choose ${OTHER_OPTION} if none is documented.`,
		options:
			field.type === "boolean"
				? [
						{ description: "true (explicitly present)", value: true },
						{ description: "false (explicitly absent)", value: false },
					]
				: [...new Set(field.options)].map((value) => ({ description: value, value })),
		part: "value",
	},
];

/** The questions for one template field; empty if a decision model cannot answer it. */
export const getFieldQuestions = (field: InputField, context: QuestionContext): FieldQuestion[] => {
	if (!supportsDecision(field)) {
		return [];
	}
	if (field.type === "number") {
		return numberQuestion(field, context);
	}
	return field.type === "date" ? dateQuestions(field, context) : optionQuestion(field);
};
