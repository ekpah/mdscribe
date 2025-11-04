// construct patient context for llm queries to efficiently summarize all available patient data
export function constructPatientContext(patientData) {
  const patientContext = `
  <patient_context>
<data_sources>
<diagnoseblock>
<purpose>Aktuelle Diagnose und Vordiagnosen (meist durch "Vordiagnosen:" oder "Nebendiagnosen:" getrennt) wie chronische Erkrankungen und relevante Voroperationen/interventionen</purpose>
<usage>Werden im Diagnoseblock erwähnt - NICHT IN EPIKRISE WIEDERHOLEN</usage>
<content>${patientData.diagnoseblock}</content>
</diagnoseblock>

<anamnese>
<purpose>Ausgangspunkt und Aufnahmegrund</purpose>
<usage>
- Kurz zu Beginn aufgreifen für Aufnahmegrund/Verdachtsdiagnose
- KEINE WIEDERHOLUNG von Anamnese-Fakten (Vermeidung von Dopplungen)
- Beschreibt Verlauf unmittelbar vor Aufnahme
</usage>
<content>${patientData.anamnese}</content>
</anamnese>

<befunde>
<purpose>Chronologische Dokumentation des stationären Verlaufs</purpose>
<usage>
- Chronologische Einordnung nach Aufnahme
- Grundlage für Verlaufsrekonstruktion
- Alle Untersuchungen, Konsile, wichtige Einträge
</usage>
<content>${patientData.befunde}</content>
</befunde>

<eingabe_notizen>
<purpose>Zusätzliche vom Nutzer bewusst eingegebene Informationen</purpose>
<usage>
PRIMÄRE BASIS FÜR EPIKRISE-ERSTELLUNG
- Wenn hier bereits passende Formulierungen und komplette Sätze enthalten sind, übernimm diese nach Möglichkeit in den Entlassbrief.
</usage>
<content>${patientData.eingabe_notizen}</content>
</eingabe_notizen>

</data_sources>
</patient_context>
`;
  return patientContext;
}
