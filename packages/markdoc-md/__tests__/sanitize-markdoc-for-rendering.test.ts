import { describe, expect, test } from "bun:test";

import { sanitizeMarkdocForRendering } from "../render/utils/sanitize-markdoc-for-rendering";

describe("tolerant cite rendering sanitizer", () => {
	test("preserves a valid inline cite", () => {
		const content = `{% cite source="https://example.test/a%20b" quote="100%" %}inline{% /cite %}`;
		expect(sanitizeMarkdocForRendering(content)).toBe(content);
	});

	test("unwraps a cite spanning paragraphs while preserving its body", () => {
		expect(
			sanitizeMarkdocForRendering(
				`{% cite source="https://example.test" %}first\n\nsecond{% /cite %}`,
			),
		).toBe("first\n\nsecond");
	});

	test("removes unmatched and self-closing cite delimiters", () => {
		expect(sanitizeMarkdocForRendering('a {% cite source="x" %}b')).toBe("a b");
		expect(sanitizeMarkdocForRendering("a {% /cite %} b")).toBe("a  b");
		expect(sanitizeMarkdocForRendering('a {% cite source="x" /%} b')).toBe("a  b");
	});

	test("does not interpret cite-like text inside Markdown code", () => {
		for (const content of [
			'```markdoc\n{% cite source="x" %}first\n\nsecond\n```',
			'before ``{% cite source="x" %}first\n\nsecond`` after',
		]) {
			expect(sanitizeMarkdocForRendering(content)).toBe(content);
		}
	});
});
