import type { ModelConfig, PromptMessage } from "@/orpc/scribe/types";

/**
 * Field mapping type for PDF form fields
 */
export interface FieldMapping {
	fieldName: string;
	inputKind: "text" | "boolean" | "choice";
	label: string;
	options?: string[];
	description: string;
	pdfType?: "text" | "multiline" | "dropdown" | "checkbox" | "radio";
}

/**
 * Configuration for PDF document AI operations
 */
interface PDFDocumentConfig {
	promptName: string;
	prompt: (vars: Record<string, unknown>) => PromptMessage[];
	modelConfig: ModelConfig;
}

/**
 * Variables for parseForm prompt
 */
interface ParseFormVariables {
	fieldMapping: FieldMapping[];
}

/**
 * Configuration for all PDF document operations
 * Each configuration defines:
 * - promptName: Reference name for tracking/logging
 * - prompt: Function that builds messages from typed variables
 * - modelConfig: AI model settings (temperature, maxTokens)
 */
export const pdfDocumentConfigs: Record<string, PDFDocumentConfig> = {
	parseForm: {
		modelConfig: {
			temperature: 0.3,
		},
		prompt: (vars: Record<string, unknown>): PromptMessage[] => {
			const { fieldMapping } = vars as unknown as ParseFormVariables;
			return [
				{
					content: `Du analysierst ein PDF-Formular-Dokument. Ich habe die folgenden Formularfeld-Zuordnungen aus dem PDF extrahiert:

${JSON.stringify(fieldMapping, null, 2)}

Für jede Feldzuordnung:
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
- Falls pdfType mitgeliefert wird, die Semantik im Label/Beschreibung zu berücksichtigen
- Optionen nicht umzuschreiben; nutze sie nur als Kontext für Label und Beschreibung
- Die Beschreibungen kurz und aussagekräftig zu halten
- fieldName exakt wie im Input zu übernehmen`,
					role: "user",
				},
			];
		},
		promptName: "pdf_form_enhancement",
	},
};
