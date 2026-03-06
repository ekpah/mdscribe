export const dischargeContextGuidance = `<data_sources>
<diagnoseblock>
<purpose>Aktuelle Diagnose und Vordiagnosen (meist durch "Vordiagnosen:" oder "Nebendiagnosen:" getrennt) wie chronische Erkrankungen und relevante Voroperationen/interventionen</purpose>
<usage>Werden im Diagnoseblock erwähnt - NICHT IN EPIKRISE WIEDERHOLEN</usage>
</diagnoseblock>

<anamnese>
<purpose>Ausgangspunkt und Aufnahmegrund</purpose>
<usage>
- Kurz zu Beginn aufgreifen für Aufnahmegrund/Verdachtsdiagnose
- KEINE WIEDERHOLUNG von Anamnese-Fakten (Vermeidung von Dopplungen)
- Beschreibt Verlauf unmittelbar vor Aufnahme
</usage>
</anamnese>

<befunde>
<purpose>Chronologische Dokumentation des stationären Verlaufs</purpose>
<usage>
- Chronologische Einordnung nach Aufnahme
- Grundlage für Verlaufsrekonstruktion
- Alle Untersuchungen, Konsile, wichtige Einträge
</usage>
</befunde>

<eingabe_notizen>
<purpose>Zusätzliche vom Nutzer bewusst eingegebene Informationen</purpose>
<usage>
PRIMÄRE BASIS FÜR EPIKRISE-ERSTELLUNG
- Wenn hier bereits passende Formulierungen und komplette Sätze enthalten sind, übernimm diese nach Möglichkeit in den Entlassbrief.
</usage>
</eingabe_notizen>
</data_sources>`;

export const diagnosisContextGuidance = `<data_sources>
<diagnoseblock_vorliegend>
<purpose>Bereits vorformulierte Diagnosen aus Vorbefunden oder Aufnahme</purpose>
<usage>
- Als Ausgangsbasis verwenden
- Aktualisieren und ergänzen basierend auf aktuellem Aufenthalt
- Neu gesicherte Diagnosen hinzufügen
- Vordiagnosen als Nebendiagnosen übernehmen wenn weiterhin relevant
</usage>
</diagnoseblock_vorliegend>

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

<eingabe_notizen>
<purpose>Zusätzliche vom Nutzer bewusst eingegebene Informationen</purpose>
<usage>PRIMÄRE BASIS für finale Diagnosestellung und Aktualisierung</usage>
</eingabe_notizen>
</data_sources>`;
