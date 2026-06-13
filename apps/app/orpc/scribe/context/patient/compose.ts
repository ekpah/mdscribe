import type { ContextSource, PatientContextData } from "@/orpc/scribe/context/types";
import { renderPatientContextSections } from "./guidance";

const EMPTY_PATIENT_CONTEXT: PatientContextData = {
	anamnese: "",
	befunde: "",
	diagnoseblock: "",
	epikrise: "",
	notes: "",
};

const toTrimmedString = (value: unknown): string =>
	typeof value === "string" ? value.trim() : "";

const mergeField = (current: string, next: string): string => {
	if (!current) {
		return next;
	}
	if (!next) {
		return current;
	}
	return `${current}\n\n${next}`;
};

const mergePatientContext = (
	current: PatientContextData,
	next: PatientContextData,
): PatientContextData => ({
	anamnese: mergeField(current.anamnese, next.anamnese),
	befunde: mergeField(current.befunde, next.befunde),
	diagnoseblock: mergeField(current.diagnoseblock, next.diagnoseblock),
	epikrise: mergeField(current.epikrise, next.epikrise),
	notes: mergeField(current.notes, next.notes),
});

const normalizeFormSource = (data: Record<string, unknown>): PatientContextData => ({
	anamnese: toTrimmedString(data.anamnese),
	befunde: toTrimmedString(data.befunde),
	diagnoseblock: toTrimmedString(data.diagnoseblock),
	epikrise: toTrimmedString(data.epikrise),
	notes: toTrimmedString(data.notes),
});

export const derivePatientContext = (sources: ContextSource[]): PatientContextData => {
	let current = EMPTY_PATIENT_CONTEXT;

	for (const source of sources) {
		if (source.kind === "form") {
			current = mergePatientContext(current, normalizeFormSource(source.data));
		}
	}

	return current;
};

export const composePatientContext = (sources: ContextSource[]): string => {
	const patientContext = derivePatientContext(sources);
	return renderPatientContextSections(patientContext);
};
