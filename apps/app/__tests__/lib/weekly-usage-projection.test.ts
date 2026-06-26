import { describe, expect, test } from "bun:test";

import { getCurrentWeekUsageProjection } from "@/lib/weekly-usage-projection";

describe("getCurrentWeekUsageProjection", () => {
	test("projects the current calendar week from its elapsed days", () => {
		const projection = getCurrentWeekUsageProjection(
			[
				{ bucket: "2026-06-08T00:00:00", requests: 42 },
				{ bucket: "2026-06-15T00:00:00", requests: 30 },
			],
			"UTC",
			new Date("2026-06-17T12:00:00.000Z"),
		);

		expect(projection).toEqual({ bucket: "2026-06-15T00:00:00", requests: 70 });
	});

	test("keeps the completed Sunday total unchanged", () => {
		const projection = getCurrentWeekUsageProjection(
			[{ bucket: "2026-06-15T00:00:00", requests: 28 }],
			"UTC",
			new Date("2026-06-21T12:00:00.000Z"),
		);

		expect(projection).toEqual({ bucket: "2026-06-15T00:00:00", requests: 28 });
	});

	test("uses the selected timezone to determine the current week", () => {
		const projection = getCurrentWeekUsageProjection(
			[{ bucket: "2026-06-22T00:00:00", requests: 10 }],
			"Europe/Berlin",
			new Date("2026-06-21T22:30:00.000Z"),
		);

		expect(projection).toEqual({ bucket: "2026-06-22T00:00:00", requests: 70 });
	});
});
