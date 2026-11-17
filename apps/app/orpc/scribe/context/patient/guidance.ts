import type { PatientContextData } from "@/orpc/scribe/context/types";

const GENERAL_GUIDANCE = `<hintergrund> war vor der aktuellen Vorstellung bekannt (z. B. Vordiagnosen), <notizen> beschreiben die aktuelle Vorstellung`;

interface PatientContextSection {
	getContent: (input: PatientContextData) => string;
	purpose: string;
	tag: "notizen" | "hintergrund";
	usage: string;
}

const renderPatientContextSection = ({
	content,
	section,
}: {
	content: string;
	section: PatientContextSection;
}): string => {
	const usageBlock = section.usage.includes("\n") ? `\n${section.usage}\n` : section.usage;
	const trimmedContent = content.trim();
	if (!trimmedContent) {
		return "";
	}

	return [
		`<${section.tag}>`,
		`<purpose>${section.purpose}</purpose>`,
		`<usage>${usageBlock}</usage>`,
		"<content>",
		trimmedContent,
		"</content>",
		`</${section.tag}>`,
	].join("\n");
};

const PATIENT_CONTEXT_SECTIONS: PatientContextSection[] = [
	{
		getContent: (input) => input.notes,
		purpose: "Haupteingabe des Nutzers für das zu erstellende Dokument",
		tag: "notizen",
		usage: "PRIMÄRE BASIS FÜR DOKUMENT-ERSTELLUNG",
	},
	{
		getContent: (input) => input.background,
		purpose:
			"Hintergrundinformationen von vor der aktuellen Vorstellung wie Vorbriefe, Vordiagnosen oder Vorbefunde",
		tag: "hintergrund",
		usage: "Faktenquelle; nicht wörtlich abschreiben",
	},
];

export const renderPatientContextSections = (patientContext: PatientContextData): string => {
	const sections = PATIENT_CONTEXT_SECTIONS.map((section) =>
		renderPatientContextSection({
			content: section.getContent(patientContext),
			section,
		}),
	).filter((section) => section.length > 0);

	if (sections.length === 0) {
		return "";
	}

	return `<patient_context>\n<usage>${GENERAL_GUIDANCE}</usage>\n\n${sections.join("\n\n")}\n</patient_context>`;
};
