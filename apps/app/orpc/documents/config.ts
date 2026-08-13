import type { ModelConfig, PromptMessage } from "@/orpc/scribe/types";
import type { DocumentDefinition, PdfFormField } from "@/app/documents/_lib";

/**
 * Field mapping type for PDF form fields
 */
interface FieldMapping {
	fieldName: string;
	inputKind: "text" | "boolean" | "choice";
	label: string;
	options?: string[];
	description?: string;
	pdfType?: "text" | "multiline" | "dropdown" | "checkbox" | "radio" | "unsupported";
}

export interface DocumentInputField {
	label: string;
	description?: string;
	options?: string[];
	type?: "string" | "number" | "date" | "switch" | "boolean";
	unit?: string;
}

/**
 * Configuration for PDF document AI operations
 */
interface PDFDocumentConfig<TVariables> {
	promptName: string;
	prompt: (vars: TVariables) => PromptMessage[];
	modelConfig: ModelConfig;
}

const definePdfDocumentConfig = <TVariables>(
	config: PDFDocumentConfig<TVariables>,
): PDFDocumentConfig<TVariables> => config;

/**
 * Variables for parseForm prompt
 */
interface ParseFormVariables {
	fieldMapping?: FieldMapping[];
	fieldMappings?: FieldMapping[];
	inputFields?: DocumentInputField[];
}

interface EnhanceDefinitionVariables {
	definition: DocumentDefinition;
	pdfFields: PdfFormField[];
}

/**
 * Configuration for all PDF document operations
 * Each configuration defines:
 * - promptName: Reference name for tracking/logging
 * - prompt: Function that builds messages from typed variables
 * - modelConfig: AI model settings (temperature, maxTokens)
 */
export const pdfDocumentConfigs = {
	enhanceDefinition: definePdfDocumentConfig<EnhanceDefinitionVariables>({
		modelConfig: {},
		prompt: ({ definition, pdfFields }): PromptMessage[] => [
			{
				content: `Du optimierst die Eingabedefinition eines medizinischen PDF-Formulars. Das Ergebnis wird direkt als Formular gerendert und anschließend zum Ausfüllen der PDF verwendet.

Aktuelle Definition:
${JSON.stringify(definition, null, 2)}

Serverseitig aus der PDF gelesene Formularfelder:
${JSON.stringify(pdfFields, null, 2)}

Architektur:
- "inputs" sind PDF-unabhängige, direkt renderbare Eingaben.
- inputs[].attributes.primary ist die eindeutige, stabile Werte-ID und zugleich das sichtbare Label.
- Ein Info-Input ist Text, Zahl oder Datum.
- Ein Switch mit type="boolean" ist eine einzelne Ja/Nein-Checkbox.
- Ein Switch ohne boolean-Typ ist eine Auswahl; seine Case-children sind die sichtbaren Optionen.
- Nur "bindings" kennen die PDF-Struktur. Jedes Binding verbindet fieldName mit inputId und übersetzt Eingabewerte bei Bedarf über valueMap in rohe PDF-Werte.

Aufgabe:
1. Verbessere Labels, Beschreibungen und passende Eingabetypen anhand des sichtbaren Formulars.
2. Verbessere bei Bedarf die vollständige Struktur der Inputs und Bindings.
3. Gruppiere zusammengehörige PDF-Checkboxfelder als Optionen eines gemeinsamen Switches, wenn das Formular eine Einfachauswahl darstellt. Das gilt auch für Textfelder, die visuell Checkboxen sind und in der aktuellen Definition bereits eine boolesche valueMap mit einem Anzeigewert wie "x" besitzen.
4. Trenne einzelne Optionen eines PDF-Checkboxfelds mit mehreren Widgets in boolesche Switches, wenn sie unabhängig auswählbar sind.
5. Verwende valueMap ausschließlich in Bindings, um verständliche Markdoc-Werte auf exakte rohe PDF-Werte abzubilden.

Unveränderliche Regeln:
- Übernimm jeden vorhandenen fieldName exakt und mindestens einmal; erfinde und entferne keine PDF-Felder.
- Markdoc-Inputs dürfen keine PDF-Feldnamen, Widget-Struktur oder PDF-Exportwerte voraussetzen.
- Wenn primary umbenannt wird, müssen alle zugehörigen inputId-Werte exakt mit umbenannt werden.
- Nutze für valueMap nur Werte, die das jeweilige PDF-Feld laut optionMappings unterstützt. Bei checkboxartigen Textfeldern bewahrst du den bereits konfigurierten Anzeigewert. Eine leere Zeichenkette steht für nicht ausgewählt.
- Schreibgeschützte und nicht unterstützte PDF-Felder bleiben deaktiviert.
- Bewahre die Aktivierung jedes PDF-Felds; aktiviere oder deaktiviere keine Felder.
- Erzeuge keine zwei Inputs mit demselben primary und keine doppelten Bindings aus fieldName und inputId.
- Bewahre fachlich sinnvolle bestehende Anpassungen. Ändere Struktur nur, wenn die PDF-Darstellung oder Semantik dadurch klarer wird.
- Gib ausschließlich ein JSON-Objekt in der Form {"fieldDefinitions":{"inputs":[...],"bindings":[...]}} zurück, ohne Markdown oder zusätzlichen Text.`,
				role: "user",
			},
		],
		promptName: "pdf_document_definition_enhancement",
	}),
	parseForm: definePdfDocumentConfig<ParseFormVariables>({
		modelConfig: {},
		prompt: (vars): PromptMessage[] => {
			const { fieldMapping, fieldMappings, inputFields } = vars;
			const mappings = fieldMappings ?? fieldMapping ?? [];
			return [
				{
					content: `Du analysierst ein PDF-Formular-Dokument. Ich habe die folgenden Eingabefelder und PDF-Formularfeld-Zuordnungen extrahiert:

Eingabefelder:
${JSON.stringify(inputFields ?? [], null, 2)}

PDF-Feldzuordnungen:
${JSON.stringify(mappings, null, 2)}

Für jedes Eingabefeld:
1. Schlage ein besseres, aussagekräftigeres Label vor
2. Gib eine klare und prägnante Beschreibung an, wofür dieses Feld verwendet wird

Strukturregeln:
- inputKind="boolean" ist ein Ja/Nein-Feld.
- inputKind="choice" ist eine Auswahl mit den mitgelieferten options; diese Optionen sind technische PDF-Werte und dürfen nicht umbenannt oder ersetzt werden.
- inputKind="text" ist ein Freitext-, Zahlen- oder Datumsfeld.

Spezialregel für Checkbox-Felder mit inputKind="boolean":
- Das Label soll als boolesches Feld funktionieren (ein Zustand, true/false), nicht als freie Auswahl.
- Beschreibungen sollen klar machen, dass das Feld angehakt (true) oder nicht angehakt (false) ist.
- Verwende keine Ergebnistexte wie "Ja"/"Nein" als Label, sondern den eigentlichen medizinischen Sachverhalt.

Gib deine Antwort als JSON-Objekt mit genau dieser Struktur zurück:
{
  "fieldMapping": [{
    "fieldName": "[original_field_name]",
    "label": "[verbessertes_label]",
    "description": "[klare Beschreibung des Feldes]"
  }]
}

Achte darauf:
- Alle originalen fieldName-Werte beizubehalten
- Gib genau eine Antwort pro PDF-Feldzuordnung zurück
- Nutze die Eingabefelder als fachliche Quelle für Label und Beschreibung
- Falls pdfType mitgeliefert wird, die Semantik im Label/Beschreibung zu berücksichtigen
- Optionen nicht umzuschreiben; nutze sie nur als Kontext für Label und Beschreibung
- Die Beschreibungen kurz und aussagekräftig zu halten
- fieldName exakt wie im Input zu übernehmen`,
					role: "user",
				},
			];
		},
		promptName: "pdf_form_enhancement",
	}),
};
