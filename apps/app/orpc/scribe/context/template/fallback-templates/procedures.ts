const PROCEDURES_OUTPUT_STRUCTURE = `<output_structure>
<sections>
<befund>
- Detaillierte Beschreibung der durchgeführten Prozedur
- Verwendete Materialien, Medikamente und Dosierungen
- Technisches Vorgehen und anatomische Lokalisationen
- Intraprozedurale Besonderheiten oder Komplikationen
</befund>

<beurteilung>
- Zusammenfassende Bewertung des Eingriffs
- Erfolg der Prozedur
- Aufgetretene Komplikationen (falls vorhanden)
</beurteilung>

<empfehlung>
- Postprozedurale Maßnahmen
- Erforderliche Kontrollen oder Nachuntersuchungen
- Spezielle Überwachungsanweisungen
</empfehlung>
</sections>
</output_structure>`;

export const PROCEDURES_FALLBACK_TEMPLATE = {
	content: PROCEDURES_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Prozedurbefund",
};
