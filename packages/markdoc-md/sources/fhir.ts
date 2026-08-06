import { evaluate } from "fhirpath";
import fhirpathR4 from "fhirpath/fhir-context/r4";

type FhirResource = Record<string, unknown> & { resourceType: string };
type FhirBundle = FhirResource & { resourceType: "Bundle" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isFhirResource = (value: unknown): value is FhirResource =>
	isRecord(value) && typeof value.resourceType === "string";

const assertFhirBundle: (value: unknown) => asserts value is FhirBundle = (value) => {
	if (!isFhirResource(value) || value.resourceType !== "Bundle") {
		throw new Error('The FHIR context must be a resource with resourceType "Bundle".');
	}
};

/**
 * Turns a Bundle (including nested document Bundles) into the resource collection
 * that concise source expressions such as `Observation.where(...)` operate on.
 */
const collectFhirResources = (bundle: FhirBundle): FhirResource[] => {
	const resources: FhirResource[] = [];

	const visit = (resource: unknown): void => {
		if (!isFhirResource(resource)) {
			return;
		}
		if (resource.resourceType !== "Bundle") {
			resources.push(resource);
			return;
		}
		if (!Array.isArray(resource.entry)) {
			return;
		}
		for (const entry of resource.entry) {
			if (isRecord(entry) && "resource" in entry) {
				visit(entry.resource);
			}
		}
	};

	visit(bundle);
	return resources;
};

export const evaluateFhirSource = (input: unknown, expression: string): unknown[] => {
	assertFhirBundle(input);
	return evaluate(collectFhirResources(input), expression, {}, fhirpathR4) as unknown[];
};
