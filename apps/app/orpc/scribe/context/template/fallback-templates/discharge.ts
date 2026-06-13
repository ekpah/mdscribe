// Inpatient discharge setting for the shared epikrise prompt harness.
const NARRATIVE_OUTPUT_STRUCTURE = `# Epikrise

(( Die Patientin ..., initialer Absatz als Beginn der stationären Aufnahme mit Aufnahmegrund und Leitsymptomatik; HAUPTDIAGNOSE als roter Faden ))

(( HAUPTTEIL: stationärer Verlauf mit Diagnostik, Therapie, Prozeduren, Verlegungen und Komplikationen in chronologischer oder sachlicher Ordnung, medizinisch bewertend verknüpft; ZEITRAUM des Aufenthalts implizit nachvollziehbar ))

(( ENDE: Zustand bei Entlassung + Übergang in die ambulante Versorgung ))

# Procedere

(( Stichpunkte mit KONKRETE EMPFEHLUNGEN zur ambulanten Weiterbehandlung. NUR NICHT-SELBSTVERSTÄNDLICHE PUNKTE (Facharztvorstellungen, spezielle Kontrolltermine, spezifische Medikation) KNAPP UND ÜBERSICHTLICH formuliert))`;

export const DISCHARGE_FALLBACK_TEMPLATE = {
	content: NARRATIVE_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Entlassbrief",
};
