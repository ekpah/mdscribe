import type { PatientContextData } from "@/orpc/scribe/context/types";

interface PatientContextSection {
	getContent: (input: PatientContextData) => string;
	purpose: string;
	tag: "diagnoseblock" | "anamnese" | "befunde" | "notizen";
	usage: string;
}

export const PATIENT_CONTEXT_SECTIONS: PatientContextSection[] = [
	{
		getContent: (input) => input.diagnoseblock,
		purpose:
			'Aktuelle Diagnose und Vordiagnosen (meist durch "Vordiagnosen:" oder "Nebendiagnosen:" getrennt) wie chronische Erkrankungen und relevante Voroperationen/interventionen',
		tag: "diagnoseblock",
		usage:
			"Aktuelle Diagnosen beschreiben den aktuellen Aufenthalt/Vorstellung. Vordiagnosen beziehen sich NICHT auf das aktuelle Dokument, sondern sind Kontext zu früheren Erkrankungen",
	},
	{
		getContent: (input) => input.anamnese,
		purpose: "Ausgangspunkt und Aufnahmegrund",
		tag: "anamnese",
		usage: [
			"- Kurz zu Beginn aufgreifen für Aufnahmegrund/Verdachtsdiagnose",
			"- KEINE WIEDERHOLUNG von Anamnese-Fakten (Vermeidung von Dopplungen)",
			"- Beschreibt Verlauf unmittelbar vor Aufnahme",
		].join("\n"),
	},
	{
		getContent: (input) => input.befunde,
		purpose: "Chronologische Dokumentation des stationären Verlaufs",
		tag: "befunde",
		usage: [
			"- Chronologische Einordnung der Untersuchungen bei aktueller Vorstellung / stationärem Aufenthalt",
			"- Grundlage für Verlaufsrekonstruktion",
			"- Alle Untersuchungen, Konsile, wichtige Einträge",
		].join("\n"),
	},
	{
		getContent: (input) => input.notes,
		purpose: "Zusätzliche vom Nutzer bewusst eingegebene Informationen",
		tag: "notizen",
		usage: "PRIMÄRE BASIS FÜR DOKUMENT-ERSTELLUNG",
	},
];

export const DIAGNOSIS_CONTEXT_GUIDANCE = `<data_sources>
<diagnoseblock>
<purpose>Bereits vorformulierte Diagnosen aus Vorbefunden oder Aufnahme</purpose>
<usage>
- Als Ausgangsbasis verwenden
- Aktualisieren und ergänzen basierend auf aktuellem Aufenthalt
- Neu gesicherte Diagnosen hinzufügen
- Vordiagnosen als Nebendiagnosen übernehmen wenn weiterhin relevant
</usage>
</diagnoseblock>

<anamnese>
<purpose>Aufnahmegrund und initiale Symptomatik</purpose>
<usage>
- Hilft bei Identifikation der Hauptdiagnose
- Liefert Kontext für Diagnosestellung
</usage>
</anamnese>

<befunde>
<purpose>Diagnostische Ergebnisse und Verlaufsdokumentation</purpose>
<usage>
- Grundlage für Diagnosesicherung
- Ermöglicht Identifikation aller behandlungsrelevanten Diagnosen
- Liefert Details für präzise Diagnoseformulierung (Stadium, Lokalisation etc.)
</usage>
</befunde>

<notizen>
<purpose>Zusätzliche vom Nutzer bewusst eingegebene Informationen</purpose>
<usage>PRIMÄRE BASIS für finale Diagnosestellung und Aktualisierung</usage>
</notizen>
</data_sources>`;
