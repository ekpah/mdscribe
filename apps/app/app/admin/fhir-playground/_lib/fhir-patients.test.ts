import { describe, expect, it } from "bun:test";

import { createPatientEverythingUrl, extractPatientOptions } from "./fhir-patients";

describe("FHIR patient selection", () => {
	it("extracts searchable patients from a FHIR Bundle", () => {
		const patients = extractPatientOptions({
			entry: [
				{
					fullUrl: "https://fhir.example/Patient/p-1",
					resource: {
						birthDate: "1980-04-05",
						gender: "female",
						identifier: [{ value: "MRN-123" }],
						name: [{ family: "Muster", given: ["Erika"], use: "official" }],
						resourceType: "Patient",
					},
				},
			],
			resourceType: "Bundle",
			type: "searchset",
		});

		expect(patients).toEqual([
			{
				birthDate: "1980-04-05",
				fullUrl: "https://fhir.example/Patient/p-1",
				gender: "female",
				id: "p-1",
				identifiers: ["MRN-123"],
				label: "Erika Muster",
			},
		]);
	});

	it("builds the selected patient's everything operation", () => {
		expect(
			createPatientEverythingUrl("https://fhir.example/Patient?_count=5", {
				fullUrl: "https://fhir.example/Patient/p-1",
				id: "p-1",
				identifiers: [],
				label: "Erika Muster",
			}),
		).toBe("https://fhir.example/Patient/p-1/$everything?_count=500&_format=json");
	});
});
