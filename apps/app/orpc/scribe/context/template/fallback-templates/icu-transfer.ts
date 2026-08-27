const ICU_TRANSFER_OUTPUT_STRUCTURE = `<output_structure>
<title>Intensiv Verlegungsbrief</title>
## Epikrise
Aufnahmegrund und Leitsymptomatik in einleitendem Satz eingeordnet. Insbesondere auch intensivmedizinische Aufnahme rechtfertigen. ((KEINE Wiederholung von Anamnese- oder Diagnoseninhalten.))
HAUPTTEIL: Diagnostik, Behandlung, Verlauf mit medizinischer Bewertung
ENDE: Zustand bei Verlegung + Übergang auf die Normalstation
## Procedere
Stichpunkte mit KONKRETEN EMPFEHLUNGEN zur Weiterbehandlung, insbesondere was im stationären Aufenthalt noch erledigt werden muss. ((NUR NICHT-SELBSTVERSTÄNDLICHE PUNKTE (Untersuchungen, essenzielle Kontrollen wie Röntgen oder Labor, spezifische Medikation), KNAPP UND ÜBERSICHTLICH formuliert))
</output_structure>`;

const ICU_TRANSFER_OUTPUT_EXAMPLE = `## Epikrise

Die stationäre Aufnahme des Patienten erfolgte bei rezidivierenden linksthorakalen Ruheschmerzen mit Verdacht auf eine Progression der vorbekannten koronaren 3-Gefäßerkrankung. Bei anhaltendem thorakalem Druckgefühl trotz präklinischer Analgesie wurde eine invasive Koronardiagnostik durchgeführt. Die Koronarangiographie am 22.12.2025 zeigte ein gutes Ergebnis nach der Vorintervention am RIVA sowie keine signifikanten Stenosen im Bereich des Hauptstammes, RCX und RCA, sodass eine relevante Progression der KHK ausgeschlossen werden konnte.

Anamnestisch waren die Beschwerden zeitlich eindeutig mit Episoden von tachykardem Vorhofflimmern assoziiert. Bei echokardiographisch erhaltener linksventrikulärer Funktion und fehlender kardialer Dekompensation wurde die Angina pectoris als Ausdruck des symptomatischen paroxysmalen Vorhofflimmerns gewertet. Hieraus ergibt sich die Indikation zur Pulmonalvenenisolation, die für den 12.03.2026 terminiert wurde.

Der Patient konnte in stabilem Allgemeinzustand und beschwerdefrei entlassen werden. Die bestehende Frequenzkontrolle mit Verapamil sowie die Antikoagulation mit Rivaroxaban werden fortgeführt.

## Procedere

- Pulmonalvenenisolation am 12.03.2026, 7:15 Uhr, nüchtern erscheinen
- Präinterventionelle Aufklärung und TEE am 11.03.2026, 8:00 Uhr, nüchtern, mit Begleitperson, Medikamentenplan, Krankenhauseinweisung und Versichertenkarte mitbringen`;

export const ICU_TRANSFER_FALLBACK_TEMPLATE = {
	content: ICU_TRANSFER_OUTPUT_STRUCTURE,
	examples: [ICU_TRANSFER_OUTPUT_EXAMPLE],
	title: "Standardstruktur Intensiv-Verlegungsbrief",
};
