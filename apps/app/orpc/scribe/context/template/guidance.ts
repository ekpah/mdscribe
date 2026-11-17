import { hasContent, toTrimmedString } from "@/orpc/scribe/_lib/text";
import type { TemplateContextInput } from "@/orpc/scribe/context/types";

const TEMPLATE_CONTEXT_USAGE = `Nutze diese Vorlage als primäre Zielstruktur und stilistische Orientierung.
- Befolge <information> als verbindliche Zusatzanweisungen für das Ausfüllen der Vorlage.
- Zusatzanweisungen dürfen keine fehlenden Patientendaten ersetzen und nicht als Inhalt ausgegeben werden.
- Übernimm NIEMALS Inhalte aus Beispielen oder Vorlagen, nur Struktur, Form und Stil.
- Inhalte dürfen AUSSCHLIEßLICH aus den bereitgestellten Eingaben und dem Patientenkontext stammen.
- Übernimm nicht den Titel aus <title>; nutze ihn nur als Kontext und gib keine XML-Tags zurück.`;

export const MARKDOC_TAG_GUIDANCE = `Markdoc-Tags in der Vorlage sind nur Platzhalterlogik.
- Gib in der finalen Ausgabe niemals Markdoc-Syntax aus (kein {% ... %}).
- {% ai %}...{% /ai %} und ((...)): Anweisung zum Formulieren; befolgen, aber nie selbst ausgeben.
- {% info ... /%}: durch passenden Wert ersetzen; falls unbekannt: [nicht dokumentiert].
- {% switch ... %}{% case ... %}{% /switch %}: nur Text des passenden case ausgeben; passt keine Option, den default-Fall (falls vorhanden); falls unklar: [nicht dokumentiert].
- Bei {% switch ... type="boolean" %} oder type="checkbox": case "true" für wahr, case "false" für falsch verwenden.
- {% condition ... %}{% case ... %}{% /condition %}: Zahlenvergleich (eq =, gt >, gte ≥, lt <, lte ≤); nur den Text des ersten Falls ausgeben, dessen Vergleiche alle zutreffen, sonst den default-Fall. Bei einer Feldliste gilt je Feld ein Wert, null bedeutet beliebig. Fehlen die verglichenen Werte: [nicht dokumentiert].
- {% calc ... /%} oder {% calc ... %}...{% /calc %}: Formel mit belegten Angaben berechnen ([Name] ist der Wert des gleichnamigen Felds, bei einer Auswahl der value= der gewählten Option, Checkbox 1/0) und wie angegeben runden (round, Standard 2 Stellen); enthaltene Tags sind nur Berechnungskomponenten; falls nicht sicher berechenbar: [nicht berechenbar].`;

const toExamples = (value: unknown): string[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => toTrimmedString(entry)).filter((entry) => entry.length > 0);
};

/** A template, its fill hints and examples as `<template_context>`, or "" when all are empty. */
export const renderTemplateContext = (template?: TemplateContextInput | null): string => {
	if (!template) {
		return "";
	}

	const title = toTrimmedString(template.title);
	const content = toTrimmedString(template.content);
	const examples = toExamples(template.examples);
	const information = toTrimmedString(template.information);

	const blocks = [
		title ? `<title>\n${title}\n</title>` : "",
		content ? `<content>\n${content}\n</content>` : "",
		information ? `<information>\n${information}\n</information>` : "",
		examples.length > 0
			? `<examples>\n${examples
					.map((example) => `<example>\n${example}\n</example>`)
					.join("\n")}\n</examples>`
			: "",
	].filter(hasContent);

	if (blocks.length === 0) {
		return "";
	}

	return `<template_context>\n<usage>\n${TEMPLATE_CONTEXT_USAGE}\n</usage>\n<markdoc_tag_guidance>\n${MARKDOC_TAG_GUIDANCE}\n</markdoc_tag_guidance>\n<template>\n${blocks.join("\n")}\n</template>\n</template_context>`;
};
