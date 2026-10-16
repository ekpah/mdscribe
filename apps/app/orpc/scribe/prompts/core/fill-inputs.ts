import { createMdscribeSource } from "markdoc-md/citations";

import type { FillInputsContextFile, InputField, PromptMessage } from "@/orpc/scribe/types";

export const FILL_INPUTS_PROMPT_NAME = "input_fill";

const FILL_INPUTS_SYSTEM_PROMPT = `Du füllst medizinische Eingabefelder aus den bereitgestellten Quellen aus.

Quellen (jeweils optional):
- <context>: klinischer Patientenkontext (Diagnosen, Anamnese, Befunde, Epikrise, Notizen).
- <audio_transkripte>: transkribierte Diktate.
- <datei_kontext>: per OCR aus Dateien extrahierter Text.
- <dateien>: Metadaten angehängter Dateien (zusätzlich als Nachrichtenteile).
- <input_fields>: die auszufüllenden Felder mit exakten Labels, Typen und Metadaten; keine Patientendaten.

Antworte nur mit kompaktem JSON ohne Einrückung oder unnötige Leerzeichen. Strukturbeispiel:
{
  "suggestions": [
    {
      "field": "Exaktes Feldlabel",
      "value": "Wert",
      "citations": [
        {
          "source": 1,
          "quote": "Wörtlicher Beleg aus der Quelle"
        },
        {
          "source": 2,
          "quote": "Weiterer wörtlicher Beleg für einen anderen Teil des Werts"
        }
      ]
    }
  ]
}

Regeln:
- Verwende ausschließlich die exakten Labels aus <input_fields> als field. Gib jedes Feld höchstens einmal zurück.
- Gib nur Felder zurück, für die passende Quellinformationen vorhanden sind.
- Erfinde nichts. Lass Felder ohne passende Quellinformation weg.
- Beachte die Beschreibung/Metadaten in <input_fields> und das Output-Schema.
- Prüfe jedes angeforderte Feld, nicht nur die auffälligsten Befunde. Feldlabels sind technische Variablennamen: Unterstriche, Einheiten und ausgeschriebene Begriffe müssen nicht wörtlich in der Quelle stehen. Ordne fachlich eindeutige Abkürzungen und Synonyme anhand von Bedeutung und Einheit zu.
- Lies Tabellen zeilen- und spaltenbezogen: Zeilenbezeichnung + Spaltenüberschrift + Zellenwert gehören zusammen. Leere Zellen bleiben unbekannt; verschiebe keinen Wert in eine andere Spalte. Verwechsle Druckwerte nicht mit Sättigungen desselben Messorts.
- Ohne anderslautende Feldbeschreibung nutze die Ruhe-/Ausgangswerte, nicht Belastungs-, Provokations- oder Folgemessungen. Sind mehrere Messungen nicht eindeutig zuzuordnen, lasse das betroffene Feld weg.
- Zerlege Angaben im Format systolisch / diastolisch (Mittelwert) in die passenden einzelnen Druckfelder. Übernimm einen explizit angegebenen Mittelwert unverändert, statt ihn aus den anderen Drücken neu zu berechnen.
- Übernimm explizit berichtete Mess-/Ergebniswerte auch für Felder mit calculation. Ein solcher Wert hat Vorrang vor der Berechnung. Fehlt ein direkter Wert, bevorzuge die einzelnen Komponenten und lasse die Anwendung aus der Formel berechnen; rechne nicht selbst und erfinde keinen Messwert.
- Dezimalkomma und Dezimalpunkt sind beide Zahlenformate. Gib number-Werte als JSON-Zahlen ohne Einheit zurück. Bei string-Feldern erhalte klinisch relevante Einheiten und Zusätze aus der Quelle.
- Gib date-Werte im Format YYYY-MM-DD zurück. Übliche klinische Kürzel (z.B. HZV, HF, SaO2, SvO2) und offensichtliche OCR-Schreibfehler in Bezeichnungen (z.B. Sa02 statt SaO2) dürfen zugeordnet werden, aber korrigiere keine Zahlenwerte auf Verdacht.
- Bei switch muss der Wert exakt eine der options sein.
- Bei boolean nutze true oder false.
- Gib für jeden Vorschlag ein citations-Array zurück. Bei jedem Wert aus einer zitierbaren Text-/Dateiquelle muss es mindestens einen Beleg enthalten.
- Ein Wert darf mehrere citations haben, wenn mehrere Quellen denselben Wert belegen oder verschiedene Teile des Werts aus verschiedenen Quellen stammen.
- Erzeuge für jeden unabhängig belegten Teil genau einen Eintrag und wiederhole denselben Beleg nicht.
- Verwende als citations[].source ausschließlich die ganzzahlige Quellennummer aus <zitierbare_quellen>, als JSON-Zahl, nicht als String. Die Nummern gelten nur für diese Anfrage.
- citations[].quote muss ein kurzer, exakt aus dieser Quelle kopierter Beleg sein. Nicht paraphrasieren oder OCR-Schreibfehler korrigieren, auch wenn du den Feldwert normalisierst. Erhalte Zahlen einschließlich Dezimalzeichen, Auswahlmarkierungen, Vergleichszeichen und zugehörige Negationen unverändert. Die Zitatstelle wird ohne Fuzzy Matching gesucht.
- Bei Tabellen zitiere die Zeilenbezeichnung zusammen mit dem zugehörigen Wert, gegebenenfalls auch die Spaltenüberschrift. Verwende die sichtbaren Wörter/Zahlen in Quellreihenfolge, keine HTML-Tags oder Markdown-Trennzeichen. Ein einzelner, mehrfach vorkommender Zahlenwert ist kein eindeutiger Beleg.
- Wenn der Wert nur aus Audio stammt oder keine zitierbare Quelle bereitgestellt ist, gib citations: [] zurück. Wenn eine zitierbare Textquelle vorhanden ist, aber kein wörtlicher Beleg für den Wert, lasse den gesamten Vorschlag weg.
- Für Inhalte aus Dateien verwende die zugehörige source-Nummer aus <datei_kontext> oder <dateien>. Die quote muss im sichtbaren oder extrahierten Dokumenttext vorkommen.`;

export interface FillInputsCitationSource {
	label: string;
	source: string;
}

interface FillInputsPromptInput {
	/** Explicit field definitions, including for providers that only support JSON mode. */
	inputFields: InputField[];
	/** Already-wrapped `<audio_transkripte>` section, if audio was transcribed. */
	audioTranscripts?: string;
	/** Files attached natively to the model; listed here for reference. */
	contextFiles?: FillInputsContextFile[];
	/** Composed `<context>` block from the shared scribe context pipeline. */
	contextXml?: string;
	/** Already-wrapped `<datei_kontext>` section, if files were preprocessed. */
	fileTextContext?: string;
	/** Canonical sources stay server-side; the model sees their one-based numbers. */
	citationSources?: FillInputsCitationSource[];
}

const renderContextFilesSection = (
	files: FillInputsContextFile[],
	sources: FillInputsCitationSource[],
): string => {
	if (files.length === 0) {
		return "";
	}

	const entries = files
		.map((file, index) => {
			const id = file.id?.trim();
			const sourceIndex = id
				? sources.findIndex(({ source }) => source === createMdscribeSource("file", id))
				: -1;
			return JSON.stringify({
				index: index + 1,
				name: file.name,
				...(file.kind === "ocr" ? {} : { mimeType: file.mimeType }),
				...(sourceIndex >= 0 ? { source: sourceIndex + 1 } : {}),
			});
		})
		.join("\n");
	return `<dateien>\n${entries}\n</dateien>`;
};

const renderCitationSourcesSection = (sources: FillInputsCitationSource[]): string => {
	if (sources.length === 0) {
		return "";
	}

	const entries = sources.map(({ label }, index) => `- source=${index + 1} | ${label}`).join("\n");
	return `<zitierbare_quellen>\n${entries}\n</zitierbare_quellen>`;
};

const joinSections = (sections: (string | undefined)[]) =>
	sections.filter((section): section is string => Boolean(section?.trim())).join("\n\n");

const buildFillInputsUserPrompt = (input: FillInputsPromptInput): string =>
	joinSections([
		`<input_fields>\n${JSON.stringify(input.inputFields)}\n</input_fields>`,
		renderCitationSourcesSection(input.citationSources ?? []),
		input.contextXml,
		input.audioTranscripts,
		input.fileTextContext,
		renderContextFilesSection(input.contextFiles ?? [], input.citationSources ?? []),
	]);

export const composeFillInputsPrompt = (input: FillInputsPromptInput): PromptMessage[] => [
	{ content: FILL_INPUTS_SYSTEM_PROMPT, role: "system" },
	{ content: buildFillInputsUserPrompt(input), role: "user" },
];
