type JsonObject = Record<string, unknown>;

interface IndexedResource {
	bundlePointer: string;
	fullUrl: string | null;
	index: number;
	resource: JsonObject;
}

interface ParsedFhirSource {
	code: string | null;
	projection: string;
	resourceType: string;
	sort: string | null;
}

export interface FhirSourceResolution {
	pointer: string;
	query: string;
	source: {
		bundlePointer: string;
		code: string | null;
		date: number | null;
		dateLabel: string;
		fullUrl: string | null;
		prescriptionId: string | null;
		reference: string;
		sourceUri: string | null;
		status: string | null;
		subjectReference: string | null;
	};
	value: unknown;
}

const isObject = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
	typeof value === "string" && value.trim() ? value.trim() : null;

const escapePointerSegment = (value: string): string =>
	value.replaceAll("~", "~0").replaceAll("/", "~1");

const collectResources = (input: unknown): IndexedResource[] => {
	const resources: IndexedResource[] = [];
	const visited = new WeakSet<object>();

	const visit = (value: unknown, pointer: string, inheritedFullUrl: string | null = null) => {
		if (Array.isArray(value)) {
			for (const [index, item] of value.entries()) {
				visit(item, `${pointer}/${index}`, inheritedFullUrl);
			}
			return;
		}
		if (!isObject(value) || visited.has(value)) {
			return;
		}

		visited.add(value);
		if (asString(value.resourceType)) {
			resources.push({
				bundlePointer: pointer || "/",
				fullUrl: inheritedFullUrl,
				index: resources.length,
				resource: value,
			});
		}

		const entryResource = isObject(value.resource) ? value.resource : null;
		if (entryResource) {
			visit(
				entryResource,
				`${pointer}/${escapePointerSegment("resource")}`,
				asString(value.fullUrl) ?? inheritedFullUrl,
			);
		}
		for (const [property, nestedValue] of Object.entries(value)) {
			if (property !== "resource") {
				visit(nestedValue, `${pointer}/${escapePointerSegment(property)}`, inheritedFullUrl);
			}
		}
	};

	visit(input, "");
	return resources;
};

const parseFhirSource = (source: string): ParsedFhirSource | null => {
	if (!source.startsWith("fhir://")) {
		return null;
	}

	const withoutScheme = source.slice("fhir://".length);
	const fragmentIndex = withoutScheme.indexOf("#");
	const hasFragment = fragmentIndex !== -1;
	const selector = hasFragment ? withoutScheme.slice(0, fragmentIndex) : withoutScheme;
	const rawPointer = hasFragment ? withoutScheme.slice(fragmentIndex + 1) : "";
	const queryIndex = selector.indexOf("?");
	const hasQuery = queryIndex !== -1;
	const selectorPath = hasQuery ? selector.slice(0, queryIndex) : selector;
	const [resourceType, operation] = selectorPath.split("/").filter(Boolean);
	if (!resourceType) {
		return null;
	}

	const search = new URLSearchParams(hasQuery ? selector.slice(queryIndex + 1) : "");
	const decodedPointer = decodeURIComponent(rawPointer);
	return {
		code: search.get("code"),
		projection: decodedPointer,
		resourceType,
		sort: search.get("_sort") ?? (operation === "latest" ? "-date" : null),
	};
};

const normalizeSystem = (value: string): string => value.replace(/\/$/, "").toLowerCase();

const getCodings = (resource: JsonObject): JsonObject[] => {
	let concept: JsonObject | null = null;
	if (isObject(resource.code)) {
		concept = resource.code;
	} else if (isObject(resource.name)) {
		concept = resource.name;
	}
	if (!concept || !Array.isArray(concept.coding)) {
		return [];
	}
	return concept.coding.filter(isObject);
};

const matchesCode = (resource: JsonObject, token: string | null): boolean => {
	if (!token) {
		return true;
	}
	const separatorIndex = token.lastIndexOf("|");
	const hasSystem = separatorIndex !== -1;
	const requestedSystem = hasSystem ? token.slice(0, separatorIndex) : null;
	const requestedCode = hasSystem ? token.slice(separatorIndex + 1) : token;

	return getCodings(resource).some((coding) => {
		if (asString(coding.code) !== requestedCode) {
			return false;
		}
		if (!requestedSystem) {
			return true;
		}
		const system = asString(coding.system);
		return Boolean(system && normalizeSystem(system) === normalizeSystem(requestedSystem));
	});
};

const getPeriodStart = (value: unknown): string | null =>
	isObject(value) ? asString(value.start) : null;

const getResourceDate = (resource: JsonObject, sort: string | null): string | null => {
	const meta = isObject(resource.meta) ? resource.meta : null;
	if (sort?.replace(/^-/, "") === "_lastUpdated") {
		return meta ? asString(meta.lastUpdated) : null;
	}

	return (
		asString(resource.effectiveDateTime) ??
		asString(resource.effectiveInstant) ??
		getPeriodStart(resource.effectivePeriod) ??
		asString(resource.appliesDateTime) ??
		getPeriodStart(resource.appliesPeriod) ??
		asString(resource.authoredOn) ??
		asString(resource.issued) ??
		(meta ? asString(meta.lastUpdated) : null)
	);
};

const toEpoch = (value: string | null): number | null => {
	if (!value) {
		return null;
	}
	const epoch = Date.parse(value);
	return Number.isFinite(epoch) ? epoch : null;
};

const sortResources = (resources: IndexedResource[], sort: string | null): IndexedResource[] => {
	if (!sort) {
		return resources;
	}
	const descending = sort.startsWith("-");
	return resources.toSorted((first, second) => {
		const firstDate = toEpoch(getResourceDate(first.resource, sort));
		const secondDate = toEpoch(getResourceDate(second.resource, sort));
		const firstRank = firstDate ?? Number.NEGATIVE_INFINITY;
		const secondRank = secondDate ?? Number.NEGATIVE_INFINITY;
		const dateDifference = firstRank - secondRank;
		if (dateDifference !== 0) {
			return descending ? -dateDifference : dateDifference;
		}
		return descending ? second.index - first.index : first.index - second.index;
	});
};

const resolveJsonPointer = (value: unknown, pointer: string): unknown => {
	if (!pointer) {
		return value;
	}
	let current = value;
	for (const encodedSegment of pointer.slice(1).split("/")) {
		const segment = encodedSegment.replaceAll("~1", "/").replaceAll("~0", "~");
		if (Array.isArray(current)) {
			const index = Number(segment);
			if (!Number.isInteger(index) || index < 0 || index >= current.length) {
				return undefined;
			}
			current = current[index];
			continue;
		}
		if (!isObject(current) || !(segment in current)) {
			return undefined;
		}
		current = current[segment];
	}
	return current;
};

const fhirPathToJsonPointer = (resource: JsonObject, expression: string): string | null => {
	if (!expression) {
		return "";
	}
	const normalizedExpression = expression
		.replaceAll(/\.ofType\(([A-Za-z][A-Za-z0-9]*)\)/g, "$1")
		.replaceAll(".first()", "[0]");
	const segments = normalizedExpression.split(".").filter(Boolean);
	if (segments[0] === resource.resourceType) {
		segments.shift();
	}

	const pointerSegments: string[] = [];
	for (const segment of segments) {
		const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(segment);
		if (!match?.[1]) {
			return null;
		}
		pointerSegments.push(escapePointerSegment(match[1]));
		if (match[2]) {
			pointerSegments.push(match[2]);
		}
	}
	return pointerSegments.length ? `/${pointerSegments.join("/")}` : "";
};

const resolveProjection = (
	resource: JsonObject,
	projection: string,
): { pointer: string; value: unknown } | null => {
	const pointer = projection.startsWith("/")
		? projection
		: fhirPathToJsonPointer(resource, projection);
	if (pointer === null) {
		return null;
	}
	const value = resolveJsonPointer(resource, pointer);
	return value === undefined ? null : { pointer, value };
};

const getPrescriptionId = (resource: JsonObject): string | null => {
	if (!Array.isArray(resource.extension)) {
		return null;
	}
	for (const extension of resource.extension) {
		if (
			isObject(extension) &&
			asString(extension.url)?.includes("rx-prescription-process-identifier") &&
			isObject(extension.valueIdentifier)
		) {
			return asString(extension.valueIdentifier.value);
		}
	}
	return null;
};

const getResourceReference = (selected: IndexedResource): string => {
	if (selected.fullUrl) {
		return selected.fullUrl;
	}
	const resourceType = asString(selected.resource.resourceType) ?? "Resource";
	const id = asString(selected.resource.id);
	return id ? `${resourceType}/${id}` : resourceType;
};

export const resolveFhirSource = (input: unknown, source: string): FhirSourceResolution | null => {
	const parsed = parseFhirSource(source);
	if (!parsed) {
		return null;
	}
	const candidates = collectResources(input).filter(
		(entry) =>
			asString(entry.resource.resourceType)?.toLowerCase() === parsed.resourceType.toLowerCase() &&
			matchesCode(entry.resource, parsed.code),
	);
	const [selected] = sortResources(candidates, parsed.sort);
	if (!selected) {
		return null;
	}
	const projection = resolveProjection(selected.resource, parsed.projection);
	if (!projection) {
		return null;
	}

	const resourceDate = getResourceDate(selected.resource, parsed.sort);
	const meta = isObject(selected.resource.meta) ? selected.resource.meta : null;
	const subject = isObject(selected.resource.subject) ? selected.resource.subject : null;
	const [coding] = getCodings(selected.resource);
	return {
		pointer: projection.pointer,
		query: source,
		source: {
			bundlePointer: `${selected.bundlePointer}${projection.pointer}`,
			code: coding ? asString(coding.code) : null,
			date: toEpoch(resourceDate),
			dateLabel: resourceDate ?? "Kein Datum",
			fullUrl: selected.fullUrl,
			prescriptionId: getPrescriptionId(selected.resource),
			reference: getResourceReference(selected),
			sourceUri: meta ? asString(meta.source) : null,
			status: asString(selected.resource.status),
			subjectReference: subject ? asString(subject.reference) : null,
		},
		value: projection.value,
	};
};

const formatQuantity = (value: JsonObject): string | null => {
	if (typeof value.value !== "number") {
		return null;
	}
	const unit = asString(value.code) ?? asString(value.unit);
	return `${value.value.toLocaleString("de-DE", { maximumFractionDigits: 4 })}${unit ? ` ${unit.replaceAll(/[{}]/g, "")}` : ""}`;
};

export const formatFhirSourceValue = (value: unknown): string => {
	if (value === null || value === undefined) {
		return "–";
	}
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (isObject(value)) {
		const quantity = formatQuantity(value);
		if (quantity) {
			return quantity;
		}
		const numerator = isObject(value.numerator) ? formatQuantity(value.numerator) : null;
		const denominator = isObject(value.denominator) ? formatQuantity(value.denominator) : null;
		if (numerator && denominator) {
			return `${numerator} / ${denominator}`;
		}
	}
	return JSON.stringify(value);
};
