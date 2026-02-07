import type { ContextSource, PatientContextData } from "./types";

const emptyPatientContext: PatientContextData = {
	diagnoseblock: "",
	anamnese: "",
	befunde: "",
	notes: "",
};

const toTrimmedString = (value: unknown): string =>
	typeof value === "string" ? value.trim() : "";

const mergeField = (current: string, next: string): string => {
	if (!current) return next;
	if (!next) return current;
	return `${current}\n\n${next}`;
};

const mergePatientContext = (
	current: PatientContextData,
	next: PatientContextData,
): PatientContextData => ({
	diagnoseblock: mergeField(current.diagnoseblock, next.diagnoseblock),
	anamnese: mergeField(current.anamnese, next.anamnese),
	befunde: mergeField(current.befunde, next.befunde),
	notes: mergeField(current.notes, next.notes),
});

const normalizeFormSource = (data: Record<string, unknown>): PatientContextData => {
	const diagnoseblock = toTrimmedString(data.diagnoseblock);
	const anamnese = toTrimmedString(data.anamnese);
	const befunde = toTrimmedString(data.befunde);
	const notes = toTrimmedString(data.notes);

	return {
		diagnoseblock,
		anamnese,
		befunde,
		notes,
	};
};

export const derivePatientContext = (
	sources: ContextSource[],
): PatientContextData => {
	let current = emptyPatientContext;

	for (const source of sources) {
		if (source.kind === "form") {
			current = mergePatientContext(current, normalizeFormSource(source.data));
		}
	}

	return current;
};
