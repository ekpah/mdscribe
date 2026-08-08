import { describe, expect, it } from "bun:test";

import { fetchFhirBundlePages, fetchFhirJson } from "./fhir-url";

describe("fetchFhirJson", () => {
	it("requests and formats FHIR JSON", async () => {
		const result = await fetchFhirJson("https://fhir.example/Patient/example", (_input, init) => {
			expect(new Headers(init.headers).get("accept")).toBe(
				"application/fhir+json, application/json",
			);
			return Promise.resolve(Response.json({ id: "example", resourceType: "Patient" }));
		});

		expect(JSON.parse(result)).toEqual({ id: "example", resourceType: "Patient" });
	});

	it("rejects non-HTTP URLs", async () => {
		await expect(fetchFhirJson("file:///tmp/patient.json")).rejects.toThrow(
			"Die FHIR-URL muss HTTP oder HTTPS verwenden.",
		);
	});

	it("reports unsuccessful FHIR responses", async () => {
		await expect(
			fetchFhirJson("https://fhir.example/Patient/missing", () =>
				Promise.resolve(new Response(null, { status: 404, statusText: "Not Found" })),
			),
		).rejects.toThrow("FHIR-Server antwortet mit HTTP 404 Not Found.");
	});

	it("combines paginated patient resources into a collection Bundle", async () => {
		const pages = new Map<string, unknown>([
			[
				"https://fhir.example/Patient/p-1/$everything",
				{
					entry: [{ resource: { id: "p-1", resourceType: "Patient" } }],
					link: [{ relation: "next", url: "https://fhir.example/page-2" }],
					resourceType: "Bundle",
					type: "searchset",
				},
			],
			[
				"https://fhir.example/page-2",
				{
					entry: [{ resource: { id: "o-1", resourceType: "Observation" } }],
					resourceType: "Bundle",
					type: "searchset",
				},
			],
		]);
		const result = await fetchFhirBundlePages(
			"https://fhir.example/Patient/p-1/$everything",
			(input) => Promise.resolve(Response.json(pages.get(input))),
		);

		expect(JSON.parse(result)).toEqual({
			entry: [
				{ resource: { id: "p-1", resourceType: "Patient" } },
				{ resource: { id: "o-1", resourceType: "Observation" } },
			],
			resourceType: "Bundle",
			type: "collection",
		});
	});
});
