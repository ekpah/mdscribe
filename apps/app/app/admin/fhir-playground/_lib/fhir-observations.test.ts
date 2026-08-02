import { describe, expect, it } from "bun:test";

import { findLatestMedication } from "./fhir-medications";
import { findLatestHemoglobin, parseFhirTrends } from "./fhir-observations";
import { formatFhirSourceValue, resolveFhirSource } from "./fhir-source";

describe("parseFhirTrends", () => {
	it("groups numeric Observation values by code and unit", () => {
		const result = parseFhirTrends({
			entry: [
				{
					resource: {
						code: {
							coding: [{ code: "4548-4", display: "HbA1c", system: "http://loinc.org" }],
						},
						effectiveDateTime: "2025-04-01T08:00:00Z",
						resourceType: "Observation",
						valueQuantity: { unit: "%", value: 6.8 },
					},
				},
				{
					resource: {
						code: {
							coding: [{ code: "4548-4", display: "HbA1c", system: "http://loinc.org" }],
						},
						effectiveDateTime: "2025-01-01T08:00:00Z",
						resourceType: "Observation",
						valueQuantity: { unit: "%", value: 7.2 },
					},
				},
			],
			resourceType: "Bundle",
		});

		expect(result.resourceCount).toBe(3);
		expect(result.observationCount).toBe(2);
		expect(result.series).toHaveLength(1);
		expect(result.series[0]?.label).toBe("HbA1c");
		expect(result.series[0]?.unit).toBe("%");
		expect(result.series[0]?.points.map((point) => point.value)).toEqual([7.2, 6.8]);
	});

	it("extracts numeric components and retains undated measurements", () => {
		const result = parseFhirTrends({
			code: { text: "Blutdruck" },
			component: [
				{
					code: { coding: [{ code: "8480-6", display: "Systolisch" }] },
					valueQuantity: { unit: "mmHg", value: 128 },
				},
				{
					code: { coding: [{ code: "8462-4", display: "Diastolisch" }] },
					valueQuantity: { unit: "mmHg", value: 82 },
				},
			],
			resourceType: "Observation",
		});

		expect(result.series).toHaveLength(2);
		expect(result.series.every((series) => series.undatedPointCount === 1)).toBe(true);
	});

	it("ignores non-numeric Observation values", () => {
		const result = parseFhirTrends({
			code: { text: "Interpretation" },
			resourceType: "Observation",
			valueString: "unauffällig",
		});

		expect(result.observationCount).toBe(1);
		expect(result.series).toEqual([]);
	});

	it("supports legacy Observation name and appliesDateTime fields", () => {
		const result = parseFhirTrends({
			resource: {
				appliesDateTime: "2012-10-09T00:00:00Z",
				id: "rheum-pacer-sample-data-1199",
				name: {
					coding: [
						{
							code: "1783-0",
							system: "http://loinc.org/",
						},
					],
					text: "Alkaline phosphatase serum/plasma",
				},
				reliability: "ok",
				resourceType: "Observation",
				status: "final",
				subject: {
					reference: "Patient/rheum-pacer-sample-data-1001",
				},
				valueQuantity: {
					value: 211,
				},
			},
		});

		expect(result.series).toHaveLength(1);
		expect(result.series[0]?.label).toBe("Alkaline phosphatase serum/plasma");
		expect(result.series[0]?.code).toBe("1783-0");
		expect(result.series[0]?.points[0]?.value).toBe(211);
		expect(result.series[0]?.points[0]?.date).toBe(Date.parse("2012-10-09T00:00:00Z"));
		expect(result.series[0]?.undatedPointCount).toBe(0);
	});

	it("finds the latest Hb result and preserves its FHIR provenance", () => {
		const result = parseFhirTrends({
			entry: [
				{
					resource: {
						code: {
							coding: [{ code: "718-7", display: "Hemoglobin", system: "http://loinc.org" }],
						},
						effectiveDateTime: "2025-01-01T08:00:00Z",
						id: "hb-old",
						resourceType: "Observation",
						valueQuantity: { unit: "g/dL", value: 12.2 },
					},
				},
				{
					resource: {
						code: {
							coding: [{ code: "718-7", display: "Hemoglobin", system: "http://loinc.org" }],
						},
						effectiveDateTime: "2025-03-01T08:00:00Z",
						id: "hb-latest",
						meta: { source: "urn:source:laboratory-system" },
						resourceType: "Observation",
						status: "final",
						subject: { reference: "Patient/example" },
						valueQuantity: { unit: "g/dL", value: 13.1 },
					},
				},
			],
			resourceType: "Bundle",
		});
		const latestHb = findLatestHemoglobin(result.series);

		expect(latestHb?.point.value).toBe(13.1);
		expect(latestHb?.point.source).toEqual({
			reference: "Observation/hb-latest",
			sourceUri: "urn:source:laboratory-system",
			status: "final",
			subjectReference: "Patient/example",
		});
	});

	it("does not mistake HbA1c for hemoglobin", () => {
		const result = parseFhirTrends({
			code: { text: "HbA1c" },
			resourceType: "Observation",
			valueQuantity: { unit: "%", value: 6.5 },
		});

		expect(findLatestHemoglobin(result.series)).toBeNull();
	});

	it("extracts medication name, strength, and ePA source information", () => {
		const medication = findLatestMedication({
			fullUrl:
				"http://epa4all/epa/medication/api/v1/fhir/Medication/2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
			resource: {
				amount: {
					denominator: {
						code: "{Tablet}",
						system: "http://unitsofmeasure.org",
						unit: "Tablet",
						value: 1,
					},
					numerator: {
						code: "mg",
						system: "http://unitsofmeasure.org",
						unit: "MilliGram",
						value: 100,
					},
				},
				code: {
					coding: [
						{
							code: "03953522",
							display: "Metoprolol-ratiopharm® 100 mg Tabletten",
							system: "http://fhir.de/CodeSystem/ifa/pzn",
						},
					],
				},
				extension: [
					{
						url: "https://gematik.de/fhir/epa-medication/StructureDefinition/rx-prescription-process-identifier-extension",
						valueIdentifier: {
							value: "160.153.303.260.460_202508220",
						},
					},
				],
				id: "2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
				resourceType: "Medication",
				status: "active",
			},
		});

		expect(medication?.name).toBe("Metoprolol-ratiopharm® 100 mg Tabletten");
		expect(medication?.dosage).toBe("100 mg / 1 Tablet");
		expect(medication?.code).toBe("03953522");
		expect(medication?.prescriptionId).toBe("160.153.303.260.460_202508220");
		expect(medication?.source.reference).toBe(
			"http://epa4all/epa/medication/api/v1/fhir/Medication/2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
		);
	});

	it("uses the newest MedicationRequest and its dosage instruction", () => {
		const medication = findLatestMedication({
			entry: [
				{
					fullUrl: "urn:uuid:medication",
					resource: {
						code: { text: "Metoprolol 100 mg" },
						id: "medication",
						resourceType: "Medication",
					},
				},
				{
					resource: {
						authoredOn: "2025-01-01",
						id: "old-request",
						medicationReference: { reference: "urn:uuid:medication" },
						resourceType: "MedicationRequest",
					},
				},
				{
					resource: {
						authoredOn: "2025-08-22",
						dosageInstruction: [{ text: "1 Tablette morgens und abends" }],
						id: "latest-request",
						medicationReference: { reference: "urn:uuid:medication" },
						resourceType: "MedicationRequest",
						status: "active",
					},
				},
			],
			resourceType: "Bundle",
		});

		expect(medication?.name).toBe("Metoprolol 100 mg");
		expect(medication?.dosage).toBe("1 Tablette morgens und abends");
		expect(medication?.date).toBe(Date.parse("2025-08-22"));
		expect(medication?.source.reference).toBe("MedicationRequest/latest-request");
	});

	it("resolves a stable fhir source query to the latest matching value", () => {
		const input = {
			entry: [
				{
					resource: {
						code: {
							coding: [{ code: "718-7", system: "http://loinc.org/" }],
						},
						effectiveDateTime: "2025-06-01T08:00:00Z",
						id: "newest-hb",
						resourceType: "Observation",
						valueQuantity: { code: "g/dL", value: 13.7 },
					},
				},
				{
					resource: {
						code: {
							coding: [{ code: "718-7", system: "http://loinc.org" }],
						},
						effectiveDateTime: "2025-01-01T08:00:00Z",
						id: "older-hb",
						resourceType: "Observation",
						valueQuantity: { code: "g/dL", value: 12.9 },
					},
				},
			],
			resourceType: "Bundle",
		};
		const resolution = resolveFhirSource(
			input,
			"fhir://Observation?code=http://loinc.org|718-7&_sort=-date&_count=1#value.ofType(Quantity)",
		);

		expect(formatFhirSourceValue(resolution?.value)).toBe("13,7 g/dL");
		expect(resolution?.source.reference).toBe("Observation/newest-hb");
		expect(resolution?.source.bundlePointer).toBe("/entry/0/resource/valueQuantity");
	});

	it("formats a queried Medication amount as a FHIR ratio", () => {
		const resolution = resolveFhirSource(
			{
				amount: {
					denominator: { code: "{Tablet}", value: 1 },
					numerator: { code: "mg", value: 100 },
				},
				resourceType: "Medication",
			},
			"fhir://Medication?_sort=-_lastUpdated&_count=1#amount",
		);

		expect(formatFhirSourceValue(resolution?.value)).toBe("100 mg / 1 Tablet");
	});
});
