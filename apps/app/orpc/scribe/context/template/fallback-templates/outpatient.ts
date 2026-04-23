const OUTPATIENT_OUTPUT_STRUCTURE = `# Epikrise

(( Die Patientin ..., initialer Absatz als Beginn mit Aufnahmegrund und Leitsymptomatik))

(( HAUPTTEIL: Diagnostik, Behandlung, Verlauf mit medizinischer Bewertung ))

(( ENDE: Zustand bei Entlassung + Übergang ambulante Versorgung ))

# Procedere

(( Stichpunkte mit KONKRETE EMPFEHLUNGEN zur ambulanten Weiterbehandlung. NUR NICHT-SELBSTVERSTÄNDLICHE PUNKTE (Facharztvorstellungen, spezielle Kontrolltermine, spezifische Medikation) KNAPP UND ÜBERSICHTLICH formuliert))`;

export const OUTPATIENT_FALLBACK_TEMPLATE = {
	content: OUTPATIENT_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Ambulanzbrief",
};
