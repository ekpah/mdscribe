type JsonObject = Record<string, unknown>;

export interface FhirTrendPoint {
	date: number | null;
	dateLabel: string;
	observationId: string | null;
	source: FhirSourceInfo;
	value: number;
}

export interface FhirSourceInfo {
	reference: string;
	sourceUri: string | null;
	status: string | null;
	subjectReference: string | null;
}

export interface FhirTrendSeries {
	key: string;
	label: string;
	code: string | null;
	unit: string | null;
	points: FhirTrendPoint[];
	undatedPointCount: number;
}

export interface FhirParseResult {
	observationCount: number;
	resourceCount: number;
	series: FhirTrendSeries[];
}

export interface LatestFhirMeasurement {
	point: FhirTrendPoint;
	series: FhirTrendSeries;
}

interface CodeDetails {
	code: string | null;
	identifier: string;
	label: string;
}

interface NumericValue {
	unit: string | null;
	value: number;
}

interface MutableSeries {
	code: string | null;
	key: string;
	label: string;
	points: FhirTrendPoint[];
	unit: string | null;
}

const isObject = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
	typeof value === "string" && value.trim() ? value.trim() : null;

const asFiniteNumber = (value: unknown): number | null => {
	if (typeof value !== "number") {
		return null;
	}
	return Number.isFinite(value) ? value : null;
};

const getCodeDetails = (value: unknown, fallback: string): CodeDetails => {
	if (!isObject(value)) {
		return { code: null, identifier: fallback, label: fallback };
	}

	const text = asString(value.text);
	const coding = Array.isArray(value.coding)
		? value.coding.find((entry) => isObject(entry) && asString(entry.code))
		: undefined;
	const codingObject = isObject(coding) ? coding : null;
	const code = codingObject ? asString(codingObject.code) : null;
	const system = codingObject ? asString(codingObject.system) : null;
	const display = codingObject ? asString(codingObject.display) : null;

	return {
		code,
		identifier: code ? `${system ?? "unspecified-system"}|${code}` : (text ?? fallback),
		label: text ?? display ?? code ?? fallback,
	};
};

const getNumericValue = (container: JsonObject): NumericValue | null => {
	if (isObject(container.valueQuantity)) {
		const value = asFiniteNumber(container.valueQuantity.value);
		if (value !== null) {
			return {
				unit: asString(container.valueQuantity.unit) ?? asString(container.valueQuantity.code),
				value,
			};
		}
	}

	for (const property of ["valueDecimal", "valueInteger", "valuePositiveInt", "valueUnsignedInt"]) {
		const value = asFiniteNumber(container[property]);
		if (value !== null) {
			return { unit: null, value };
		}
	}

	return null;
};

const getObservationDate = (observation: JsonObject): string | null => {
	const effectivePeriod = isObject(observation.effectivePeriod)
		? observation.effectivePeriod
		: null;
	const appliesPeriod = isObject(observation.appliesPeriod) ? observation.appliesPeriod : null;
	const meta = isObject(observation.meta) ? observation.meta : null;

	return (
		asString(observation.effectiveDateTime) ??
		asString(observation.effectiveInstant) ??
		(effectivePeriod ? asString(effectivePeriod.start) : null) ??
		asString(observation.appliesDateTime) ??
		(appliesPeriod ? asString(appliesPeriod.start) : null) ??
		asString(observation.issued) ??
		(meta ? asString(meta.lastUpdated) : null)
	);
};

const toTrendPoint = (observation: JsonObject, value: number): FhirTrendPoint => {
	const rawDate = getObservationDate(observation);
	const parsedDate = rawDate ? Date.parse(rawDate) : Number.NaN;
	const hasValidDate = Number.isFinite(parsedDate);
	const observationId = asString(observation.id);
	const meta = isObject(observation.meta) ? observation.meta : null;
	const subject = isObject(observation.subject) ? observation.subject : null;

	return {
		date: hasValidDate ? parsedDate : null,
		dateLabel: rawDate ?? "Kein Datum",
		observationId,
		source: {
			reference: observationId ? `Observation/${observationId}` : "Observation",
			sourceUri: meta ? asString(meta.source) : null,
			status: asString(observation.status),
			subjectReference: subject ? asString(subject.reference) : null,
		},
		value,
	};
};

const HEMOGLOBIN_LOINC_CODES = new Set([
	"718-7",
	"20509-6",
	"30313-1",
	"30350-3",
	"55782-7",
	"59260-0",
]);

const isHemoglobinSeries = (series: FhirTrendSeries): boolean => {
	if (series.code && HEMOGLOBIN_LOINC_CODES.has(series.code)) {
		return true;
	}

	return /(^|[^\p{L}\p{N}])(hb|hgb|hämoglobin|haemoglobin|hemoglobin)(?=$|[^\p{L}\p{N}])/iu.test(
		series.label,
	);
};

export const findLatestHemoglobin = (series: FhirTrendSeries[]): LatestFhirMeasurement | null => {
	let latest: LatestFhirMeasurement | null = null;

	for (const candidateSeries of series) {
		if (!isHemoglobinSeries(candidateSeries)) {
			continue;
		}
		for (const point of candidateSeries.points) {
			if (
				!latest ||
				(point.date !== null && (latest.point.date === null || point.date >= latest.point.date)) ||
				(point.date === null && latest.point.date === null)
			) {
				latest = { point, series: candidateSeries };
			}
		}
	}

	return latest;
};

const collectResources = (input: unknown): JsonObject[] => {
	const resources: JsonObject[] = [];
	const visited = new WeakSet<object>();

	const visit = (value: unknown) => {
		if (Array.isArray(value)) {
			for (const item of value) {
				visit(item);
			}
			return;
		}
		if (!isObject(value) || visited.has(value)) {
			return;
		}

		visited.add(value);
		if (asString(value.resourceType)) {
			resources.push(value);
		}
		for (const nestedValue of Object.values(value)) {
			visit(nestedValue);
		}
	};

	visit(input);
	return resources;
};

const addMeasurement = (
	seriesByKey: Map<string, MutableSeries>,
	observation: JsonObject,
	codeDetails: CodeDetails,
	numericValue: NumericValue,
) => {
	const unitKey = numericValue.unit ?? "unitless";
	const key = `${codeDetails.identifier}|${unitKey}`;
	const existing = seriesByKey.get(key);
	const point = toTrendPoint(observation, numericValue.value);

	if (existing) {
		existing.points.push(point);
		return;
	}

	seriesByKey.set(key, {
		code: codeDetails.code,
		key,
		label: codeDetails.label,
		points: [point],
		unit: numericValue.unit,
	});
};

export const parseFhirTrends = (input: unknown): FhirParseResult => {
	const resources = collectResources(input);
	const observations = resources.filter((resource) => resource.resourceType === "Observation");
	const seriesByKey = new Map<string, MutableSeries>();

	for (const observation of observations) {
		// Older FHIR releases used Observation.name and applies[x]. Supporting
		// those aliases keeps historical exports usable alongside current R4/R5 data.
		const observationCode = getCodeDetails(
			observation.code ?? observation.name,
			"Unbenannter Laborwert",
		);
		const observationValue = getNumericValue(observation);
		if (observationValue) {
			addMeasurement(seriesByKey, observation, observationCode, observationValue);
		}

		if (!Array.isArray(observation.component)) {
			continue;
		}
		for (const component of observation.component) {
			if (!isObject(component)) {
				continue;
			}
			const componentValue = getNumericValue(component);
			if (!componentValue) {
				continue;
			}
			const componentCode = getCodeDetails(
				component.code ?? component.name,
				`${observationCode.label} – Komponente`,
			);
			addMeasurement(seriesByKey, observation, componentCode, componentValue);
		}
	}

	const series = [...seriesByKey.values()]
		.map((entry): FhirTrendSeries => {
			const points = entry.points.toSorted((first, second) => {
				if (first.date === null) {
					return 1;
				}
				if (second.date === null) {
					return -1;
				}
				return first.date - second.date;
			});

			return {
				...entry,
				points,
				undatedPointCount: points.filter((point) => point.date === null).length,
			};
		})
		.toSorted((first, second) => first.label.localeCompare(second.label, "de"));

	return {
		observationCount: observations.length,
		resourceCount: resources.length,
		series,
	};
};
