const DIAGNOSIS_FALLBACK_TEMPLATE_CONTENT = `((Hauptdiagnose))

(( relevante Untersuchungen mit Untersuchung und Datum einfügen, wie z.B.: "- Bronchoskopie vom 30.04.: Unauffälliger makroskopischer Befund, BAL ausstehend". Auch externe Vorbefunde einfügen mit Vermerk (extern) nach dem Datum, sofern für die aktuelle Erkrankung relevant))

((Nebendiagnosen))

Vorerkrankungen:

(( Vorerkrankungen aufgelistet inkl. Datum "Z.n. ..." oder Stadium/weiteren Details. In der Regel einfach die Eingabe kopieren ))`;

export const DIAGNOSIS_FALLBACK_TEMPLATE = {
	content: DIAGNOSIS_FALLBACK_TEMPLATE_CONTENT,
	examples: [] as string[],
	title: "Standardstruktur Diagnoseblock",
};
