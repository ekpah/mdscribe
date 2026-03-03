import { derivePatientContext } from "../normalize";
import type { ContextProvider, ContextSectionSpec, PatientContextData } from "../types";

const patientContextSections: ContextSectionSpec[] = [
	{
		getContent: (input: PatientContextData) => input.diagnoseblock,
		purpose:
			'Aktuelle Diagnose und Vordiagnosen (meist durch "Vordiagnosen:" oder "Nebendiagnosen:" getrennt) wie chronische Erkrankungen und relevante Voroperationen/interventionen',
		tag: "diagnoseblock",
		usage:
			"Aktuelle Diagnosen beschreiben den aktuellen Aufenthalt/Vorstellung. Vordiagnosen beziehen sich NICHT auf das aktuelle Dokument, sondern sind Kontext zu früheren Erkrankungen",
	},
	{
		getContent: (input: PatientContextData) => input.anamnese,
		purpose: "Ausgangspunkt und Aufnahmegrund",
		tag: "anamnese",
		usage: [
			"- Kurz zu Beginn aufgreifen für Aufnahmegrund/Verdachtsdiagnose",
			"- KEINE WIEDERHOLUNG von Anamnese-Fakten (Vermeidung von Dopplungen)",
			"- Beschreibt Verlauf unmittelbar vor Aufnahme",
		].join("\n"),
	},
	{
		getContent: (input: PatientContextData) => input.befunde,
		purpose: "Chronologische Dokumentation des stationären Verlaufs",
		tag: "befunde",
		usage: [
			"- Chronologische Einordnung der Untersuchungen bei aktueller Vorstellung / stationärem Aufnenthalt",
			"- Grundlage für Verlaufsrekonstruktion",
			"- Alle Untersuchungen, Konsile, wichtige Einträge",
		].join("\n"),
	},
	{
		getContent: (input: PatientContextData) => input.notes,
		purpose: "Zusätzliche vom Nutzer bewusst eingegebene Informationen",
		tag: "notizen",
		usage: "PRIMÄRE BASIS FÜR DOKUMENT-ERSTELLUNG",
	},
];

function renderSection(spec: ContextSectionSpec, content: string): string {
	const trimmedContent = content.trim();
	if (!trimmedContent) {return "";}

	const usage = spec.usage.trim();
	const usageBlock = usage.includes("\n") ? `\n${usage}\n` : usage;

	return [
		`<${spec.tag}>`,
		`<purpose>${spec.purpose}</purpose>`,
		`<usage>${usageBlock}</usage>`,
		"<content>",
		trimmedContent,
		"</content>",
		`</${spec.tag}>`,
	].join("\n");
}

export const patientContextProvider: ContextProvider = {
	build: ({ sources }) => {
		const patientContext = derivePatientContext(sources);
		const sections = patientContextSections
			.map((spec) => renderSection(spec, spec.getContent(patientContext)))
			.filter((section) => section.trim().length > 0)
			.join("\n\n");

		if (!sections) {
			return null;
		}

		return {
			content: sections,
			tag: "patient_context",
		};
	},
	id: "patient",
};
