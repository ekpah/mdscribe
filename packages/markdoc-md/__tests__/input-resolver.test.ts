import { describe, expect, test } from "bun:test";

import { findQuoteInInputText, resolveInputCitation } from "../citations/resolvers/input-resolver";
import { parseCitationSource } from "../render/utils/citation-source";

describe("input citation quote lookup", () => {
	test("finds a case-insensitive quote across whitespace", () => {
		const text = "Anamnese:\nDer Patient hat   keine Allergien.";
		const match = findQuoteInInputText(text, "der patient hat keine allergien");
		expect(match).not.toBeNull();
		expect(text.slice(match?.start, match?.end)).toBe("Der Patient hat   keine Allergien");
	});

	test("returns the first occurrence", () => {
		expect(findQuoteInInputText("alpha beta alpha", "alpha")).toEqual({
			end: 5,
			start: 0,
		});
	});

	test("returns null when the quote is absent", () => {
		expect(findQuoteInInputText("alpha beta", "gamma")).toBeNull();
	});

	test("matches Unicode variants and line-break hyphenation", () => {
		for (const [text, quote] of [
			["Straße", "STRASSE"],
			["CAFÉ", "cafe\u0301"],
			["medica-\ntion plan", "medication"],
		] as const) {
			const match = findQuoteInInputText(text, quote);
			expect(match).not.toBeNull();
		}
	});

	test("searches a 500 KB source within the interaction budget", () => {
		const text = `${"alpha beta gamma ".repeat(30_000)}needle`;
		const start = performance.now();
		expect(findQuoteInInputText(text, "needle")).not.toBeNull();
		expect(performance.now() - start).toBeLessThan(250);
	});

	test("opens the input without a highlight when the quote is absent", () => {
		const source = "mdscribe://input/notes";
		const reference = parseCitationSource(source);
		if (reference.kind !== "input") {
			throw new Error("Expected an input citation reference");
		}

		const resolution = resolveInputCitation({ quote: "missing quote", source }, reference, {
			createFileUrl: () => "",
			files: new Map(),
			texts: new Map([[source, { label: "Notes", text: "alpha beta" }]]),
		});

		expect(resolution.kind).toBe("text");
		if (resolution.kind === "text") {
			expect(resolution.match).toBeUndefined();
			expect(resolution.text).toBe("alpha beta");
		}
	});
});
