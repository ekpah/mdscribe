type JsonObject = Record<string, unknown>;

interface CollectedResource {
	fullUrl: string | null;
	resource: JsonObject;
}

interface MedicationDetails {
	code: string | null;
	dosage: string | null;
	fullUrl: string | null;
	name: string;
	prescriptionId: string | null;
	resource: JsonObject;
}

export interface LatestFhirMedication {
	code: string | null;
	date: number | null;
	dateLabel: string;
	dosage: string | null;
	name: string;
	prescriptionId: string | null;
	source: {
		medicationReference: string | null;
		reference: string;
		sourceUri: string | null;
		status: string | null;
		subjectReference: string | null;
	};
}

const isObject = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
	typeof value === "string" && value.trim() ? value.trim() : null;

const asFiniteNumber = (value: unknown): number | null =>
	typeof value === "number" && Number.isFinite(value) ? value : null;

const getMeta = (resource: JsonObject): JsonObject | null =>
	isObject(resource.meta) ? resource.meta : null;

const getReference = (resource: JsonObject, fullUrl: string | null): string => {
	if (fullUrl) {
		return fullUrl;
	}
	const resourceType = asString(resource.resourceType) ?? "Resource";
	const id = asString(resource.id);
	return id ? `${resourceType}/${id}` : resourceType;
};

const collectResources = (input: unknown): CollectedResource[] => {
	const resources: CollectedResource[] = [];
	const visited = new WeakSet<object>();

	const visit = (value: unknown, inheritedFullUrl: string | null = null) => {
		if (Array.isArray(value)) {
			for (const item of value) {
				visit(item, inheritedFullUrl);
			}
			return;
		}
		if (!isObject(value) || visited.has(value)) {
			return;
		}

		visited.add(value);
		if (asString(value.resourceType)) {
			resources.push({ fullUrl: inheritedFullUrl, resource: value });
		}

		const entryResource = isObject(value.resource) ? value.resource : null;
		if (entryResource) {
			visit(entryResource, asString(value.fullUrl) ?? inheritedFullUrl);
		}
		for (const [property, nestedValue] of Object.entries(value)) {
			if (property !== "resource") {
				visit(nestedValue, inheritedFullUrl);
			}
		}
	};

	visit(input);
	return resources;
};

const getCoding = (concept: unknown): JsonObject[] => {
	if (!isObject(concept) || !Array.isArray(concept.coding)) {
		return [];
	}
	return concept.coding.filter(isObject);
};

const getPreferredCoding = (concept: unknown): JsonObject | null => {
	const coding = getCoding(concept);
	return coding.find((entry) => asString(entry.system)?.includes("/ifa/pzn")) ?? coding[0] ?? null;
};

const getMedicationName = (medication: JsonObject): string => {
	const code = isObject(medication.code) ? medication.code : null;
	const preferredCoding = getPreferredCoding(code);
	return (
		(code ? asString(code.text) : null) ??
		(preferredCoding ? asString(preferredCoding.display) : null) ??
		(preferredCoding ? asString(preferredCoding.code) : null) ??
		"Unbenanntes Medikament"
	);
};

const formatQuantity = (quantity: unknown): string | null => {
	if (!isObject(quantity)) {
		return null;
	}
	const value = asFiniteNumber(quantity.value);
	if (value === null) {
		return null;
	}
	const unit = asString(quantity.code) ?? asString(quantity.unit);
	return `${value.toLocaleString("de-DE", { maximumFractionDigits: 4 })}${unit ? ` ${unit.replaceAll(/[{}]/g, "")}` : ""}`;
};

const getMedicationStrength = (medication: JsonObject): string | null => {
	if (!isObject(medication.amount)) {
		return null;
	}
	const numerator = formatQuantity(medication.amount.numerator);
	const denominator = formatQuantity(medication.amount.denominator);
	if (numerator && denominator) {
		return `${numerator} / ${denominator}`;
	}
	return numerator;
};

const getPrescriptionId = (medication: JsonObject): string | null => {
	if (!Array.isArray(medication.extension)) {
		return null;
	}
	for (const extension of medication.extension) {
		if (
			!isObject(extension) ||
			!asString(extension.url)?.includes("rx-prescription-process-identifier") ||
			!isObject(extension.valueIdentifier)
		) {
			continue;
		}
		const value = asString(extension.valueIdentifier.value);
		if (value) {
			return value;
		}
	}
	return null;
};

const toMedicationDetails = (entry: CollectedResource): MedicationDetails => {
	const preferredCoding = getPreferredCoding(entry.resource.code);
	return {
		code: preferredCoding ? asString(preferredCoding.code) : null,
		dosage: getMedicationStrength(entry.resource),
		fullUrl: entry.fullUrl,
		name: getMedicationName(entry.resource),
		prescriptionId: getPrescriptionId(entry.resource),
		resource: entry.resource,
	};
};

const getRequestDate = (request: JsonObject): string | null => {
	const dispenseRequest = isObject(request.dispenseRequest) ? request.dispenseRequest : null;
	const validityPeriod =
		dispenseRequest && isObject(dispenseRequest.validityPeriod)
			? dispenseRequest.validityPeriod
			: null;
	const meta = getMeta(request);
	return (
		asString(request.authoredOn) ??
		(validityPeriod ? asString(validityPeriod.start) : null) ??
		(meta ? asString(meta.lastUpdated) : null)
	);
};

const getDosageInstruction = (request: JsonObject): string | null => {
	if (!Array.isArray(request.dosageInstruction)) {
		return null;
	}
	for (const instruction of request.dosageInstruction) {
		if (!isObject(instruction)) {
			continue;
		}
		const text = asString(instruction.text);
		if (text) {
			return text;
		}
		if (!Array.isArray(instruction.doseAndRate)) {
			continue;
		}
		for (const doseAndRate of instruction.doseAndRate) {
			if (!isObject(doseAndRate)) {
				continue;
			}
			const dose = formatQuantity(doseAndRate.doseQuantity);
			if (dose) {
				return dose;
			}
		}
	}
	return null;
};

const parseDate = (rawDate: string | null): number | null => {
	if (!rawDate) {
		return null;
	}
	const date = Date.parse(rawDate);
	return Number.isFinite(date) ? date : null;
};

const resolveMedicationReference = (
	reference: string | null,
	medications: MedicationDetails[],
): MedicationDetails | null => {
	if (!reference) {
		return null;
	}
	return (
		medications.find((medication) => {
			const medicationId = asString(medication.resource.id);
			return (
				medication.fullUrl === reference ||
				Boolean(
					medicationId && (reference === medicationId || reference.endsWith(`/${medicationId}`)),
				)
			);
		}) ?? null
	);
};

const toStandaloneMedication = (medication: MedicationDetails): LatestFhirMedication => {
	const meta = getMeta(medication.resource);
	const rawDate = meta ? asString(meta.lastUpdated) : null;
	const subject = isObject(medication.resource.subject) ? medication.resource.subject : null;

	return {
		code: medication.code,
		date: parseDate(rawDate),
		dateLabel: rawDate ?? "Kein Verordnungsdatum",
		dosage: medication.dosage,
		name: medication.name,
		prescriptionId: medication.prescriptionId,
		source: {
			medicationReference: medication.fullUrl,
			reference: getReference(medication.resource, medication.fullUrl),
			sourceUri: meta ? asString(meta.source) : null,
			status: asString(medication.resource.status),
			subjectReference: subject ? asString(subject.reference) : null,
		},
	};
};

const getMedicationReferenceValue = (request: JsonObject): string | null => {
	if (!isObject(request.medicationReference)) {
		return null;
	}
	return asString(request.medicationReference.reference);
};

const getMedicationConceptDetails = (
	request: JsonObject,
): { code: string | null; name: string | null } => {
	if (!isObject(request.medicationCodeableConcept)) {
		return { code: null, name: null };
	}
	const concept = request.medicationCodeableConcept;
	const coding = getPreferredCoding(concept);
	return {
		code: coding ? asString(coding.code) : null,
		name: asString(concept.text) ?? (coding ? asString(coding.display) : null),
	};
};

const getRequestedMedicationSource = (
	requestEntry: CollectedResource,
	medication: MedicationDetails | null,
	medicationReference: string | null,
): LatestFhirMedication["source"] => {
	const request = requestEntry.resource;
	const meta = getMeta(request);
	const subject = isObject(request.subject) ? request.subject : null;
	return {
		medicationReference: medication?.fullUrl ?? medicationReference,
		reference: getReference(request, requestEntry.fullUrl),
		sourceUri: (meta ? asString(meta.source) : null) ?? medication?.fullUrl ?? null,
		status: asString(request.status),
		subjectReference: subject ? asString(subject.reference) : null,
	};
};

const toRequestedMedication = (
	requestEntry: CollectedResource,
	medications: MedicationDetails[],
): LatestFhirMedication => {
	const request = requestEntry.resource;
	const medicationReference = getMedicationReferenceValue(request);
	const medication = resolveMedicationReference(medicationReference, medications);
	const concept = getMedicationConceptDetails(request);
	const rawDate = getRequestDate(request);

	return {
		code: medication?.code ?? concept.code,
		date: parseDate(rawDate),
		dateLabel: rawDate ?? "Kein Verordnungsdatum",
		dosage: getDosageInstruction(request) ?? medication?.dosage ?? null,
		name: medication?.name ?? concept.name ?? "Unbenanntes Medikament",
		prescriptionId: medication?.prescriptionId ?? null,
		source: getRequestedMedicationSource(requestEntry, medication, medicationReference),
	};
};

const pickLatest = (medications: LatestFhirMedication[]): LatestFhirMedication | null => {
	let latest: LatestFhirMedication | null = null;
	for (const medication of medications) {
		if (
			!latest ||
			(medication.date !== null && (latest.date === null || medication.date >= latest.date)) ||
			(medication.date === null && latest.date === null)
		) {
			latest = medication;
		}
	}
	return latest;
};

export const findLatestMedication = (input: unknown): LatestFhirMedication | null => {
	const resources = collectResources(input);
	const medications = resources
		.filter((entry) => entry.resource.resourceType === "Medication")
		.map(toMedicationDetails);
	const medicationRequests = resources.filter(
		(entry) => entry.resource.resourceType === "MedicationRequest",
	);

	if (medicationRequests.length) {
		return pickLatest(
			medicationRequests.map((request) => toRequestedMedication(request, medications)),
		);
	}

	return pickLatest(medications.map(toStandaloneMedication));
};
