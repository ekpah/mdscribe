import { describe, expect, test } from "bun:test";

import { parseDate } from "@internationalized/date";

import {
	formatDateGerman,
	normalizeDateValue,
	parseDateInput,
} from "@/app/_components/inputs/ui/date-utils";

describe("date input values", () => {
	test("normalized AI dates keep a four-digit year and parse back for display", () => {
		const value = normalizeDateValue("2026-10-07");
		expect(value).toBe("07.10.2026");
		expect(parseDateInput(value)?.toString()).toBe("2026-10-07");
	});

	test("a partial year committed while typing parses back to the same date", () => {
		const value = formatDateGerman(parseDate("0002-03-01"));
		expect(value).toBe("01.03.0002");
		expect(parseDateInput(value)?.toString()).toBe("0002-03-01");
	});
});
