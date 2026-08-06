import { describe, expect, it } from "bun:test";

import { inspectMarkdocSources, resolveMarkdocSources } from "./resolve-markdoc-sources";

const patientContext = {
	entry: [
		{
			resource: {
				active: true,
				id: "patient-1",
				name: [{ family: "Mustermann", given: ["Erika"] }],
				resourceType: "Patient",
			},
		},
		{
			resource: {
				entry: [
					{
						resource: {
							code: { coding: [{ code: "718-7", system: "http://loinc.org" }] },
							effectiveDateTime: "2026-01-01",
							resourceType: "Observation",
							valueQuantity: { code: "g/dL", value: 12.8 },
						},
					},
					{
						resource: {
							code: { coding: [{ code: "718-7", system: "http://loinc.org" }] },
							effectiveDateTime: "2026-02-01",
							resourceType: "Observation",
							valueQuantity: { code: "g/dL", value: 13.4 },
						},
					},
				],
				resourceType: "Bundle",
				type: "document",
			},
		},
	],
	resourceType: "Bundle",
	type: "collection",
};

describe("resolveMarkdocSources", () => {
	it("resolves a concise FHIRPath across nested Bundle resources", () => {
		const expression =
			"Observation.where(code.coding.code = '718-7' and value is Quantity)" +
			".sort(effectiveDateTime).last().value.value";
		const markdoc = `{% info "hemoglobin" source=${JSON.stringify(`fhir://${expression}`)} /%}`;

		expect(resolveMarkdocSources(markdoc, { fhir: patientContext })).toEqual({
			diagnostics: [],
			values: { hemoglobin: 13.4 },
		});
	});

	it("returns arbitrary primitive values rather than lab-specific data", () => {
		const markdoc = '{% info "family_name" source="fhir://Patient.name.first().family" /%}';

		expect(resolveMarkdocSources(markdoc, { fhir: patientContext }).values).toEqual({
			family_name: "Mustermann",
		});
	});

	it("resolves a sourced Switch tag into the same variable map", () => {
		const markdoc = `
{% switch "active" type="boolean" source="fhir://Patient.active" %}
{% case "true" %}Active{% /case %}
{% case "false" %}Inactive{% /case %}
{% /switch %}
`;

		expect(resolveMarkdocSources(markdoc, { fhir: patientContext })).toEqual({
			diagnostics: [],
			values: { active: true },
		});
	});

	it("does not choose implicitly when a source returns multiple values", () => {
		const markdoc = '{% info "hb" source="fhir://Observation.value.value" /%}';
		const result = resolveMarkdocSources(markdoc, { fhir: patientContext });

		expect(result.values).toEqual({});
		expect(result.diagnostics[0]?.code).toBe("multiple-results");
	});

	it("rejects complex FHIR values", () => {
		const markdoc = '{% info "patient" source="fhir://Patient.first()" /%}';
		const result = inspectMarkdocSources(markdoc, { fhir: patientContext });

		expect(result.values).toEqual({});
		expect(result.diagnostics[0]?.code).toBe("unsupported-result");
		expect(result.sources[0]?.results).toHaveLength(1);
		expect(result.sources[0]?.results[0]).toMatchObject({
			active: true,
			id: "patient-1",
			name: [{ family: "Mustermann", given: ["Erika"] }],
			resourceType: "Patient",
		});
	});

	it("inspects multiple sourced Info tags in declaration order", () => {
		const markdoc = `
{% info "family_name" source="fhir://Patient.name.first().family" /%}
{% info "latest_hb" source="fhir://Observation.sort(effectiveDateTime).last().value.value" /%}
`;
		const result = inspectMarkdocSources(markdoc, { fhir: patientContext });

		expect(result.sources.map(({ primary }) => primary)).toEqual(["family_name", "latest_hb"]);
		expect(result.sources.map(({ results }) => results)).toEqual([["Mustermann"], [13.4]]);
		expect(result.values).toEqual({ family_name: "Mustermann", latest_hb: 13.4 });
	});

	it("reports unsupported schemes without fetching them", () => {
		const markdoc = '{% info "external" source="https://example.test/value" /%}';
		const result = resolveMarkdocSources(markdoc, { fhir: patientContext });

		expect(result.values).toEqual({});
		expect(result.diagnostics[0]?.code).toBe("unsupported-source");
	});

	it("does not evaluate a conflicting repeated source contract", () => {
		const markdoc = `
{% info "hb" source="fhir://Observation.first().value.value" /%}
{% info "hb" source="fhir://Observation.last().value.value" /%}
`;
		const result = resolveMarkdocSources(markdoc, { fhir: patientContext });

		expect(result.values).toEqual({});
		expect(result.diagnostics[0]?.code).toBe("invalid-template");
	});

	it("leaves missing values unresolved without fabricating a value", () => {
		const markdoc = '{% info "missing" source="fhir://Observation.where(false).value" /%}';

		expect(resolveMarkdocSources(markdoc, { fhir: patientContext })).toEqual({
			diagnostics: [],
			values: {},
		});
	});

	it("requires the FHIR context root to be a Bundle", () => {
		const markdoc = '{% info "name" source="fhir://Patient.name.family" /%}';
		const result = resolveMarkdocSources(markdoc, {
			fhir: { name: [{ family: "Mustermann" }], resourceType: "Patient" },
		});

		expect(result.values).toEqual({});
		expect(result.diagnostics[0]).toMatchObject({
			code: "evaluation-error",
			message: expect.stringContaining('resourceType "Bundle"'),
		});
	});
});
