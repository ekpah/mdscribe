import type { ContextSource, PatientContextData } from "@/orpc/scribe/context/types";
import { PATIENT_CONTEXT_SECTIONS } from "./guidance";

const EMPTY_PATIENT_CONTEXT: PatientContextData = {
	anamnese: "",
	befunde: "",
	diagnoseblock: "",
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
	notes: mergeField(current.notes, next.notes),
});

const normalizeFormSource = (data: Record<string, unknown>): PatientContextData => ({
	anamnese: toTrimmedString(data.anamnese),
	befunde: toTrimmedString(data.befunde),
	diagnoseblock: toTrimmedString(data.diagnoseblock),
	notes: toTrimmedString(data.notes),
});

const renderPatientSection = (
	tag: string,
	content: string,
	purpose: string,
	usage: string,
): string => {
	const trimmedContent = content.trim();
	if (!trimmedContent) {
		return "";
	}

	const usageBlock = usage.includes("\n") ? `\n${usage}\n` : usage;

	return [
		`<${tag}>`,
		`<purpose>${purpose}</purpose>`,
		`<usage>${usageBlock}</usage>`,
		"<content>",
		trimmedContent,
		"</content>",
		`</${tag}>`,
	].join("\n");
};

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
	const sections = PATIENT_CONTEXT_SECTIONS
		.map((section) =>
			renderPatientSection(
				section.tag,
				section.getContent(patientContext),
				section.purpose,
				section.usage,
			),
		)
		.filter((section) => section.length > 0);

	if (!sections.length) {
		return "";
	}

	return `<patient_context>\n${sections.join("\n\n")}\n</patient_context>`;
};
