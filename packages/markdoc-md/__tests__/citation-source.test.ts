import { describe, expect, test } from "bun:test";

import { createMdscribeSource, parseCitationSource } from "../render/utils/citation-source";

describe("citation source references", () => {
	test("round-trips an uploaded file ID", () => {
		const source = createMdscribeSource("file", "file name/123");
		expect(parseCitationSource(source)).toMatchObject({
			id: "file name/123",
			kind: "file",
			locator: "",
		});
	});

	test("keeps a text range locator separate from the input identity", () => {
		expect(
			parseCitationSource("mdscribe://input/anamnese#char=12,48"),
		).toMatchObject({
			id: "anamnese",
			kind: "input",
			locator: "char=12,48",
		});
	});

	test("accepts FHIR references without treating them as browser links", () => {
		expect(parseCitationSource("fhir://Patient/123#path=name")).toMatchObject({
			kind: "fhir",
		});
	});

	test("only accepts credential-free HTTPS external links", () => {
		expect(parseCitationSource("https://example.test/report")).toMatchObject({
			kind: "external",
		});
		expect(parseCitationSource("http://example.test/report")).toMatchObject({
			kind: "invalid",
			reason: "unsafe-external",
		});
		expect(
			parseCitationSource("https://user:secret@example.test/report"),
		).toMatchObject({
			kind: "invalid",
			reason: "unsafe-external",
		});
	});

	test("rejects bare upload IDs", () => {
		expect(parseCitationSource("file-id")).toEqual({
			kind: "invalid",
			reason: "unsupported",
			source: "file-id",
		});
	});

	test("is total over malformed runtime values", () => {
		expect(parseCitationSource(undefined)).toMatchObject({
			kind: "invalid",
			reason: "unsupported",
		});
		expect(parseCitationSource({ source: "https://example.test" })).toMatchObject({
			kind: "invalid",
		});
	});

	test("requires canonical non-empty FHIR references", () => {
		expect(parseCitationSource("fhir://")).toMatchObject({ kind: "invalid" });
		expect(parseCitationSource("fhir:Patient.name")).toMatchObject({ kind: "invalid" });
		expect(parseCitationSource("fhir://Patient.name")).toMatchObject({ kind: "fhir" });
	});

	test("requires internal IDs to occupy one encoded path segment", () => {
		expect(parseCitationSource("mdscribe://file/a/b")).toMatchObject({ kind: "invalid" });
		expect(parseCitationSource(createMdscribeSource("file", "a/b"))).toMatchObject({
			id: "a/b",
			kind: "file",
		});
	});
});
