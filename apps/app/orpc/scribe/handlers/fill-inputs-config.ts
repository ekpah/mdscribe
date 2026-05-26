import type {
	FillInputsContextFile,
	FillInputsTextContext,
	ModelConfig,
	PromptMessage,
} from "@/orpc/scribe/types";

interface FillInputsPromptInput {
	contextFiles?: FillInputsContextFile[];
	textContext?: FillInputsTextContext;
}

const toPromptJson = (input: FillInputsPromptInput) =>
	JSON.stringify(
		{
			contextFiles: (input.contextFiles ?? []).map((file) => ({
				mimeType: file.mimeType,
				name: file.name,
				size: file.size,
			})),
			textContext: input.textContext ?? null,
		},
		null,
		2,
	);

export const fillInputsConfig: {
	modelConfig: ModelConfig;
	prompt: (input: FillInputsPromptInput) => PromptMessage[];
	promptName: string;
} = {
	modelConfig: {
		maxTokens: 2000,
		temperature: 0.3,
	},
	prompt: (input) => [
		{
			content: `Du füllst medizinische Eingabefelder aus.

Du bekommst:
- textContext: klinischer Text als Quelle
- contextFiles: Namen/Metadaten angehängter Dateien
- optional Audio/Dateien als zusätzliche Nachrichtenteile
- Das Output-Schema enthält die exakt auszufüllenden Feldlabels mit Beschreibung.

Antworte nur mit JSON:
{
  "fieldValues": {
    "Exaktes Feldlabel": "Wert"
  }
}

Regeln:
- Verwende exakt die Keys aus dem Output-Schema.
- Erfinde nichts. Wenn du keine Information findest, nutze "".
- Beachte die Beschreibung/Metadaten im Output-Schema.
- Bei switch muss der Wert exakt eine der options sein.
- Bei boolean nutze true oder false.`,
			role: "system",
		},
		{
			content: toPromptJson(input),
			role: "user",
		},
	],
	promptName: "input_fill",
};
