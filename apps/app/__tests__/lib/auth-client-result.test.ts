import { describe, expect, test } from "bun:test";

import { unwrapAuthClientResult } from "@/lib/auth-client-result";

describe("Better Auth client results", () => {
	test("returns data for a successful response", () => {
		const data = { url: "https://example.com/checkout" };

		expect(unwrapAuthClientResult({ data, error: null })).toEqual(data);
	});

	test("throws a resolved HTTP 500 error result", () => {
		const error = {
			message: "Internal Server Error",
			status: 500,
			statusText: "Internal Server Error",
		};

		expect(() => unwrapAuthClientResult({ data: null, error })).toThrow(error);
	});
});
