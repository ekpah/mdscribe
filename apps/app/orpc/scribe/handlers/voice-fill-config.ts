import type { ModelConfig, PromptMessage } from "@/orpc/scribe/types";

export interface VoiceFillFieldDefinition {
	label: string;
	description?: string;
	type?: "string" | "number" | "date" | "switch";
	unit?: string;
	options?: string[];
}

interface VoiceFillVariables {
	fields: VoiceFillFieldDefinition[];
	inputTagsJson?: string;
}

interface VoiceFillConfig {
	promptName: string;
	prompt: (vars: VoiceFillVariables) => PromptMessage[];
	modelConfig: ModelConfig;
}

export const voiceFillConfig: VoiceFillConfig = {
	modelConfig: {
		maxTokens: 4000,
		temperature: 0.3,
	},
	prompt: (vars: VoiceFillVariables): PromptMessage[] => [
		{
			content: `Du bist ein Assistent, der Sprachaufnahmen analysiert und daraus Eingabefelder ausfüllt.

Die Audioaufnahme enthält Informationen, die in Eingabefelder eingetragen werden sollen.
Der Benutzer gibt dir eine Feldliste (mit Typ/Optionen) und optional die komplette InputTagType-Struktur.

Analysiere die Audioaufnahme und extrahiere relevante Informationen für jedes Feld.
Lasse Felder leer (""), wenn keine passende Information gefunden wurde.
Antworte NUR mit einem JSON-Objekt der Feldwerte.
Verwende exakt die vom Benutzer angegebenen Labels als Keys in deiner Antwort.

Regeln nach Typ:
- switch: Wert muss exakt einer der Optionen sein, sonst "".
- number: Nur Ziffern und optional ein Dezimalpunkt (.), keine Einheiten.
- date: Format TT.MM.JJJJ (z.B. 17.01.2026).
- string: Freitext ohne zusätzliche Erklärungen.`,
			role: "system",
		},
		{
			content: `Verfügbare Felder für diese Eingaben:\n${vars.fields
				.map((field) => {
					const details = [
						`type=${field.type ?? "string"}`,
						field.unit ? `unit=${field.unit}` : null,
						field.options?.length
							? `options=${field.options.join(", ")}`
							: null,
						field.description ? `desc=${field.description}` : null,
					]
						.filter(Boolean)
						.join(" | ");
					return `- "${field.label}"${details ? ` (${details})` : ""}`;
				})
				.join("\n")}\n\nInputTagType JSON:\n${vars.inputTagsJson ?? "null"}`,
			role: "user",
		},
	],
	promptName: "input_voice_fill",
};
