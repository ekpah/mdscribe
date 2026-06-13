// Setting-neutral epikrise structure, used when an epikrise-harness form has
// no template. The inpatient/outpatient/ICU framing lives in the
// setting-specific fallback templates next to this file.
const EPIKRISE_OUTPUT_STRUCTURE = `# Epikrise

(( Die Patientin ..., initialer Absatz als Beginn mit Aufnahmegrund und Leitsymptomatik))

(( HAUPTTEIL: Diagnostik, Behandlung, Verlauf mit medizinischer Bewertung ))

(( ENDE: Zustand bei Abschluss der Behandlung + Übergang in die weitere Versorgung ))

# Procedere

(( Stichpunkte mit KONKRETE EMPFEHLUNGEN zur Weiterbehandlung. NUR NICHT-SELBSTVERSTÄNDLICHE PUNKTE (Facharztvorstellungen, spezielle Kontrolltermine, spezifische Medikation) KNAPP UND ÜBERSICHTLICH formuliert))`;

export const EPIKRISE_FALLBACK_TEMPLATE = {
	content: EPIKRISE_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Epikrise",
};
