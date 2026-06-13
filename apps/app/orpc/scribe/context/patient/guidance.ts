import type { PatientContextData } from "@/orpc/scribe/context/types";

type PatientContextTag = "diagnoseblock" | "anamnese" | "befunde" | "epikrise" | "notizen";

const GENERAL_GUIDANCE =
  `BEFUNDE und DIAGNOSEN sichten und chronologisch sortieren, um zu sortieren, was vor der aktuellen Vorstellung bereits bekannt war (Vordiagnosen) und was neu ist (aktuelle Diagnosen)`;

interface ContextSection {
	purpose: string;
	tag: PatientContextTag;
	usage: string;
}

interface PatientContextSection extends ContextSection {
	getContent: (input: PatientContextData) => string;
}

const renderPatientContextSection = ({
	content,
	section,
}: {
	content: string;
	section: ContextSection;
}): string => {
	const usageBlock = section.usage.includes("\n")
		? `\n${section.usage}\n`
		: section.usage;
	const trimmedContent = content.trim();
	if (!trimmedContent) {
		return "";
	}

  return [
    GENERAL_GUIDANCE,
		`<${section.tag}>`,
		`<purpose>${section.purpose}</purpose>`,
		`<usage>${usageBlock}</usage>`,
		"<content>",
		trimmedContent,
		"</content>",
		`</${section.tag}>`,
	].join("\n");
};

const PATIENT_CONTEXT_SECTION_GUIDANCE: ContextSection[] = [
	{
		purpose:
			'Aktuelle Diagnose und Vordiagnosen (meist durch "Vordiagnosen:" oder "Nebendiagnosen:" getrennt) wie chronische Erkrankungen und relevante Voroperationen/interventionen',
		tag: "diagnoseblock",
		usage:
			"Aktuelle Diagnosen beschreiben den aktuellen Aufenthalt/Vorstellung. Vordiagnosen beziehen sich NICHT auf das aktuelle Dokument, sondern sind Kontext zu früheren Erkrankungen",
	},
	{
		purpose: "Ausgangspunkt und Aufnahmegrund",
		tag: "anamnese",
		usage: [
			"- Kurz zu Beginn aufgreifen für Aufnahmegrund/Verdachtsdiagnose",
			"- KEINE WIEDERHOLUNG von Anamnese-Fakten (Vermeidung von Dopplungen)",
			"- Beschreibt Verlauf unmittelbar vor Aufnahme",
		].join("\n"),
	},
	{
		purpose: "Chronologische Dokumentation des stationären Verlaufs",
		tag: "befunde",
		usage: [
			"- Chronologische Einordnung der Untersuchungen bei aktueller Vorstellung / stationärem Aufenthalt",
			"- Grundlage für Verlaufsrekonstruktion",
			"- Alle Untersuchungen, Konsile, wichtige Einträge",
		].join("\n"),
	},
	{
		purpose: "Bewertende Epikrise oder zusammenfassender klinischer Verlauf",
		tag: "epikrise",
		usage: [
			"- Als bereits formulierte klinische Zusammenfassung verwenden",
			"- Nicht unnötig wiederholen; bei Folgegenerierung als bestehende Epikrise weiterverarbeiten",
			"- Vorrangig für Arztbrief-, Ambulanzbrief- und Verlegungstexte",
		].join("\n"),
	},
	{
		purpose: "Haupteingabe des Nutzers für das zu erstellende Dokument",
		tag: "notizen",
		usage: "PRIMÄRE BASIS FÜR DOKUMENT-ERSTELLUNG",
	},
];

const PATIENT_CONTEXT_CONTENT_EXTRACTORS: Record<
	PatientContextTag,
	(input: PatientContextData) => string
> = {
	anamnese: (input) => input.anamnese,
	befunde: (input) => input.befunde,
	diagnoseblock: (input) => input.diagnoseblock,
	epikrise: (input) => input.epikrise,
	notizen: (input) => input.notes,
};

const PATIENT_CONTEXT_SECTIONS: PatientContextSection[] =
	PATIENT_CONTEXT_SECTION_GUIDANCE.map((section) => ({
		...section,
		getContent: PATIENT_CONTEXT_CONTENT_EXTRACTORS[section.tag],
	}));

export const renderPatientContextSections = (
	patientContext: PatientContextData,
): string => {
	const sections = PATIENT_CONTEXT_SECTIONS
		.map((section) =>
			renderPatientContextSection({
				content: section.getContent(patientContext),
				section,
			}),
		)
		.filter((section) => section.length > 0);

	if (sections.length === 0) {
		return "";
	}

	return `<patient_context>\n${sections.join("\n\n")}\n</patient_context>`;
};
