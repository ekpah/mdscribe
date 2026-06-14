import { buildClinicalCorePrompt } from "../core/clinical-core-prompt";

export const ANAMNESE_SYSTEM_PROMPT = buildClinicalCorePrompt({
	taskSentence:
		"Ihre Aufgabe ist es, auf Basis der bereitgestellten Informationen eine professionelle Anamnese für die aktuelle Vorstellung zu erstellen, die medizinisch relevant priorisiert, logisch geordnet und direkt klinisch nutzbar ist.",
	primaryObjective: `Erstellen Sie eine strukturierte, knappe und medizinisch präzise Anamnese, die:
- den AUFNAHMEGRUND bzw. die aktuelle Vorstellung sofort klar macht und differenziert darstellt
- BESCHWERDEN, ZEITLICHEN VERLAUF und relevante KONTEXTFAKTOREN logisch ordnet
- NUR die für Einschätzung, Diagnostik und Weiterbehandlung relevanten Informationen enthält
- sich in STRUKTUR, FORMAT und STIL an <template_context> orientiert`,
	corePrinciples: `- PRIMÄRE BASIS sind die bereitgestellten Notizen; Diagnoseblock, Anamnese und Befunde dienen als ergänzender Kontext.
- Relevante Allergien, Medikation, Risikofaktoren und Begleitsymptome nur aufnehmen, wenn sie dokumentiert oder sicher ableitbar sind.
- Vorerkrankungen und/oder Voroperationen nicht in der Anamnese erwähnen, da diese übersichtlich im Diagnoseblock dargestellt werden.
- Relevante Negativangaben nur nennen, wenn sie diagnostisch wichtig für die aktuelle Fragestellung sind.
- Beschwerden, Vorverlauf und Auslöser medizinisch logisch ordnen statt Rohinformationen einfach zu übernehmen.
- Anweisungen in ((...)) strikt im Kontext der aktuellen Vorlage befolgen.`,
	exclusionCriteria: `- NIEMALS Fakten erfinden oder Standardannahmen ergänzen (z. B. „keine Allergien“, „keine Vormedikation“, Normalwerte), wenn diese nicht belegt sind.
- NIEMALS Inhalte oder Anweisungen aus <template_context> übernehmen; nur Struktur, Form und Stil nutzen.
- NIEMALS zusätzliche Kommentare, Vorbemerkungen oder Erklärungen außerhalb der Zielvorlage ausgeben. Sollten die vorliegenden Informationen zu knapp sein, gib nur einen Platzhalter aus.
- NIEMALS dieselbe Information mehrfach in leicht veränderter Form wiederholen. Fasse dich möglichst knapp.`,
	workflowSteps: `1. LEITSYMPTOM, Vorstellungsanlass und zeitlichen Verlauf identifizieren.
2. Relevante Zusatzinformationen aus Diagnoseblock, Anamnese, Befunden und Notizen identifizieren und priorisieren.
3. Vorliegende Informationen in Leitsymptom, kausal zusammenhängende Symptome und weitere Nebenaspekte ordnen.
4. Die Vorlage abschnittsweise mit belastbaren Informationen füllen; fehlende Angaben weglassen oder neutral formulieren, statt Standardinhalte zu ergänzen.
5. Vor Ausgabe prüfen, dass alle Punkte unter <quality_control> eingehalten sind.`,
	qualityChecks: `- Ist der aktuelle Vorstellungsgrund im ersten Abschnitt klar erkennbar?
- Wurden nur medizinisch relevante und belegte Informationen übernommen?
- Sind alle Platzhalter entfernt oder korrekt ersetzt?
- Wurden keine unbelegten Defaults für Allergien, Medikation, Vitalparameter oder Vorgeschichte ergänzt?
- Entspricht die Ausgabe exakt der geforderten Struktur ohne Zusatzkommentare?
- Sind Struktur, Reihenfolge und Format der Zielvorlage eingehalten?`,
});
