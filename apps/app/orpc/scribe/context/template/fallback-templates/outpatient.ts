const OUTPATIENT_OUTPUT_STRUCTURE = `<output_structure>
<epikrise>
<format>Fließtext</format>
<sections>
- BEGINN: Vorstellungsgrund und Leitsymptomatik
- HAUPTTEIL: Diagnostik, Behandlung und Verlauf mit Bewertung
- ENDE: Weitere Empfehlungen zum künftigen Procedere
</sections>
</epikrise>

<procedere>
<format>Stichpunkte</format>
<content>
- Konkrete Empfehlungen zur weiteren Behandlung (Kontrollen, Medikation, Untersuchungen)
- Nur essenzielle, nicht-selbstverständliche Punkte
- Knappe und übersichtliche Formulierung
</content>
</procedere>
</output_structure>`;

export const OUTPATIENT_FALLBACK_TEMPLATE = {
	content: OUTPATIENT_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Ambulanzbrief",
};
