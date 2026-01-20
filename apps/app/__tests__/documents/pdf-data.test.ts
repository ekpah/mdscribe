import { describe, expect, test } from "bun:test";
import { toPdfArrayBuffer } from "@/app/documents/_lib/pdfData";

describe("toPdfArrayBuffer", () => {
	test("returns null for null input", () => {
		expect(toPdfArrayBuffer(null)).toBeNull();
	});

	test("handles Uint8Array views with offsets", () => {
		const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
		const view = new Uint8Array(buffer, 1, 2); // [2,3]
		const result = toPdfArrayBuffer(view);

		expect(result).toBeInstanceOf(ArrayBuffer);
		expect(result?.byteLength).toBe(2);
		expect(Array.from(new Uint8Array(result!))).toEqual([2, 3]);
	});
});
