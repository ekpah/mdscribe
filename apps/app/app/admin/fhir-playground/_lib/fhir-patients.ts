type JsonObject = Record<string, unknown>;

export interface FhirPatientOption {
	birthDate?: string;
	fullUrl?: string;
	gender?: string;
	id: string;
	identifiers: string[];
	label: string;
}

const isObject = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const toString = (value: unknown): string | undefined =>
	typeof value === "string" && value.trim() ? value.trim() : undefined;

const getPatientLabel = (patient: JsonObject): string => {
	const names = Array.isArray(patient.name) ? patient.name.filter(isObject) : [];
	const name = names.find((entry) => entry.use === "official") ?? names[0];
	if (!name) {
		return toString(patient.id) ?? "Patient ohne ID";
	}
	const given = Array.isArray(name.given) ? name.given.map(toString).filter(Boolean) : [];
	return (
		[...given, toString(name.family)].filter(Boolean).join(" ") || toString(patient.id) || "Patient"
	);
};

const getIdentifiers = (patient: JsonObject): string[] =>
	(Array.isArray(patient.identifier) ? patient.identifier : [])
		.filter(isObject)
		.map((identifier) => toString(identifier.value))
		.filter((value): value is string => typeof value === "string");

const getPatientIdFromFullUrl = (fullUrl: string | undefined): string | undefined => {
	if (!fullUrl) {
		return undefined;
	}
	try {
		const segments = new URL(fullUrl).pathname.split("/").filter(Boolean);
		const patientSegment = segments.lastIndexOf("Patient");
		return patientSegment === -1 ? undefined : toString(segments[patientSegment + 1]);
	} catch {
		return undefined;
	}
};

export const extractPatientOptions = (input: unknown): FhirPatientOption[] => {
	const options = new Map<string, FhirPatientOption>();
	const visit = (value: unknown, fullUrl?: string): void => {
		if (Array.isArray(value)) {
			for (const item of value) {
				visit(item);
			}
			return;
		}
		if (!isObject(value)) {
			return;
		}
		if (value.resourceType === "Patient") {
			const id = toString(value.id) ?? getPatientIdFromFullUrl(fullUrl);
			if (id && !options.has(id)) {
				options.set(id, {
					birthDate: toString(value.birthDate),
					fullUrl,
					gender: toString(value.gender),
					id,
					identifiers: getIdentifiers(value),
					label: getPatientLabel(value),
				});
			}
			return;
		}
		if (value.resourceType !== "Bundle" || !Array.isArray(value.entry)) {
			return;
		}
		for (const entry of value.entry) {
			if (isObject(entry)) {
				visit(entry.resource, toString(entry.fullUrl));
			}
		}
	};
	visit(input);
	return [...options.values()];
};

export const createPatientEverythingUrl = (
	patientSearchUrl: string,
	patient: FhirPatientOption,
): string => {
	const url = new URL(patient.fullUrl ?? patientSearchUrl);
	if (!patient.fullUrl) {
		const patientSegment = url.pathname.lastIndexOf("/Patient");
		if (patientSegment === -1) {
			throw new Error("Die FHIR-URL enthält keinen Patient-Endpunkt.");
		}
		url.pathname = `${url.pathname.slice(0, patientSegment)}/Patient/${encodeURIComponent(patient.id)}`;
	}
	url.pathname = `${url.pathname.replace(/\/$/, "")}/$everything`;
	url.search = "";
	url.searchParams.set("_count", "500");
	url.searchParams.set("_format", "json");
	return url.toString();
};
