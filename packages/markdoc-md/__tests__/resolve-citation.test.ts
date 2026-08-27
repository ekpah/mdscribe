import { afterEach, describe, expect, test } from "bun:test";

import { resolveCitation } from "../citations/resolvers/resolve-citation";
import type { CitationResolverContext } from "../citations/resolvers/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const context = (overrides: Partial<CitationResolverContext> = {}): CitationResolverContext => ({
	createFileUrl: () => "blob:test",
	files: new Map(),
	texts: new Map(),
	...overrides,
});

describe("citation resolver boundary", () => {
	test("resolves sources without unrelated host capabilities", async () => {
		const external = await resolveCitation({ source: "https://example.test/report" }, {});
		expect(external).toMatchObject({
			kind: "external",
			url: "https://example.test/report",
		});

		const missingInput = await resolveCitation({ source: "mdscribe://input/notes" }, {});
		expect(missingInput).toMatchObject({
			code: "source-not-found",
			kind: "error",
		});
	});

	test("uses an injected document resolver and validates its output", async () => {
		const file = new File(["pdf"], "report.pdf", { type: "application/pdf" });
		const validLocation = {
			bounds: { height: 5, width: 10, x: 2, y: 3 },
			imageBase64: "image",
			pageHeight: 100,
			pageNumber: 1,
			pageWidth: 100,
			quote: "alpha",
		};
		const resolution = await resolveCitation(
			{ quote: "alpha", source: "mdscribe://file/id" },
			{
				createFileUrl: () => "blob:test",
				documentResolver: async () => validLocation,
				files: new Map([["id", file]]),
			},
		);
		expect(resolution).toMatchObject({
			kind: "document",
			location: validLocation,
			url: "blob:test",
		});

		const invalid = await resolveCitation(
			{ quote: "alpha", source: "mdscribe://file/id" },
			{
				createFileUrl: () => "blob:test",
				documentResolver: async () => ({ bounds: {} }) as never,
				files: new Map([["id", file]]),
			},
		);
		expect(invalid).toMatchObject({ code: "invalid-response", kind: "error" });
	});

	test("does not throw for a malformed runtime request", async () => {
		const resolution = await resolveCitation({ source: undefined } as never, context());
		expect(resolution.kind).toBe("error");
	});

	test("normalizes a rejecting custom FHIR resolver", async () => {
		const resolution = await resolveCitation(
			{ source: "fhir://Patient.name" },
			context({
				fhirResolver: async () => {
					throw new Error("sensitive implementation detail");
				},
			}),
		);
		expect(resolution).toMatchObject({
			code: "resolver-error",
			kind: "error",
			message: "The citation source could not be resolved.",
		});
	});

	test("rejects malformed document resolver payloads", async () => {
		globalThis.fetch = (async () => Response.json({ bounds: {} })) as unknown as typeof fetch;
		const file = new File(["pdf"], "report.pdf", { type: "application/pdf" });
		const resolution = await resolveCitation(
			{ quote: "alpha", source: "mdscribe://file/id" },
			context({ files: new Map([["id", file]]) }),
		);
		expect(resolution.kind).toBe("error");
	});

	test("returns a cancelled result when document lookup is aborted", async () => {
		globalThis.fetch = (async (_input, init) =>
			new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () =>
					reject(new DOMException("Aborted", "AbortError")),
				);
			})) as typeof fetch;
		const controller = new AbortController();
		const file = new File(["pdf"], "report.pdf", { type: "application/pdf" });
		const pending = resolveCitation(
			{ quote: "alpha", source: "mdscribe://file/id" },
			context({ files: new Map([["id", file]]), signal: controller.signal }),
		);
		controller.abort();
		expect(await pending).toMatchObject({ code: "cancelled", kind: "error" });
	});
});
