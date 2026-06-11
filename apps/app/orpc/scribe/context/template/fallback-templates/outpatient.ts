// Ambulatory/ED setting for the shared epikrise prompt harness.
const OUTPATIENT_OUTPUT_STRUCTURE = `# Epikrise

(( Initialer Absatz: ambulante Vorstellung bzw. Vorstellung in der Notaufnahme mit Vorstellungsgrund und Leitsymptomatik; ARBEITSDIAGNOSE als roter Faden. Persönliche Ansprache des Patienten (Herr/Frau + Name) nur dort, wo passend und ohne künstlich zu wirken ))

(( HAUPTTEIL: Verlauf des Kontakts mit fokussierter Diagnostik, Therapieentscheidungen und Prozeduren, medizinisch bewertend verknüpft; entscheidungsrelevante Differenzialdiagnosen einordnen; ZEITPUNKT UND RAHMEN des Kontakts implizit nachvollziehbar ))

(( ENDE: ENTSCHEIDUNGSPUNKT klar begründen (z.B. Entlassung nach Hause, ambulante Weiterbehandlung, stationäre Aufnahme oder Verlegung) + Zustand bei Abschluss des Kontakts ))

# Procedere

(( Stichpunkte mit KONKRETE EMPFEHLUNGEN zum weiteren Vorgehen (Kontrollen, weiterführende Diagnostik, Therapieanpassungen). NUR NICHT-SELBSTVERSTÄNDLICHE PUNKTE KNAPP UND ÜBERSICHTLICH formuliert))`;

export const OUTPATIENT_FALLBACK_TEMPLATE = {
	content: OUTPATIENT_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Ambulanzbrief",
};
