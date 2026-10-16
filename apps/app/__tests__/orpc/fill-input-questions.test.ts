import { describe, expect, test } from "bun:test";

import {
	OTHER_OPTION,
	getFieldQuestions,
	getNumberOptions,
	supportsDecision,
} from "@/orpc/scribe/fill-inputs/questions";

const values = (text: string) => getNumberOptions([text]).map(({ value }) => value);
const context = { numbers: [], referenceDate: "2026-01-04" };

describe("fill-input questions", () => {
	test("offers each distinct standalone number, not times, ranges, dates or thousands", () => {
		expect(values("RR 143/69 (90), PAWP -3,7, O2 3l/min. HF 80.")).toEqual([
			143, 69, 90, -3.7, 3, 80,
		]);
		expect(values("11:48 Uhr, O2 2-3 l/min, Urin 1.200 ml, Dosis 0,125 mg")).toEqual([0.125]);
		expect(values("Datum 07.10.2026")).toEqual([]);
		expect(getNumberOptions(["ZVD 6", "RA 6,0"])).toEqual([{ description: "6", value: 6 }]);
	});

	test("asks one question per field and three for a date", () => {
		const numbers = getNumberOptions(["PAWP 8"]);
		const [number] = getFieldQuestions({ label: "PAWP", type: "number" }, { ...context, numbers });
		expect(number).toMatchObject({ options: [{ value: 8 }], part: "value" });
		expect(number.instructions).toContain(`Choose ${OTHER_OPTION}`);
		const [day, month, year] = getFieldQuestions({ label: "Datum", type: "date" }, context);
		expect(day.instructions).toContain("not the weekday");
		expect([day.options.length, day.options[6]]).toEqual([
			31,
			{ description: "7. day of the month", value: 7 },
		]);
		expect(month.options[2]).toEqual({ description: "3 (März)", value: 3 });
		expect([year.options.length, year.options[0].value, year.options.at(-1)?.value]).toEqual([
			101, 1976, 2076,
		]);
		expect(
			getFieldQuestions(
				{ label: "Zugang", options: ["rechts", "links"], type: "switch" },
				context,
			)[0].options,
		).toEqual([
			{ description: "rechts", value: "rechts" },
			{ description: "links", value: "links" },
		]);
	});

	test("leaves all text fields to the LLM", () => {
		expect(supportsDecision({ label: "Beurteilung", type: "string" })).toBe(false);
		expect(supportsDecision({ label: "Rate", type: "string", unit: "ml/h" })).toBe(false);
		expect(getFieldQuestions({ label: "Rate", type: "string", unit: "ml/h" }, context)).toEqual([]);
	});
});
