import type { ModelConfig, PromptMessage } from "@/orpc/scribe/types";

/**
 * Field mapping type for PDF form fields
 */
export interface FieldMapping {
	fieldName: string;
	label: string;
	description: string;
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
		promptName: "pdf_form_enhancement",
		prompt: (vars: Record<string, unknown>): PromptMessage[] => {
			const { fieldMapping } = vars as unknown as ParseFormVariables;
			return [
				{
					role: "user",
					content: `Du analysierst ein PDF-Formular-Dokument. Ich habe die folgenden Formularfeld-Zuordnungen aus dem PDF extrahiert:

${JSON.stringify(fieldMapping, null, 2)}

Für jede Feldzuordnung:
1. Schlage ein besseres, aussagekräftigeres Label vor
2. Gib eine klare und prägnante Beschreibung an, wofür dieses Feld verwendet wird

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
- Die Beschreibungen kurz und aussagekräftig zu halten
- fieldName exakt wie im Input zu übernehmen`,
				},
			];
		},
		modelConfig: {
			temperature: 0.3,
		},
	},

};
